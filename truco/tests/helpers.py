"""Controlador scripteado para tests determinísticos del engine."""
from __future__ import annotations

from typing import List

from truco.cards import Card
from truco.controller import PlayerController, VisibleState


class ScriptedController(PlayerController):
    """Sigue una secuencia de acciones/cartas/respuestas predefinida.
    Si el script se agota, hace la jugada 'segura' por defecto."""

    def __init__(self, actions=None, cards_to_play=None, call_responses=None):
        self._actions = list(actions or [])
        self._cards = list(cards_to_play or [])
        self._responses = list(call_responses or [])

    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        if self._actions:
            return self._actions.pop(0)
        return "jugar"

    def choose_card(self, state: VisibleState) -> Card:
        if self._cards:
            wanted = self._cards.pop(0)
            for c in state.hand_cards:
                if (c.palo, c.numero) == wanted:
                    return c
        return state.hand_cards[0]

    def choose_call_response(self, state: VisibleState, call: str) -> str:
        if self._responses:
            return self._responses.pop(0)
        return "no_quiero"
