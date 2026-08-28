"""Modo espectador paso a paso (docs/step-mode.md).

`StepGate` es un torniquete: bloquea hasta que alguien lo abre una vez.
`SteppedController` envuelve cualquier `PlayerController` y espera en el
gate compartido antes de delegar cada decisión — el mismo patrón que
`WebController` usa para pausar el motor a la espera de un humano, pero
acá quien lo destraba es un espectador pidiendo la "siguiente movida" en
vez de un jugador respondiendo.
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, List, Optional

from .cards import Card
from .controller import PlayerController, VisibleState
from .observability import log_event


logger = logging.getLogger(__name__)


class StepGate:
    """Torniquete de un solo paso: `wait()` bloquea hasta el próximo `open()`."""

    def __init__(self, match_id: Optional[str] = None) -> None:
        self._event = threading.Event()
        self.match_id = match_id

    def wait(self, timeout: Optional[float] = None) -> bool:
        started = time.monotonic()
        log_event(
            logger,
            "step_gate.wait.start",
            match_id=self.match_id,
            timeout=timeout,
        )
        opened = self._event.wait(timeout=timeout)
        if opened:
            self._event.clear()
        log_event(
            logger,
            "step_gate.wait.end",
            match_id=self.match_id,
            opened=opened,
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return opened

    def open(self) -> None:
        log_event(logger, "step_gate.open", match_id=self.match_id)
        self._event.set()


@dataclass
class PendingStep:
    player: str
    kind: str  # "action" | "card" | "response" | "face_down"
    call: Optional[str] = None  # canto vigente cuando kind="response"


CALL_ACTIONS = {
    "envido", "real_envido", "falta_envido",
    "truco", "retruco", "vale_cuatro",
    "flor", "contraflor", "contraflor_al_resto",
}


class SteppedController(PlayerController):
    """Envuelve un PlayerController (típicamente LLMController) y bloquea
    en un StepGate compartido antes de cada decisión, publicando qué
    movida está pendiente para que el snapshot la exponga."""

    def __init__(self, name: str, inner: PlayerController, gate: StepGate,
                 on_pending: Callable[[Optional[PendingStep]], None],
                 on_event: Optional[Callable[[dict], None]] = None,
                 match_id: Optional[str] = None):
        self.name = name
        self.match_id = match_id
        self._inner = inner
        self._gate = gate
        self._on_pending = on_pending
        self._on_event = on_event or (lambda _event: None)

    def _await_step(self, kind: str, call: Optional[str] = None) -> None:
        started = time.monotonic()
        log_event(
            logger,
            "stepped_controller.wait.start",
            match_id=self.match_id,
            player=self.name,
            kind=kind,
            call=call,
        )
        self._on_pending(PendingStep(player=self.name, kind=kind, call=call))
        self._gate.wait()
        self._on_pending(None)
        log_event(
            logger,
            "stepped_controller.wait.end",
            match_id=self.match_id,
            player=self.name,
            kind=kind,
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )

    def choose_action(self, state: VisibleState, available_calls: List[str]) -> str:
        self._await_step("action")
        action = self._inner.choose_action(state, available_calls)
        log_event(
            logger,
            "stepped_controller.choice",
            match_id=self.match_id,
            player=self.name,
            kind="action",
            choice=action,
        )
        if action in CALL_ACTIONS:
            self._on_event({"type": "call", "player": self.name, "call": action})
        return action

    def choose_card(self, state: VisibleState) -> Card:
        self._await_step("card")
        card = self._inner.choose_card(state)
        log_event(
            logger,
            "stepped_controller.choice",
            match_id=self.match_id,
            player=self.name,
            kind="card",
            remaining_before=len(state.hand_cards),
        )
        return card

    def choose_call_response(self, state: VisibleState, call: str) -> str:
        self._await_step("response", call=call)
        response = self._inner.choose_call_response(state, call)
        log_event(
            logger,
            "stepped_controller.choice",
            match_id=self.match_id,
            player=self.name,
            kind="response",
            call=call,
            choice=response,
        )
        if response in CALL_ACTIONS:
            self._on_event({
                "type": "call",
                "player": self.name,
                "call": response,
                "responds_to": call,
            })
        else:
            self._on_event({
                "type": "call_response",
                "player": self.name,
                "call": call,
                "response": response,
            })
        return response

    def choose_face_down(self, state: VisibleState) -> bool:
        # No es una "movida" separada desde la perspectiva de un espectador
        # (va pegada a la carta recién elegida en choose_card); se delega
        # directo, sin pausa adicional.
        return self._inner.choose_face_down(state)
