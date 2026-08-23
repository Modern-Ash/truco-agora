"""Motor de reglas arbitrado por LLM (docs/llm-engine.md).

RIESGO ACEPTADO EXPLÍCITAMENTE (ver docs/llm-engine.md): un LLM arbitrando
en vivo puede fallar aritmética o lógica condicional de forma silenciosa.
El fallback al cálculo determinista solo ocurre ante fallo de PARSEO de la
respuesta (JSON inválido/ausente) — nunca como preferencia de reglas — y
se loguea para que sea auditable.
"""
from __future__ import annotations

import json
import logging
import re
from typing import List, Optional, Protocol

from .cards import Card, beats
from .engine import Match, Team, _cmp_plays
from .envido import best_envido

logger = logging.getLogger(__name__)

RANKING_TRUCO = (
    "Ranking de Truco (de más fuerte a más débil): 1 de espada, 1 de basto, "
    "7 de espada, 7 de oro, todos los 3, todos los 2, 1 de oro y 1 de copa "
    "(empatan entre sí), 7 de basto y 7 de copa (empatan entre sí), todas "
    "las figuras 12 (empatan entre sí), todas las 11 (empatan entre sí), "
    "todas las 10 (empatan entre sí), todos los 6, todos los 5, todos los 4. "
    "Dentro de un mismo escalón (ej. 'todos los 3'), cartas de distinto palo "
    "empatan entre sí (parda)."
)

RANKING_ENVIDO = (
    "Cálculo de envido: cada carta numérica vale su número; las figuras "
    "(10, 11, 12) valen 0. Si dos o tres cartas de la mano son del mismo "
    "palo, el valor es la suma de las dos más altas de ese palo más 20. "
    "Si no hay dos cartas del mismo palo, el valor es la carta individual "
    "más alta de la mano."
)

REGLA_PARDA = (
    "Resolución de la mano a partir de los resultados de ronda (cada "
    "resultado es el nombre de quien ganó esa ronda, o 'parda' si empató): "
    "si la 1ª ronda tiene ganador y la 2ª la gana la misma persona, esa "
    "persona gana la mano. Si la 1ª ronda tiene ganador y la 2ª es parda, "
    "gana la mano quien ganó la 1ª. Si la 1ª ronda tiene ganador y la 2ª la "
    "gana la otra persona, decide la 3ª ronda (si la 3ª es parda, gana quien "
    "ganó la 1ª). Si la 1ª ronda es parda, decide la 2ª (si no es parda "
    "también); si la 2ª también es parda, decide la 3ª; si las tres "
    "rondas empatan, gana el jugador 'mano'."
)


class LLMClient(Protocol):
    def generate(self, prompt: str) -> str: ...


def _extract_json(text: str) -> Optional[dict]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


class LLMArbitration:
    """Arbitraje de comparación de cartas y valor de envido vía LLM.

    Cada método construye un prompt con el fragmento de reglamento
    relevante embebido y pide JSON estricto. Si la respuesta no parsea,
    cae al cálculo determinista de cards.py/envido.py — únicamente como
    red de seguridad ante fallo de parseo, nunca por preferencia de reglas
    (ver docs/llm-engine.md)."""

    def __init__(self, client: Optional[LLMClient]):
        self.client = client

    def compare_plays(self, a: Optional[Card], b: Optional[Card]) -> int:
        if a is None or b is None:
            return _cmp_plays(a, b)  # tapadas: regla mecánica, no arbitraje
        if self.client is None:
            return beats(a, b)
        prompt = (
            f"{RANKING_TRUCO}\n\n"
            f"Comparación: carta A = {a}, carta B = {b}. "
            "¿Cuál es más fuerte para Truco? "
            'Respondé SOLO con JSON: {"result": 1} si gana A, '
            '{"result": -1} si gana B, {"result": 0} si empatan (parda).'
        )
        try:
            raw = self.client.generate(prompt)
        except Exception:  # noqa: BLE001 - fallback de robustez, no de reglas
            logger.warning("LLMEngine: excepción arbitrando comparación de cartas; "
                          "fallback determinista")
            return beats(a, b)
        data = _extract_json(raw)
        if data is None or "result" not in data or data["result"] not in (1, -1, 0):
            logger.warning("LLMEngine: respuesta no parseable comparando cartas "
                          "(%r); fallback determinista", raw[:120])
            return beats(a, b)
        return int(data["result"])

    def envido_value(self, cards: List[Card]) -> int:
        if self.client is None:
            return best_envido(cards)
        prompt = (
            f"{RANKING_ENVIDO}\n\n"
            f"Mano: {[str(c) for c in cards]}. ¿Cuál es el valor de envido? "
            'Respondé SOLO con JSON: {"value": <entero>}.'
        )
        try:
            raw = self.client.generate(prompt)
        except Exception:  # noqa: BLE001 - fallback de robustez, no de reglas
            logger.warning("LLMEngine: excepción arbitrando envido; fallback determinista")
            return best_envido(cards)
        data = _extract_json(raw)
        if data is None or "value" not in data or not isinstance(data["value"], int):
            logger.warning("LLMEngine: respuesta no parseable calculando envido "
                          "(%r); fallback determinista", raw[:120])
            return best_envido(cards)
        return data["value"]


class LLMEngine(Match):
    """Motor arbitrado por LLM: comparación de cartas, envido y resolución
    de mano vía LLM (docs/llm-engine.md). Reutiliza el resto de `Match`
    (reparto, cantos, escalado, puntaje) sin cambios."""

    def __init__(self, teams: List[Team], target_score: int = 15,
                 rng=None, client: Optional[LLMClient] = None):
        self._arbitration = LLMArbitration(client)
        super().__init__(
            teams, target_score=target_score, rng=rng,
            compare_fn=self._arbitration.compare_plays,
            envido_fn=self._arbitration.envido_value,
        )
        self.client = client

    def _decide_hand_winner(self, results):
        if not results:
            return None
        # Necesita al menos 2 resultados para poder decidir en cualquier
        # rama de la regla; delega igual al LLM con lo que haya.
        if self.client is None:
            return super()._decide_hand_winner(results)

        by_name = {p.name: p for p in self.players}
        sequence = [
            (r.name if r is not None else "parda") for r in results
        ]
        prompt = (
            f"{REGLA_PARDA}\n\n"
            f"Resultados de ronda en orden: {sequence}. "
            f"Jugador mano: {self.players[self.mano_index].name}. "
            "¿Quién gana la mano con lo jugado hasta ahora, si ya se puede "
            "determinar? "
            'Respondé SOLO con JSON: {"winner": "<nombre>"} o '
            '{"winner": null} si todavía no se puede decidir con las '
            "rondas jugadas hasta ahora."
        )
        try:
            raw = self._arbitration.client.generate(prompt)
        except Exception:  # noqa: BLE001 - fallback de robustez, no de reglas
            logger.warning("LLMEngine: excepción arbitrando ganador de mano; "
                          "fallback determinista")
            return super()._decide_hand_winner(results)
        data = _extract_json(raw)
        if data is None or "winner" not in data:
            logger.warning("LLMEngine: respuesta no parseable decidiendo "
                          "ganador de mano (%r); fallback determinista", raw[:120])
            return super()._decide_hand_winner(results)
        winner_name = data["winner"]
        if winner_name is None:
            return None
        winner = by_name.get(winner_name)
        if winner is None:
            logger.warning("LLMEngine: nombre de ganador desconocido (%r); "
                          "fallback determinista", winner_name)
            return super()._decide_hand_winner(results)
        return winner
