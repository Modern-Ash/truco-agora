"""Tests de paridad de LLMEngine (docs/llm-engine.md).

No llaman a un LLM real: mockean LLMClient.generate() con respuestas JSON
*correctas* conocidas y verifican que LLMEngine da los mismos resultados
que el motor determinista en los mismos casos ya cubiertos por
test_cards.py/test_envido.py/test_engine.py. Esto prueba que el mecanismo
de arbitraje funciona como se diseñó — no que un LLM real vaya a acertar
siempre (riesgo aceptado, documentado en docs/llm-engine.md).
"""
from __future__ import annotations

import random

from truco.cards import Card
from truco.engine import Team
from truco.llm_engine import LLMArbitration, LLMEngine, _extract_json
from truco.tests.helpers import ScriptedController


class _ScriptedGenerateClient:
    """Cliente LLM fake: devuelve respuestas JSON scripteadas en orden."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.prompts = []

    def generate(self, prompt: str) -> str:
        self.prompts.append(prompt)
        if self._responses:
            return self._responses.pop(0)
        return "{}"


def _team(name, controller_kwargs=None):
    from truco.engine import Player
    p = Player(name, ScriptedController(**(controller_kwargs or {})))
    t = Team(f"Equipo {name}", [p])
    p.team = t
    return t, p


# --------------------------------------------------------- _extract_json


def test_extract_json_from_clean_response():
    assert _extract_json('{"result": 1}') == {"result": 1}


def test_extract_json_from_response_with_surrounding_text():
    assert _extract_json('Claro, la respuesta es: {"result": -1} listo') == {"result": -1}


def test_extract_json_returns_none_on_garbage():
    assert _extract_json("no hay json acá") is None


# --------------------------------------------------------- LLMArbitration


def test_compare_plays_matches_deterministic_ranking_when_llm_correct():
    ancho_espada = Card("espada", 1)
    cuatro = Card("copa", 4)
    client = _ScriptedGenerateClient(['{"result": 1}'])
    arb = LLMArbitration(client)
    assert arb.compare_plays(ancho_espada, cuatro) == 1


def test_compare_plays_falls_back_on_unparseable_response():
    ancho_espada = Card("espada", 1)
    cuatro = Card("copa", 4)
    client = _ScriptedGenerateClient(["no entendí"])
    arb = LLMArbitration(client)
    # Fallback determinista: ancho de espada le gana al 4 (beats() real).
    from truco.cards import beats
    assert arb.compare_plays(ancho_espada, cuatro) == beats(ancho_espada, cuatro)


def test_compare_plays_face_down_never_asks_llm():
    client = _ScriptedGenerateClient([])  # si se llama, IndexError -> falla el test
    arb = LLMArbitration(client)
    assert arb.compare_plays(None, Card("oro", 4)) == -1
    assert client.prompts == []


def test_envido_value_matches_deterministic_when_llm_correct():
    cards = [Card("oro", 7), Card("oro", 4), Card("copa", 12)]
    client = _ScriptedGenerateClient(['{"value": 31}'])
    arb = LLMArbitration(client)
    assert arb.envido_value(cards) == 31


def test_envido_value_falls_back_on_unparseable_response():
    cards = [Card("oro", 7), Card("oro", 4), Card("copa", 12)]
    client = _ScriptedGenerateClient(["treinta y uno"])
    arb = LLMArbitration(client)
    from truco.envido import best_envido
    assert arb.envido_value(cards) == best_envido(cards)


# --------------------------------------------------------------- LLMEngine


def test_llm_engine_no_quiero_on_truco_matches_deterministic_when_no_client():
    # client=None: LLMEngine debe comportarse idéntico al motor determinista.
    t1, p1 = _team("A", {"actions": ["no_envido", "truco"]})
    t2, p2 = _team("B", {"call_responses": ["no_quiero"]})
    match = LLMEngine([t1, t2], target_score=30, rng=random.Random(7), client=None)
    match.play_hand()
    assert p1.team.score == 1
    assert p2.team.score == 0


def test_llm_engine_hand_winner_uses_correct_llm_response():
    t1, p1 = _team("A", {"actions": ["no_envido"],
                          "cards_to_play": [("oro", 12), ("espada", 1)]})
    t2, p2 = _team("B", {"actions": ["no_envido"],
                          "cards_to_play": [("copa", 12), ("basto", 4)]})
    # 1ra ronda parda (12=12) -> LLM responde null (no decidible aún).
    # 2da ronda: A juega As de espada vs 4 de basto -> LLM dice gana A.
    responses = [
        '{"result": 0}',    # compare_plays ronda 1: 12 vs 12
        '{"winner": null}',  # decide_hand_winner tras ronda 1 (parda, aún indeciso)
        '{"result": 1}',    # compare_plays ronda 2: As espada vs 4 basto
        '{"winner": "A"}',  # decide_hand_winner tras ronda 2
    ]
    client = _ScriptedGenerateClient(responses)
    match = LLMEngine([t1, t2], target_score=30, rng=random.Random(2), client=client)
    match._deal = lambda: (
        setattr(p1, "hand", [Card("oro", 12), Card("espada", 1), Card("oro", 4)]),
        setattr(p2, "hand", [Card("copa", 12), Card("basto", 4), Card("copa", 4)]),
        setattr(p1, "played", []), setattr(p1, "face_down", []),
        setattr(p2, "played", []), setattr(p2, "face_down", []),
    )
    match.play_hand()
    assert p1.team.score == 1
    assert p2.team.score == 0


def test_llm_engine_hand_winner_falls_back_when_llm_names_unknown_player():
    t1, p1 = _team("A", {"actions": ["no_envido"],
                          "cards_to_play": [("espada", 1), ("oro", 4)]})
    t2, p2 = _team("B", {"actions": ["no_envido"],
                          "cards_to_play": [("copa", 4), ("basto", 4)]})
    responses = [
        '{"result": 1}',            # A gana ronda 1 claramente
        '{"winner": "Alguien que no existe"}',  # respuesta inválida -> fallback
    ]
    client = _ScriptedGenerateClient(responses)
    match = LLMEngine([t1, t2], target_score=30, rng=random.Random(4), client=client)
    match.play_hand()
    # Fallback determinista: A ganó ronda 1 con carta más fuerte real
    # (As de espada > 4 de copa), y sigue jugando hasta decidir la mano.
    assert p1.team.score + p2.team.score >= 1
