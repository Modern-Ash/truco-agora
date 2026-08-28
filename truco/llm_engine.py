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
import time
from typing import List, Optional, Protocol

from .cards import Card, beats
from .engine import Match, Team, _cmp_plays
from .envido import best_envido
from .observability import log_event

logger = logging.getLogger(__name__)

RANKING_TRUCO = (
    "Ranking de Truco (de más fuerte a más débil): 1 de espada, 1 de basto, "
    "7 de espada, 7 de oro, todos los 3, todos los 2, 1 de oro y 1 de copa "
    "(empatan entre sí), todos los 12, todos los 11, todos los 10, "
    "7 de basto y 7 de copa (empatan entre sí), todos los 6, todos los 5, "
    "todos los 4. "
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
    "resultado es el jugador de un bando que ganó esa ronda, o 'parda' si "
    "empatan ambos bandos): si la 1ª ronda tiene ganador y la 2ª la gana "
    "cualquier integrante del mismo equipo, ese equipo gana la mano. Si la "
    "1ª ronda tiene ganador y la 2ª es parda, gana el equipo de la 1ª. Si "
    "las dos primeras las ganan equipos distintos, decide la 3ª ronda (si "
    "la 3ª es parda, gana el equipo que ganó la 1ª). Si la 1ª ronda es "
    "parda, decide la 2ª; si la 2ª también es parda, decide la 3ª; si las "
    "tres rondas empatan, gana el equipo del jugador mano. "
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
        started = time.monotonic()
        log_event(logger, "llm_engine.arbitration.start", kind="compare_plays")
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
            log_event(
                logger,
                "llm_engine.arbitration.fallback",
                severity=logging.WARNING,
                kind="compare_plays",
                reason="exception",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return beats(a, b)
        data = _extract_json(raw)
        if data is None or "result" not in data or data["result"] not in (1, -1, 0):
            logger.warning("LLMEngine: respuesta no parseable comparando cartas; "
                           "fallback determinista")
            log_event(
                logger,
                "llm_engine.arbitration.fallback",
                severity=logging.WARNING,
                kind="compare_plays",
                reason="invalid_response",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return beats(a, b)
        log_event(
            logger,
            "llm_engine.arbitration.end",
            kind="compare_plays",
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return int(data["result"])

    def envido_value(self, cards: List[Card]) -> int:
        if self.client is None:
            return best_envido(cards)
        started = time.monotonic()
        log_event(logger, "llm_engine.arbitration.start", kind="envido_value")
        prompt = (
            f"{RANKING_ENVIDO}\n\n"
            f"Mano: {[str(c) for c in cards]}. ¿Cuál es el valor de envido? "
            'Respondé SOLO con JSON: {"value": <entero>}.'
        )
        try:
            raw = self.client.generate(prompt)
        except Exception:  # noqa: BLE001 - fallback de robustez, no de reglas
            logger.warning("LLMEngine: excepción arbitrando envido; fallback determinista")
            log_event(
                logger,
                "llm_engine.arbitration.fallback",
                severity=logging.WARNING,
                kind="envido_value",
                reason="exception",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return best_envido(cards)
        data = _extract_json(raw)
        if data is None or "value" not in data or not isinstance(data["value"], int):
            logger.warning("LLMEngine: respuesta no parseable calculando envido; "
                           "fallback determinista")
            log_event(
                logger,
                "llm_engine.arbitration.fallback",
                severity=logging.WARNING,
                kind="envido_value",
                reason="invalid_response",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return best_envido(cards)
        log_event(
            logger,
            "llm_engine.arbitration.end",
            kind="envido_value",
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return data["value"]


class LLMEngine(Match):
    """Motor arbitrado por LLM: comparación de cartas, envido y resolución
    de mano vía LLM (docs/llm-engine.md). Reutiliza el resto de `Match`
    (reparto, cantos, escalado, puntaje) sin cambios."""

    def __init__(self, teams: List[Team], target_score: int = 15,
                 rng=None, client: Optional[LLMClient] = None,
                 flor_enabled: bool = True):
        self._arbitration = LLMArbitration(client)
        super().__init__(
            teams, target_score=target_score, rng=rng,
            flor_enabled=flor_enabled,
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
        started = time.monotonic()
        self._trace(
            "llm_engine.arbitration.start",
            kind="hand_winner",
            rounds=len(results),
        )

        by_name = {p.name: p for p in self.players}
        sequence = [
            (f"{r.name} ({r.team.name})" if r is not None else "parda")
            for r in results
        ]
        prompt = (
            f"{REGLA_PARDA}\n\n"
            f"Resultados de ronda en orden: {sequence}. "
            f"Jugador mano: {self.players[self.mano_index].name}. "
            f"Equipos: {[(team.name, [p.name for p in team.players]) for team in self.teams]}. "
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
            self._trace(
                "llm_engine.arbitration.fallback",
                kind="hand_winner",
                reason="exception",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return super()._decide_hand_winner(results)
        data = _extract_json(raw)
        if data is None or "winner" not in data:
            logger.warning("LLMEngine: respuesta no parseable decidiendo ganador "
                           "de mano; fallback determinista")
            self._trace(
                "llm_engine.arbitration.fallback",
                kind="hand_winner",
                reason="invalid_response",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return super()._decide_hand_winner(results)
        winner_name = data["winner"]
        if winner_name is None:
            self._trace(
                "llm_engine.arbitration.end",
                kind="hand_winner",
                result="undecided",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return None
        winner = by_name.get(winner_name)
        if winner is None:
            logger.warning("LLMEngine: nombre de ganador desconocido (%r); "
                          "fallback determinista", winner_name)
            self._trace(
                "llm_engine.arbitration.fallback",
                kind="hand_winner",
                reason="unknown_winner",
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return super()._decide_hand_winner(results)
        self._trace(
            "llm_engine.arbitration.end",
            kind="hand_winner",
            result="winner",
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return winner
