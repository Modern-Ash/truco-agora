"""Controladores de jugador: humano (CLI) o agente LLM.

El motor de reglas nunca confía ciegamente en la decisión de un controlador:
toda jugada se valida contra el estado legal antes de aplicarse (ver engine.py).
"""
from __future__ import annotations

import logging
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Protocol

from .cards import Card
from .observability import log_event

ENVIDO_CALLS = ["envido", "real_envido", "falta_envido"]
TRUCO_CALLS = ["truco", "retruco", "vale_cuatro"]

logger = logging.getLogger(__name__)


@dataclass
class VisibleState:
    """Estado visible para un controlador al momento de decidir.

    Nunca incluye las cartas de los rivales (solo lo que ya jugaron).
    Las cartas jugadas boca abajo aparecen como None salvo en
    `played_by_me` (el dueño siempre conoce su propia cara).
    """
    hand_cards: List[Card]
    played_by_me: List[Card]
    played_by_teammate: Optional[List[Optional[Card]]]
    played_by_opponents: List[List[Optional[Card]]]
    my_team_score: int
    opponent_team_score: int
    pending_call: Optional[str]  # p.ej. "truco", "envido", None
    call_history: List[str] = field(default_factory=list)


class PlayerController(ABC):
    """Estrategia intercambiable para decidir jugadas. Humano o agente."""

    @abstractmethod
    def choose_card(self, state: VisibleState) -> Card:
        """Elige una carta de `state.hand_cards` para jugar."""

    @abstractmethod
    def choose_call_response(self, state: VisibleState, call: str) -> str:
        """Responde a un canto vigente: 'quiero' | 'no_quiero' | un canto de escalada."""

    @abstractmethod
    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        """Elige jugar una carta ('jugar'), cantar algo de `available_calls`,
        o irse al mazo ('irse_al_mazo')."""

    def choose_face_down(self, state: VisibleState) -> bool:
        """Decide si la carta elegida se juega boca abajo (reglas-v2.md).
        Por defecto siempre boca arriba; los controladores pueden override."""
        return False


class HumanController(PlayerController):
    """Pide decisiones por stdin. Usado por la CLI hot-seat."""

    def __init__(self, name: str):
        self.name = name

    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        print(f"\n[{self.name}] Tu mano: {[str(c) for c in state.hand_cards]}")
        options = ["jugar"] + available_calls + ["irse_al_mazo"]
        print(f"[{self.name}] Opciones: {options}")
        choice = input(f"[{self.name}] Elegí una acción: ").strip().lower()
        return choice if choice in options else "jugar"

    def choose_card(self, state: VisibleState) -> Card:
        for i, c in enumerate(state.hand_cards):
            print(f"  {i}: {c}")
        idx = input(f"[{self.name}] Elegí índice de carta: ").strip()
        try:
            return state.hand_cards[int(idx)]
        except (ValueError, IndexError):
            return state.hand_cards[0]

    def choose_call_response(self, state: VisibleState, call: str) -> str:
        resp = input(f"[{self.name}] Responder a '{call}' "
                      f"(quiero/no_quiero/escalar): ").strip().lower()
        return resp or "no_quiero"

    def choose_face_down(self, state: VisibleState) -> bool:
        resp = input(f"[{self.name}] ¿Jugar la carta boca abajo? (s/n): "
                     ).strip().lower()
        return resp in ("s", "si", "y", "yes")


class LLMClient(Protocol):
    """Interfaz mínima de cliente LLM inyectable (real o mock)."""

    def decide(self, prompt: str, options: List[str]) -> str:
        """Devuelve una de `options` según el prompt de contexto de juego."""
        ...


class DeterministicMockLLMClient:
    """Cliente LLM determinístico para tests: siempre elige la primera opción,
    o usa `seed` para elegir de forma reproducible."""

    def __init__(self, seed: Optional[int] = None):
        # random.Random(None) usa entropía del sistema: convertía al mock por
        # defecto en un jugador aleatorio que podía encadenar "irse_al_mazo"
        # durante toda la partida. Sin seed respetamos el contrato de demo y
        # elegimos la primera opción (jugar / primera carta / quiero).
        self._rng = random.Random(seed) if seed is not None else None

    def decide(self, prompt: str, options: List[str]) -> str:
        if not options:
            raise ValueError("No hay opciones para decidir")
        return self._rng.choice(options) if self._rng is not None else options[0]


class LLMController(PlayerController):
    """Controlador respaldado por un LLMClient inyectado.

    No recibe nunca las cartas del rival: solo `VisibleState`.
    """

    #: Niveles válidos de faroleo, expuestos para que la capa HTTP los valide.
    BLUFF_LEVELS = ("cauteloso", "equilibrado", "mentiroso")

    def __init__(self, name: str, client: LLMClient,
                 bluff_level: str = "equilibrado",
                 match_id: Optional[str] = None):
        self.name = name
        self.client = client
        self.match_id = match_id
        self.bluff_level = bluff_level if bluff_level in self.ESTRATEGIA_POR_NIVEL else "equilibrado"

    def _fmt(self, cards) -> str:
        return [str(c) if c is not None else "carta tapada" for c in cards]

    # Tirar un farol (cantar sin tener las cartas que lo respalden) es una
    # estrategia legítima y a menudo ganadora del Truco real, no una trampa:
    # las reglas no exigen una mano fuerte para abrir o subir un canto. Otra
    # cosa es el tanto declarado tras aceptar el envido, que sí debe coincidir
    # con las cartas. Sin este contexto el LLM tiende a cantar solo "a lo
    # seguro", perdiendo una dimensión central del juego. `bluff_level`
    # regula cuánto lo usa.
    ESTRATEGIA_POR_NIVEL = {
        "cauteloso": (
            "Estrategia: sos un jugador cauteloso. Preferís cantar Envido y "
            "Truco solo cuando tu mano lo justifica de verdad; tirar un farol "
            "(abrir o subir un canto sin respaldo fuerte) te genera dudas y lo "
            "reservás para ocasiones puntuales."
        ),
        "equilibrado": (
            "Estrategia: en el Truco tirar un farol — abrir o subir Envido o "
            "Truco sin tener cartas fuertes que respalden la apuesta — es una "
            "táctica válida; no hace falta jugar siempre 'a lo seguro'. "
            "Un buen farol puede forzar al rival a irse al mazo o a rechazar "
            "el canto, pero si acepta aumenta los tantos en juego y también tu "
            "riesgo. Usalo con criterio, no siempre: leé el marcador, las "
            "cartas ya jugadas y el historial de cantos."
        ),
        "mentiroso": (
            "Estrategia: sos un jugador mentiroso y confiado. Tirás farol con "
            "frecuencia — abrís o subís Envido y Truco aun con poco respaldo — "
            "para meterle presión al rival y hacerlo dudar o irse al mazo. "
            "Preferís un riesgo calculado antes que jugar siempre pasivo."
        ),
    }

    REGLA_DEL_FAROL = (
        "Límite del farol: engañá solamente mediante decisiones legales de "
        "apuesta. Si un envido es aceptado, no inventes el tanto declarado: "
        "las cartas reales determinan el resultado. Elegí siempre una de las "
        "opciones legales que recibís."
    )

    def _prompt(self, state: VisibleState, question: str) -> str:
        teammate_played = (f"Jugadas compañero: {self._fmt(state.played_by_teammate)}"
                           if state.played_by_teammate is not None else "")
        opponents_played = "\n".join(
            [f"Rival {i}: {self._fmt(played)}"
             for i, played in enumerate(state.played_by_opponents)])

        return (
            f"Sos {self.name}, jugando al Truco Argentino.\n"
            f"{self.ESTRATEGIA_POR_NIVEL[self.bluff_level]}\n"
            f"{self.REGLA_DEL_FAROL}\n"
            f"Tu mano: {self._fmt(state.hand_cards)}\n"
            f"Jugadas propias: {self._fmt(state.played_by_me)}\n"
            f"{teammate_played}\n"
            f"Jugadas rivales:\n{opponents_played}\n"
            f"Marcador: tu equipo {state.my_team_score} - rival {state.opponent_team_score}\n"
            f"Canto pendiente: {state.pending_call}\n"
            f"Historial de cantos: {state.call_history or ['ninguno']}\n"
            f"{question}"
        )

    def _safe_decide(self, prompt: str, options: List[str],
                     decision_kind: str) -> str:
        """Mantiene viva la partida si el proveedor falla temporalmente.

        Los adaptadores ya degradan timeouts y respuestas inválidas. La falta
        del CLI, un modelo local ausente o una caída del servicio pueden
        todavía levantar una excepción. Como ``options`` contiene únicamente
        decisiones legales construidas por el motor, la primera opción es un
        fallback seguro y determinista que no altera las reglas.
        """
        if not options:
            raise ValueError("No hay opciones para decidir")
        started = time.monotonic()
        log_event(
            logger,
            "llm.decision.start",
            match_id=self.match_id,
            player=self.name,
            kind=decision_kind,
            provider=type(self.client).__name__,
            options=",".join(options),
        )
        try:
            choice = self.client.decide(prompt, options)
            log_event(
                logger,
                "llm.decision.end",
                match_id=self.match_id,
                player=self.name,
                kind=decision_kind,
                choice=choice,
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return choice
        except Exception as exc:  # noqa: BLE001 - frontera con proveedor externo
            logger.warning(
                "LLMController(%s): proveedor no disponible (%s: %s); "
                "usando opción legal %r",
                self.name,
                type(exc).__name__,
                exc,
                options[0],
            )
            log_event(
                logger,
                "llm.decision.fallback",
                severity=logging.WARNING,
                match_id=self.match_id,
                player=self.name,
                kind=decision_kind,
                error_type=type(exc).__name__,
                choice=options[0],
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return options[0]

    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        options = ["jugar"] + available_calls + ["irse_al_mazo"]
        prompt = self._prompt(state, "¿Qué acción hacés?")
        return self._safe_decide(prompt, options, "action")

    def choose_card(self, state: VisibleState) -> Card:
        options = [str(i) for i in range(len(state.hand_cards))]
        prompt = self._prompt(state, "¿Qué carta jugás? (índice)")
        choice = self._safe_decide(prompt, options, "card")
        try:
            return state.hand_cards[int(choice)]
        except (ValueError, IndexError):
            return state.hand_cards[0]

    def choose_call_response(self, state: VisibleState, call: str) -> str:
        prompt = self._prompt(state, f"¿Cómo respondés al canto '{call}'?")
        options = ["quiero", "no_quiero"]
        if call == "envido":
            if state.call_history.count("envido") < 2:
                options.append("envido")
            options.extend(["real_envido", "falta_envido"])
        elif call == "real_envido":
            options.append("falta_envido")
        elif call in TRUCO_CALLS:
            index = TRUCO_CALLS.index(call)
            if index + 1 < len(TRUCO_CALLS):
                options.append(TRUCO_CALLS[index + 1])
        return self._safe_decide(prompt, options, f"response:{call}")
