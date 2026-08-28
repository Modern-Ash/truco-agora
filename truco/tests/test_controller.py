import random

from truco.cards import Card
from truco.controller import DeterministicMockLLMClient, LLMController, VisibleState
from truco.engine import Match, Player, Team


class UnavailableClient:
    def decide(self, prompt, options):
        raise RuntimeError("proveedor temporalmente inaccesible")


class InvalidChoiceClient:
    def decide(self, prompt, options):
        return "inventar_regla"


def visible_state():
    return VisibleState(
        hand_cards=[Card("oro", 4), Card("copa", 7)],
        played_by_me=[],
        played_by_teammate=None,
        played_by_opponents=[],
        my_team_score=0,
        opponent_team_score=0,
        pending_call=None,
    )


def test_mock_sin_seed_elige_la_primera_opcion_y_juega():
    client = DeterministicMockLLMClient()

    assert client.decide(
        "¿Qué hacés?", ["jugar", "truco", "irse_al_mazo"]
    ) == "jugar"
    assert client.decide("¿Qué carta?", ["0", "1", "2"]) == "0"


def test_mock_con_seed_conserva_secuencia_reproducible():
    first = DeterministicMockLLMClient(seed=7)
    second = DeterministicMockLLMClient(seed=7)
    options = ["jugar", "truco", "irse_al_mazo"]

    assert [first.decide("", options) for _ in range(8)] == [
        second.decide("", options) for _ in range(8)
    ]


def test_llm_controller_never_sees_opponent_hand():
    state = VisibleState(
        hand_cards=[Card("oro", 4)],
        played_by_me=[],
        played_by_teammate=None,
        played_by_opponents=[[Card("espada", 1)]],  # solo lo que ya jugaron
        my_team_score=0,
        opponent_team_score=0,
        pending_call=None,
    )
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=1))
    prompt = controller._prompt(state, "¿Qué hacés?")
    assert "espada" in prompt  # carta jugada por rival, visible
    # No hay forma de que el prompt incluya cartas no jugadas del rival
    # porque VisibleState nunca las recibe.


def test_llm_controller_prompt_incluye_estrategia_de_farol_por_defecto():
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=1))
    prompt = controller._prompt(visible_state(), "¿Qué hacés?")
    assert "farol" in prompt.lower()
    assert "aumenta los tantos en juego" in prompt.lower()
    assert "también tu riesgo" in prompt.lower()
    assert "no inventes el tanto declarado" in prompt.lower()
    assert controller.bluff_level == "equilibrado"


def test_llm_controller_prompt_expone_historial_visible_para_farol_contextual():
    state = visible_state()
    state.call_history = ["envido", "quiero", "truco"]
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=1))

    prompt = controller._prompt(state, "¿Qué hacés?")

    assert "Historial de cantos" in prompt
    assert "envido" in prompt
    assert "quiero" in prompt
    assert "truco" in prompt


def test_llm_controller_bluff_level_cambia_la_guia_del_prompt():
    mentiroso = LLMController(
        "Agente", DeterministicMockLLMClient(seed=1), bluff_level="mentiroso"
    )
    cauteloso = LLMController(
        "Agente", DeterministicMockLLMClient(seed=1), bluff_level="cauteloso"
    )
    prompt_mentiroso = mentiroso._prompt(visible_state(), "¿Qué hacés?")
    prompt_cauteloso = cauteloso._prompt(visible_state(), "¿Qué hacés?")
    assert "con frecuencia" in prompt_mentiroso
    assert "ocasiones puntuales" in prompt_cauteloso


def test_llm_controller_bluff_level_invalido_cae_a_equilibrado():
    controller = LLMController(
        "Agente", DeterministicMockLLMClient(seed=1), bluff_level="no-existe"
    )
    assert controller.bluff_level == "equilibrado"


def test_llm_controller_choose_card_returns_card_from_hand():
    state = VisibleState(
        hand_cards=[Card("oro", 4), Card("copa", 7)],
        played_by_me=[],
        played_by_teammate=None,
        played_by_opponents=[],
        my_team_score=0,
        opponent_team_score=0,
        pending_call=None,
    )
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=1))
    card = controller.choose_card(state)
    assert card in state.hand_cards


def test_llm_controller_call_response_is_valid_option():
    state = VisibleState(
        hand_cards=[Card("oro", 4)],
        played_by_me=[],
        played_by_teammate=None,
        played_by_opponents=[],
        my_team_score=0,
        opponent_team_score=0,
        pending_call="truco",
    )
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=2))
    resp = controller.choose_call_response(state, "truco")
    assert resp in ("quiero", "no_quiero")


def test_llm_controller_provider_unavailable_keeps_match_playable(caplog):
    controller = LLMController("Agente", UnavailableClient())
    state = visible_state()

    assert controller.choose_action(state, ["truco"]) in {"jugar", "truco", "irse_al_mazo"}
    assert controller.choose_card(state) in state.hand_cards
    assert controller.choose_call_response(state, "truco") in {
        "quiero", "no_quiero", "retruco",
    }
    assert controller.last_decision["source"] == "fallback"
    assert "proveedor no disponible" in caplog.text


def test_llm_controller_rechaza_opcion_fuera_del_conjunto_legal():
    controller = LLMController("Agente", InvalidChoiceClient())

    choice = controller.choose_action(visible_state(), ["truco"])

    assert choice in {"jugar", "truco", "irse_al_mazo"}
    assert controller.last_decision["source"] == "fallback"


def test_match_completa_con_proveedores_caidos_sin_interrumpirse():
    first = Player("OpenCode", LLMController("OpenCode", UnavailableClient()))
    second = Player("Ollama", LLMController("Ollama", UnavailableClient()))
    first_team = Team("OpenCode", [first])
    second_team = Team("Ollama", [second])
    first.team, second.team = first_team, second_team
    match = Match(
        [first_team, second_team],
        target_score=15,
        rng=random.Random(27),
        flor_enabled=False,
    )

    winner = match.play_match()

    assert winner in (first_team, second_team)
    assert winner.score >= 15
