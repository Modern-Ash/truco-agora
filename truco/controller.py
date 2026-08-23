"""Controladores de jugador: humano (CLI) o agente LLM.

El motor de reglas nunca confía ciegamente en la decisión de un controlador:
toda jugada se valida contra el estado legal antes de aplicarse (ver engine.py).
"""
from __future__ import annotations

import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Protocol

from .cards import Card


@dataclass
class VisibleState:
    """Estado visible para un controlador al momento de decidir.

    Nunca incluye las cartas del rival (solo lo que ya jugó).
    """
    hand_cards: List[Card]
    played_by_me: List[Card]
    played_by_opponent: List[Card]
    my_score: int
    opponent_score: int
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


class LLMClient(Protocol):
    """Interfaz mínima de cliente LLM inyectable (real o mock)."""

    def decide(self, prompt: str, options: List[str]) -> str:
        """Devuelve una de `options` según el prompt de contexto de juego."""
        ...


class DeterministicMockLLMClient:
    """Cliente LLM determinístico para tests: siempre elige la primera opción,
    o usa `seed` para elegir de forma reproducible."""

    def __init__(self, seed: Optional[int] = None):
        self._rng = random.Random(seed)

    def decide(self, prompt: str, options: List[str]) -> str:
        if not options:
            raise ValueError("No hay opciones para decidir")
        return self._rng.choice(options) if self._rng is not None else options[0]


class LLMController(PlayerController):
    """Controlador respaldado por un LLMClient inyectado.

    No recibe nunca las cartas del rival: solo `VisibleState`.
    """

    def __init__(self, name: str, client: LLMClient):
        self.name = name
        self.client = client

    def _prompt(self, state: VisibleState, question: str) -> str:
        return (
            f"Sos {self.name}, jugando al Truco Argentino.\n"
            f"Tu mano: {[str(c) for c in state.hand_cards]}\n"
            f"Jugadas propias: {[str(c) for c in state.played_by_me]}\n"
            f"Jugadas rival: {[str(c) for c in state.played_by_opponent]}\n"
            f"Marcador: vos {state.my_score} - rival {state.opponent_score}\n"
            f"Canto pendiente: {state.pending_call}\n"
            f"{question}"
        )

    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        options = ["jugar"] + available_calls + ["irse_al_mazo"]
        prompt = self._prompt(state, "¿Qué acción hacés?")
        return self.client.decide(prompt, options)

    def choose_card(self, state: VisibleState) -> Card:
        options = [str(i) for i in range(len(state.hand_cards))]
        prompt = self._prompt(state, "¿Qué carta jugás? (índice)")
        choice = self.client.decide(prompt, options)
        try:
            return state.hand_cards[int(choice)]
        except (ValueError, IndexError):
            return state.hand_cards[0]

    def choose_call_response(self, state: VisibleState, call: str) -> str:
        prompt = self._prompt(state, f"¿Cómo respondés al canto '{call}'?")
        return self.client.decide(prompt, ["quiero", "no_quiero"])
