"""Modo espectador paso a paso (docs/step-mode.md).

`StepGate` es un torniquete: bloquea hasta que alguien lo abre una vez.
`SteppedController` envuelve cualquier `PlayerController` y espera en el
gate compartido antes de delegar cada decisión — el mismo patrón que
`WebController` usa para pausar el motor a la espera de un humano, pero
acá quien lo destraba es un espectador pidiendo la "siguiente movida" en
vez de un jugador respondiendo.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import List, Optional

from .cards import Card
from .controller import PlayerController, VisibleState


class StepGate:
    """Torniquete de un solo paso: `wait()` bloquea hasta el próximo `open()`."""

    def __init__(self) -> None:
        self._event = threading.Event()

    def wait(self, timeout: Optional[float] = None) -> bool:
        opened = self._event.wait(timeout=timeout)
        if opened:
            self._event.clear()
        return opened

    def open(self) -> None:
        self._event.set()


@dataclass
class PendingStep:
    player: str
    kind: str  # "action" | "card" | "response" | "face_down"


class SteppedController(PlayerController):
    """Envuelve un PlayerController (típicamente LLMController) y bloquea
    en un StepGate compartido antes de cada decisión, publicando qué
    movida está pendiente para que el snapshot la exponga."""

    def __init__(self, name: str, inner: PlayerController, gate: StepGate,
                 on_pending: "callable[[Optional[PendingStep]], None]"):
        self.name = name
        self._inner = inner
        self._gate = gate
        self._on_pending = on_pending

    def _await_step(self, kind: str) -> None:
        self._on_pending(PendingStep(player=self.name, kind=kind))
        self._gate.wait()
        self._on_pending(None)

    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        self._await_step("action")
        return self._inner.choose_action(state, available_calls)

    def choose_card(self, state: VisibleState) -> Card:
        self._await_step("card")
        return self._inner.choose_card(state)

    def choose_call_response(self, state: VisibleState, call: str) -> str:
        self._await_step("response")
        return self._inner.choose_call_response(state, call)

    def choose_face_down(self, state: VisibleState) -> bool:
        # No es una "movida" separada desde la perspectiva de un espectador
        # (va pegada a la carta recién elegida en choose_card); se delega
        # directo, sin pausa adicional.
        return self._inner.choose_face_down(state)
