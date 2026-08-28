"""Controlador scripteado para tests determinísticos del engine."""
from __future__ import annotations

from typing import List

from truco.cards import Card
from truco.controller import PlayerController, VisibleState

# Canto que solo aparece en la fase previa a la primera carta (reglas-v2.md)
FASE_ENVITE_CALLS = {"envido", "real_envido", "falta_envido", "flor"}
PASES = {"paso", "no_envido"}


class ScriptedController(PlayerController):
    """Sigue una secuencia de acciones/cartas/respuestas predefinida.
    Si el script se agota, hace la jugada 'segura' por defecto.

    Durante la fase de envites (menú envido/flor) no consume acciones del
    script que corresponden al menú normal: pasa automáticamente, salvo que
    la acción scripteada sea propia de esa fase (envido/flor/paso/irse).
    """

    def __init__(self, actions=None, cards_to_play=None, call_responses=None,
                 face_down_plays=None):
        self._actions = list(actions or [])
        self._cards = list(cards_to_play or [])
        self._responses = list(call_responses or [])
        self._tapadas = list(face_down_plays or [])

    def choose_face_down(self, state: VisibleState) -> bool:
        if self._tapadas:
            return bool(self._tapadas.pop(0))
        return False

    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        if available_calls and set(available_calls) <= FASE_ENVITE_CALLS:
            if self._actions and (self._actions[0] in FASE_ENVITE_CALLS
                                  or self._actions[0] in PASES
                                  or self._actions[0] == "irse_al_mazo"):
                return self._actions.pop(0)
            return "paso"
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
