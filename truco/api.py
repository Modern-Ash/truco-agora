"""API REST por turnos del motor de Truco (docs/api-spec.md).

Cada partida corre el bucle del motor en un hilo; los jugadores `web`
deciden vía HTTP mediante WebController, que publica la decisión pendiente
y se bloquea hasta recibir la respuesta validada por esta capa.
"""
from __future__ import annotations

import logging
import random
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Literal, Optional, Tuple, Union

from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel

from .cards import Card
from .controller import (
    DeterministicMockLLMClient,
    LLMController,
    PlayerController,
    VisibleState,
)
from .engine import ENVIDO_ESCALATION, Match, Player, Team, TRUCO_ESCALATION
from .llm_engine import LLMEngine
from .llm_providers import build_llm_client, discover_models
from .observability import configure_logging, log_event
from .step_mode import PendingStep, StepGate, SteppedController


configure_logging()
logger = logging.getLogger(__name__)
SESSION_RECOVERY_ATTEMPTS = 3
SESSION_RECOVERY_DELAY_SECONDS = 0.15


# ---------------------------------------------------------------- controlador


@dataclass
class Decision:
    """Decisión pendiente publicada para un jugador web."""
    kind: str                      # offer | action | card | response
    options: List[str]
    call: Optional[str]            # canto al que se responde (kind=response)
    visible: Optional[VisibleState] = None
    event: threading.Event = field(default_factory=threading.Event)


@dataclass
class _Answer:
    kind: str
    value: Union[str, Card, Tuple["Card", bool]]


class WebController(PlayerController):
    """Controlador de jugador web: expone la decisión pendiente y consume
    respuestas empujadas atómicamente por la capa HTTP."""

    def __init__(self, name: str, match_id: Optional[str] = None):
        self.name = name
        self.match_id = match_id
        self._lock = threading.Lock()
        self._inbox: Deque[_Answer] = deque()
        self.pending: Optional[Decision] = None

    # -- API interna ------------------------------------------------------
    def snapshot_pending(self) -> Optional[dict]:
        with self._lock:
            if self.pending is None:
                return None
            d = self.pending
            return {"decision": d.kind, "options": list(d.options),
                    "call": d.call}

    def peek_hand(self) -> List[Card]:
        """Cartas de la decisión pendiente vigente (validación HTTP)."""
        with self._lock:
            if self.pending is None:
                return []
            return list(self.pending.visible.hand_cards)

    def submit(self, answers: List[Tuple[str, Union[str, Card]]]) -> bool:
        """Empuja respuestas solo si hay decisión pendiente y sin cola."""
        with self._lock:
            if self.pending is None or self._inbox:
                log_event(
                    logger,
                    "web_controller.submit.rejected",
                    severity=logging.WARNING,
                    match_id=self.match_id,
                    player=self.name,
                    pending=self.pending.kind if self.pending else None,
                    inbox=len(self._inbox),
                )
                return False
            self._inbox.extend(_Answer(k, v) for k, v in answers)
            log_event(
                logger,
                "web_controller.submit.accepted",
                match_id=self.match_id,
                player=self.name,
                answers=",".join(kind for kind, _value in answers),
            )
            return True

    def wait_consumed(self, timeout: float = 2.0) -> bool:
        """Espera a que el motor consuma las respuestas encoladas."""
        import time as _time

        deadline = _time.monotonic() + timeout
        while _time.monotonic() < deadline:
            with self._lock:
                if not self._inbox:
                    return True
            threading.Event().wait(timeout=0.002)
        return False

    def _take(self, kind: str) -> _Answer:
        while True:
            with self._lock:
                if self._inbox and self._inbox[0].kind == kind:
                    return self._inbox.popleft()
            threading.Event().wait(timeout=0.005)

    def _ask(self, kind: str, options: List[str], state: VisibleState,
             call: Optional[str] = None):
        started = time.monotonic()
        d = Decision(kind=kind, options=options, call=call, visible=state)
        with self._lock:
            self.pending = d
        log_event(
            logger,
            "web_controller.pending",
            match_id=self.match_id,
            player=self.name,
            kind=kind,
            call=call,
            options=",".join(options),
        )
        try:
            value = self._take(kind).value
            log_event(
                logger,
                "web_controller.resolved",
                match_id=self.match_id,
                player=self.name,
                kind=kind,
                # Una carta elegida es información privada hasta que el motor
                # publica el evento de mesa. Los cantos sí pueden identificarse.
                choice="card_selected" if kind == "card" else value,
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return value
        finally:
            with self._lock:
                self.pending = None

    # -- PlayerController -------------------------------------------------
    # Menús propios de la fase previa a la 1ª carta (reglas-v2.md)
    FASE_ENVITE_CALLS = {"envido", "real_envido", "falta_envido", "flor"}
    FLOR_RESPONSE_OPTIONS = ["con_flor_quiero", "con_flor_me_achico",
                             "contraflor", "contraflor_al_resto"]

    def choose_action(self, state: VisibleState,
                      available_calls: List[str]) -> str:
        if available_calls and set(available_calls) <= self.FASE_ENVITE_CALLS:
            options = list(available_calls)
            if options != ["flor"]:
                options = ["paso"] + options
            return self._ask("offer", options, state)
        options = ["jugar"] + list(available_calls) + ["irse_al_mazo"]
        return self._ask("action", options, state)

    def choose_card(self, state: VisibleState) -> Card:
        value = self._take("card").value
        if isinstance(value, tuple):
            card, tapada = value
            self._next_face_down = bool(tapada)
            return card
        return value

    def choose_face_down(self, state: VisibleState) -> bool:
        flag = getattr(self, "_next_face_down", False)
        self._next_face_down = False
        return flag

    def choose_call_response(self, state: VisibleState, call: str) -> str:
        if call == "flor":
            options = list(self.FLOR_RESPONSE_OPTIONS)
        elif call in ("contraflor", "contraflor_al_resto"):
            options = ["quiero", "no_quiero"]
        elif call in TRUCO_ESCALATION:
            idx = TRUCO_ESCALATION.index(call)
            options = ["quiero", "no_quiero"] + TRUCO_ESCALATION[idx + 1:idx + 2]
        elif call in ENVIDO_ESCALATION:
            idx = ENVIDO_ESCALATION.index(call)
            repeated = ["envido"] if call == "envido" and state.call_history.count("envido") < 2 else []
            options = ["quiero", "no_quiero"] + repeated + ENVIDO_ESCALATION[idx + 1:]
        else:
            options = ["quiero", "no_quiero"]
        return self._ask("response", options, state, call)


# --------------------------------------------------------------- sesiones


class MatchSession:
    def __init__(self, match_id: str, match: Match,
                 web_controllers: Dict[str, WebController],
                 step_gate: Optional[StepGate] = None,
                 agent_configs: Optional[Dict[str, dict]] = None,
                 engine_config: Optional[dict] = None,
                 team_bluff_levels: Optional[List[str]] = None):
        self.id = match_id
        self.match = match
        self.web_controllers = web_controllers
        self.error: Optional[str] = None
        self.recovering = False
        self.recovery_error: Optional[str] = None
        # Señas compañero→compañero (reglas-v2.md §4): entrega única
        self.senas_inbox: Dict[str, Tuple[str, str]] = {}  # receptor -> (de, seña)
        self.senas_lock = threading.Lock()
        # Modo paso a paso (docs/step-mode.md): None si la partida no lo usa.
        self.step_gate = step_gate
        self.agent_configs = agent_configs or {}
        self.engine_config = engine_config or {"kind": "deterministic"}
        self.team_bluff_levels = list(team_bluff_levels) if team_bluff_levels else None
        self.started_at = time.time()
        self._progress_lock = threading.Lock()
        self._last_progress_at = time.monotonic()
        self._last_progress_event = "session.created"
        self._pending_since: Optional[float] = None
        self.pending_step: Optional[PendingStep] = None
        # Se incrementa en cada transición de pending_step (incluso si el
        # contenido nuevo es idéntico al anterior, ej. el mismo jugador
        # elige carta en dos rondas distintas) — comparar por contenido
        # llevaría a no detectar el cambio y esperar hasta el timeout.
        self._step_generation = 0
        self._step_lock = threading.Lock()
        self._table_event_generation = 0
        self._table_event_lock = threading.Lock()
        self._table_events: Deque[dict] = deque(maxlen=24)
        self._last_agent_decision: Optional[dict] = None
        self._snapshot_log_lock = threading.Lock()
        self._snapshot_log_signatures: Dict[str, tuple] = {}
        self.thread = threading.Thread(
            target=self._run,
            daemon=True,
            name=f"match-{match_id}",
        )

    def record_progress(self, event: str, **fields) -> None:
        with self._progress_lock:
            self._last_progress_at = time.monotonic()
            self._last_progress_event = event
        log_event(logger, event, match_id=self.id, **fields)

    def set_pending_step(self, step: Optional[PendingStep]) -> None:
        with self._step_lock:
            self.pending_step = step
            self._step_generation += 1
            self._pending_since = time.monotonic() if step is not None else None
            generation = self._step_generation
        self.record_progress(
            "step.pending" if step is not None else "step.pending.cleared",
            generation=generation,
            player=step.player if step else None,
            kind=step.kind if step else None,
            call=step.call if step else None,
        )

    def snapshot_pending_step(self) -> Optional[dict]:
        with self._step_lock:
            if self.pending_step is None:
                return None
            snapshot = {
                "player": self.pending_step.player,
                "kind": self.pending_step.kind,
            }
            if self.pending_step.call is not None:
                snapshot["call"] = self.pending_step.call
            return snapshot

    def step_generation(self) -> int:
        with self._step_lock:
            return self._step_generation

    def record_table_event(self, event: dict) -> None:
        """Conserva cantos y respuestas aunque el polling no vea el instante.

        `call_vigente` describe sólo la espera actual. Este registro monotónico
        representa lo que efectivamente ocurrió en la mesa y permite que un
        espectador entienda la secuencia aun con autoplay rápido.
        """
        with self._table_event_lock:
            self._table_event_generation += 1
            recorded = {"id": self._table_event_generation, **event}
            self._table_events.append(recorded)
            if event.get("type") == "agent_decision":
                self._last_agent_decision = dict(recorded)
            event_id = self._table_event_generation
        self.record_progress(
            "table.event",
            event_id=event_id,
            type=event.get("type"),
            player=event.get("player"),
            call=event.get("call"),
            response=event.get("response"),
        )

    def snapshot_table_events(self) -> List[dict]:
        with self._table_event_lock:
            return [dict(event) for event in self._table_events]

    def snapshot_last_agent_decision(self) -> Optional[dict]:
        with self._table_event_lock:
            return (
                dict(self._last_agent_decision)
                if self._last_agent_decision is not None else None
            )

    def should_log_snapshot(self, viewer: str, signature: tuple) -> bool:
        """Evita repetir el mismo snapshot en cada poll del navegador."""
        with self._snapshot_log_lock:
            if self._snapshot_log_signatures.get(viewer) == signature:
                return False
            self._snapshot_log_signatures[viewer] = signature
            return True

    def diagnostics(self) -> dict:
        now = time.monotonic()
        with self._progress_lock:
            last_progress_age = now - self._last_progress_at
            last_progress_event = self._last_progress_event
        with self._step_lock:
            pending = None
            if self.pending_step is not None:
                pending = {
                    "player": self.pending_step.player,
                    "kind": self.pending_step.kind,
                }
                if self.pending_step.call is not None:
                    pending["call"] = self.pending_step.call
            pending_age = (
                now - self._pending_since
                if pending is not None and self._pending_since is not None
                else None
            )
            generation = self._step_generation
        return {
            "match_id": self.id,
            "thread_alive": self.thread.is_alive(),
            "thread_name": self.thread.name,
            "uptime_seconds": round(time.time() - self.started_at, 3),
            "pending_step": pending,
            "pending_age_seconds": round(pending_age, 3) if pending_age is not None else None,
            "step_generation": generation,
            "last_progress_event": last_progress_event,
            "last_progress_age_seconds": round(last_progress_age, 3),
            "recovering": self.recovering,
            "recovery_error": self.recovery_error,
            "error": self.error,
            "winner": getattr(self.match.winner, "name", None),
        }

    def _run(self) -> None:
        consecutive_failures = 0
        hand_number = 0
        self.record_progress("match.thread.started")
        while self.match.winner is None:
            hand_number += 1
            players = getattr(self.match, "players", ())
            mano_index = getattr(self.match, "mano_index", 0)
            mano = (
                getattr(players[mano_index], "name", None)
                if players and 0 <= mano_index < len(players)
                else None
            )
            self.record_progress(
                "match.hand.start",
                hand=hand_number,
                mano=mano,
            )
            try:
                self.match.play_hand()
            except Exception as exc:  # noqa: BLE001 - frontera del hilo de sesión
                consecutive_failures += 1
                detail = f"{type(exc).__name__}: {exc}"
                self.recovery_error = detail
                self.recovering = True
                if self.step_gate is not None:
                    self.set_pending_step(None)
                # Se registra después de limpiar el paso para que el último
                # progreso no quede oculto por "step.pending.cleared".
                self.record_progress(
                    "match.hand.error",
                    hand=hand_number,
                    failure=consecutive_failures,
                    error_type=type(exc).__name__,
                    error=str(exc),
                )
                logger.warning(
                    "Partida %s: mano fallida (%s/%s), reintentando: %s",
                    self.id,
                    consecutive_failures,
                    SESSION_RECOVERY_ATTEMPTS,
                    detail,
                )
                if consecutive_failures >= SESSION_RECOVERY_ATTEMPTS:
                    self.error = detail
                    self.recovering = False
                    self.record_progress(
                        "match.failed",
                        hand=hand_number,
                        error=detail,
                        failures=consecutive_failures,
                    )
                    return
                threading.Event().wait(
                    timeout=SESSION_RECOVERY_DELAY_SECONDS * consecutive_failures
                )
            else:
                consecutive_failures = 0
                self.recovering = False
                self.recovery_error = None
                self.record_progress(
                    "match.hand.completed",
                    hand=hand_number,
                    scores=",".join(
                        f"{team.name}:{team.score}"
                        for team in getattr(self.match, "teams", ())
                    ),
                )

        self.recovering = False
        self.record_progress(
            "match.completed",
            winner=getattr(self.match.winner, "name", None),
            hands=hand_number,
        )


_sessions: Dict[str, MatchSession] = {}
_registry_lock = threading.Lock()


def get_session(match_id: str) -> MatchSession:
    with _registry_lock:
        session = _sessions.get(match_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Partida inexistente")
    return session


# ------------------------------------------------------------ modelos HTTP


class CardIn(BaseModel):
    palo: str
    numero: int


class PlayerSpec(BaseModel):
    name: str
    kind: str = "web"            # web | agent
    seed: Optional[int] = None
    provider: str = "mock"       # mock | claude | codex | opencode | ollama
    model: Optional[str] = None
    # None permite distinguir un perfil individual de uno heredado del equipo.
    bluff_level: Optional[str] = None  # cauteloso | equilibrado | mentiroso (solo agent)


class CreateMatchRequest(BaseModel):
    mode: str                    # 1v1 | 2v2
    target_score: int = 15
    players: List[PlayerSpec]
    seed: Optional[int] = None
    engine: str = "llm"          # llm (default, docs/llm-engine.md) | deterministic
    engine_provider: str = "mock"   # proveedor LLM para el motor (no para jugadores)
    engine_model: Optional[str] = None
    step_mode: bool = False      # docs/step-mode.md; requiere todos los jugadores kind=agent
    team_names: Optional[List[str]] = None  # 2 nombres; si falta, "Equipo 1"/"Equipo 2"
    team_bluff_levels: Optional[List[str]] = None  # solo 2v2; equipo par/impar
    flor_enabled: bool = False       # variante ASART usual sin flor por default


class ActionRequest(BaseModel):
    player: str
    action: Optional[str] = None     # play_card | irse_al_mazo
    call: Optional[str] = None       # truco | retruco | vale_cuatro | envido...
    respond: Optional[str] = None    # quiero | no_quiero | paso | con_flor_...
    card: Optional[CardIn] = None
    tapada: bool = False             # jugar la carta boca abajo (reglas-v2.md)


class StepRequest(BaseModel):
    source: Literal["manual", "autoplay"] = "manual"


class SenaRequest(BaseModel):
    de: str
    para: str
    sena: str


SENAS_VALIDAS = ["guiño", "lengua", "ceja", "beso", "suspiro"]


# ------------------------------------------------------------- snapshots


def _card_out(card: Card) -> dict:
    return {"palo": card.palo, "numero": card.numero}


def _played_out(p: Player, reveal: bool) -> List[dict]:
    """Cartas jugadas; las tapadas se ocultan salvo para su dueño."""
    out: List[dict] = []
    for card, tapada in zip(p.played, p.face_down):
        if tapada and not reveal:
            out.append({"tapada": True})
        else:
            out.append(_card_out(card))
    return out


def _snapshot(session: MatchSession,
              player_name: Optional[str],
              reveal_agent_hands: bool = False) -> dict:
    match = session.match
    you: Optional[Player] = None
    if player_name is not None:
        you = next((p for p in match.players if p.name == player_name), None)
        if you is None:
            raise HTTPException(status_code=404, detail="Jugador inexistente")

    winner = match.winner
    # Información pública: quién debe decidir y qué canto está vigente.
    turn: Optional[str] = None
    call_vigente: Optional[str] = None
    for p in match.players:
        ctrl = p.controller
        if isinstance(ctrl, WebController):
            snap = ctrl.snapshot_pending()
            if snap is not None:
                turn = p.name
                if snap["decision"] == "offer":
                    opts = snap.get("options") or []
                    call_vigente = ("flor" if "flor" in opts
                                    and "envido" not in opts else "envido")
                else:
                    call_vigente = snap.get("call")
                break

    pending_step = session.snapshot_pending_step()
    if turn is None and pending_step is not None:
        turn = pending_step["player"]
    if call_vigente is None and pending_step is not None:
        call_vigente = pending_step.get("call")

    data = {
        "match_id": session.id,
        "target_score": match.target_score,
        "flor_enabled": match.flor_enabled,
        "finished": winner is not None or session.error is not None,
        "winner": winner.name if winner else None,
        "error": session.error,
        "recovering": session.recovering,
        "recovery_error": session.recovery_error if session.recovering else None,
        "pending_step": pending_step,
        "step_generation": session.step_generation(),
        "step_mode": session.step_gate is not None,
        "picardia_scope": "team" if session.team_bluff_levels else "player",
        "engine_config": dict(session.engine_config),
        "teams": [
            {
                "name": t.name,
                "score": t.score,
                "players": [p.name for p in t.players],
                **(
                    {"bluff_level": session.team_bluff_levels[index]}
                    if session.team_bluff_levels else {}
                ),
            }
            for index, t in enumerate(match.teams)
        ],
        "mano": match.players[match.mano_index].name if winner is None else None,
        "turn": turn,
        "call_vigente": call_vigente,
        "table_events": session.snapshot_table_events(),
        "last_agent_decision": session.snapshot_last_agent_decision(),
        "others": [],
    }

    # Entrega única de señas (reglas-v2.md §4): se consume al leerse.
    sena_recibida = None
    if you is not None:
        with session.senas_lock:
            sena_recibida = session.senas_inbox.pop(you.name, None)

    for p in match.players:
        entry = {
            "name": p.name,
            "team": p.team.name,
            "played": _played_out(p, reveal=p is you),
        }
        agent_config = session.agent_configs.get(p.name)
        if agent_config is not None:
            entry["agent"] = dict(agent_config)
        if reveal_agent_hands:
            entry["hand"] = [_card_out(c) for c in p.hand]
        if p is you:
            data["you"] = {
                "name": p.name,
                "team": p.team.name,
                "hand": [_card_out(c) for c in p.hand],
                "played": _played_out(p, reveal=True),
                "sena_recibida": (
                    {"de": sena_recibida[0], "sena": sena_recibida[1]}
                    if sena_recibida else None),
                "pending": None,
            }
            if agent_config is not None:
                data["you"]["agent"] = dict(agent_config)
            if isinstance(p.controller, WebController):
                data["you"]["pending"] = p.controller.snapshot_pending()
        else:
            data["others"].append(entry)
    if you is None:
        data["you"] = None
    own_pending = data.get("you", {}).get("pending") if data.get("you") else None
    viewer = f"{player_name or 'spectator'}:{int(reveal_agent_hands)}"
    signature = (
        data["finished"], turn, call_vigente,
        own_pending.get("decision") if own_pending else None,
        data["step_generation"], len(data["table_events"]),
    )
    if session.should_log_snapshot(viewer, signature):
        log_event(
            logger,
            "state.snapshot.changed",
            severity=logging.DEBUG,
            match_id=session.id,
            viewer=player_name or "spectator",
            spectator=reveal_agent_hands,
            finished=data["finished"],
            turn=turn,
            call=call_vigente,
            pending_kind=own_pending.get("decision") if own_pending else None,
            step_generation=data["step_generation"],
            table_event_count=len(data["table_events"]),
        )
    return data


# -------------------------------------------------------------- validación


def _escalation_options(call: str) -> List[str]:
    if call in TRUCO_ESCALATION:
        return TRUCO_ESCALATION[TRUCO_ESCALATION.index(call) + 1:]
    if call in ENVIDO_ESCALATION:
        return ENVIDO_ESCALATION[ENVIDO_ESCALATION.index(call) + 1:]
    return []


def _validate_and_push(controller: WebController, req: ActionRequest) -> None:
    pend = controller.snapshot_pending()
    if pend is None:
        raise HTTPException(status_code=409,
                            detail=f"{controller.name} no tiene decisión pendiente")
    kind, options, call = pend["decision"], pend["options"], pend["call"]

    provided = sum(x is not None for x in (req.action, req.call, req.respond))
    if provided > 1:
        raise HTTPException(status_code=422,
                            detail="Enviar solo uno de: action, call, respond")

    def _submit(answers):
        if not controller.submit(answers):
            raise HTTPException(status_code=409,
                                detail="Decisión ya resuelta; reintentá con el estado actual")

    if kind == "response":
        if not req.respond:
            raise HTTPException(status_code=422,
                detail=f"Se esperaba responder a '{call}' (opciones: {options})")
        if req.respond not in options:
            raise HTTPException(status_code=422,
                                detail=f"Respuesta inválida para '{call}': "
                                       f"{req.respond} (válidas: {options})")
        _submit([("response", req.respond)])
        return

    if kind == "offer":
        offer = req.respond or req.call
        if offer in ("paso", "no_envido"):
            _submit([("offer", "no_envido")])
            return
        if offer in ENVIDO_ESCALATION and offer in options:
            _submit([("offer", offer)])
            return
        if offer == "flor" and "flor" in options:
            _submit([("offer", "flor")])
            return
        if req.action == "play_card":
            card = _validated_card(req.card, controller)
            # declina envites y juega carta (decisiones encadenadas)
            _submit([("offer", "no_envido"),
                     ("action", "jugar"),
                     ("card", (card, req.tapada))])
            return
        if req.call == "irse_al_mazo":
            _submit([("offer", "irse_al_mazo")])
            return
        raise HTTPException(status_code=422,
                            detail=f"Oferta vigente; opciones: {options}")

    if kind == "action":
        if req.action == "play_card":
            card = _validated_card(req.card, controller)
            _submit([("action", "jugar"), ("card", (card, req.tapada))])
            return
        if req.action == "irse_al_mazo":
            _submit([("action", "irse_al_mazo")])
            return
        if req.call:
            if req.call not in options:
                raise HTTPException(status_code=422,
                                    detail=f"Canto inválido ahora: {req.call} "
                                           f"(válidos: {options})")
            _submit([("action", req.call)])
            return
        raise HTTPException(status_code=422,
                            detail=f"Se esperaba una acción (opciones: {options})")

    raise HTTPException(status_code=422, detail=f"Decisión desconocida: {kind}")


def _validated_card(card_in: Optional[CardIn], controller: WebController) -> Card:
    if card_in is None:
        raise HTTPException(status_code=422,
                            detail="play_card requiere 'card': {palo, numero}")
    for c in controller.peek_hand():
        if c.palo == card_in.palo and c.numero == card_in.numero:
            return c
    raise HTTPException(status_code=422,
                        detail=f"Carta {card_in.numero} de {card_in.palo} "
                               f"no está en la mano")


# ------------------------------------------------------------------- app

app = FastAPI(title="Truco Argentino API", version="0.1.0")


@app.middleware("http")
async def trace_http_request(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:10]
    started = time.monotonic()
    state_poll = (
        request.method == "GET"
        and request.url.path.startswith("/matches/")
        and request.url.path.endswith("/state")
    )
    if not state_poll:
        log_event(
            logger,
            "http.request.start",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )
    try:
        response = await call_next(request)
    except Exception as exc:
        log_event(
            logger,
            "http.request.error",
            severity=logging.ERROR,
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            error_type=type(exc).__name__,
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        raise
    response.headers["X-Request-ID"] = request_id
    duration_ms = round((time.monotonic() - started) * 1000, 1)
    if not state_poll or response.status_code >= 400 or duration_ms >= 250:
        log_event(
            logger,
            "http.state.poll" if state_poll else "http.request.end",
            severity=logging.WARNING if response.status_code >= 400 else logging.INFO,
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
    return response


@app.get("/llm/models")
def llm_models(provider: str = Query(...)):
    try:
        return discover_models(provider)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/matches", status_code=201)
def create_match(req: CreateMatchRequest):
    expected = 2 if req.mode == "1v1" else 4 if req.mode == "2v2" else None
    if expected is None:
        raise HTTPException(status_code=422, detail="mode debe ser 1v1 o 2v2")
    if len(req.players) != expected:
        raise HTTPException(status_code=422,
                            detail=f"{req.mode} requiere {expected} jugadores")
    if req.target_score not in (15, 30):
        raise HTTPException(status_code=422, detail="target_score debe ser 15 o 30")
    names = [p.name for p in req.players]
    if len(set(names)) != len(names):
        raise HTTPException(status_code=422, detail="Nombres duplicados")
    match_id = uuid.uuid4().hex[:12]
    log_event(
        logger,
        "match.create.requested",
        match_id=match_id,
        mode=req.mode,
        target=req.target_score,
        engine=req.engine,
        players=",".join(names),
        step_mode=req.step_mode,
    )

    if req.step_mode and any(spec.kind != "agent" for spec in req.players):
        raise HTTPException(
            status_code=422,
            detail="step_mode requiere que todos los jugadores sean kind=agent",
        )

    if req.team_bluff_levels is not None:
        if req.mode != "2v2":
            raise HTTPException(
                status_code=422,
                detail="team_bluff_levels solo está disponible en partidas 2v2",
            )
        if len(req.team_bluff_levels) != 2:
            raise HTTPException(
                status_code=422,
                detail="team_bluff_levels requiere exactamente dos niveles",
            )
        invalid_team_level = next(
            (level for level in req.team_bluff_levels
             if level not in LLMController.BLUFF_LEVELS),
            None,
        )
        if invalid_team_level is not None:
            raise HTTPException(
                status_code=422,
                detail=f"bluff_level de equipo inválido: {invalid_team_level} "
                       f"(válidos: {LLMController.BLUFF_LEVELS})",
            )

    # Ollama necesita un tag realmente instalado. Dejar ``model=None`` hacía
    # que el cliente probara "llama3" aunque /api/tags no lo publicara y la
    # primera decisión terminara en HTTP 404. Se valida antes de repartir para
    # que una configuración inválida nunca llegue al hilo de la partida.
    ollama_models: Optional[List[str]] = None
    ollama_uses = [
        (f"jugador {spec.name}", spec.model)
        for spec in req.players
        if spec.kind == "agent" and spec.provider == "ollama"
    ]
    if req.engine == "llm" and req.engine_provider == "ollama":
        ollama_uses.append(("motor de reglas", req.engine_model))
    if ollama_uses:
        catalog = discover_models("ollama")
        ollama_models = catalog.get("models") or []
        if not catalog.get("available") or not ollama_models:
            raise HTTPException(
                status_code=422,
                detail="Ollama no está disponible o no tiene modelos instalados.",
            )
        for role, model in ollama_uses:
            if not model:
                raise HTTPException(
                    status_code=422,
                    detail=f"{role}: elegí un modelo instalado de Ollama.",
                )
            if model not in ollama_models:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"{role}: el modelo Ollama {model!r} no está instalado. "
                        f"Disponibles: {', '.join(ollama_models)}"
                    ),
                )

    step_gate = StepGate(match_id=match_id) if req.step_mode else None
    # session no existe todavía en este punto (se crea después de armar los
    # equipos), pero SteppedController necesita publicar en ella; se resuelve
    # con este holder, asignado en cuanto la sesión se construye más abajo.
    session_holder: Dict[str, Optional["MatchSession"]] = {"session": None}

    def _publish_pending_step(step: Optional[PendingStep]) -> None:
        session = session_holder["session"]
        if session is not None:
            session.set_pending_step(step)

    def _publish_table_event(event: dict) -> None:
        session = session_holder["session"]
        if session is not None:
            session.record_table_event(event)

    web_controllers: Dict[str, WebController] = {}
    agent_configs: Dict[str, dict] = {}
    players: List[Player] = []
    for i, spec in enumerate(req.players):
        if spec.kind == "web":
            ctrl: PlayerController = WebController(spec.name, match_id=match_id)
            web_controllers[spec.name] = ctrl
        elif spec.kind == "agent":
            inherited_bluff_level = (
                req.team_bluff_levels[i % 2]
                if req.team_bluff_levels is not None else None
            )
            resolved_bluff_level = (
                spec.bluff_level or inherited_bluff_level or "equilibrado"
            )
            if resolved_bluff_level not in LLMController.BLUFF_LEVELS:
                raise HTTPException(
                    status_code=422,
                    detail=f"bluff_level inválido: {resolved_bluff_level} "
                           f"(válidos: {LLMController.BLUFF_LEVELS})",
                )
            agent_configs[spec.name] = {
                "provider": spec.provider,
                "model": spec.model,
                "bluff_level": resolved_bluff_level,
                "bluff_scope": (
                    "player" if spec.bluff_level is not None
                    else "team" if inherited_bluff_level is not None
                    else "default"
                ),
            }
            if spec.provider == "mock":
                llm_client = DeterministicMockLLMClient(spec.seed)
            else:
                try:
                    llm_client = build_llm_client(spec.provider, model=spec.model)
                except ValueError as exc:
                    raise HTTPException(status_code=422, detail=str(exc)) from exc
            ctrl = LLMController(
                spec.name,
                llm_client,
                bluff_level=resolved_bluff_level,
                match_id=match_id,
            )
            if step_gate is not None:
                ctrl = SteppedController(
                    spec.name,
                    ctrl,
                    step_gate,
                    _publish_pending_step,
                    _publish_table_event,
                    match_id=match_id,
                )
        else:
            raise HTTPException(status_code=422,
                                detail=f"kind inválido: {spec.kind} (web|agent)")
        players.append(Player(spec.name, ctrl))

    if req.mode == "1v1":
        # Cada lado está compuesto por una sola persona. Usar una colectividad
        # adicional (Patagonia, Salta, etc.) duplica y confunde la identidad
        # visible en mesa/marcador.
        team_a_name, team_b_name = names
    else:
        team_a_name, team_b_name = "Equipo 1", "Equipo 2"
    if req.mode == "2v2" and req.team_names and len(req.team_names) == 2:
        team_a_name, team_b_name = req.team_names
    teams = [Team(team_a_name, [p for i, p in enumerate(players) if i % 2 == 0]),
             Team(team_b_name, [p for i, p in enumerate(players) if i % 2 == 1])]
    for p in players:
        p.team = next(t for t in teams if p in t.players)

    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    engine_config = {"kind": req.engine}
    if req.engine == "llm":
        engine_config.update({
            "provider": req.engine_provider,
            "model": req.engine_model,
        })
        try:
            engine_client = build_llm_client(req.engine_provider, model=req.engine_model)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        match = LLMEngine(teams, target_score=req.target_score, rng=rng,
                          client=engine_client, flor_enabled=req.flor_enabled)
    elif req.engine == "deterministic":
        match = Match(
            teams,
            target_score=req.target_score,
            rng=rng,
            flor_enabled=req.flor_enabled,
        )
    else:
        raise HTTPException(status_code=422,
                            detail=f"engine debe ser 'llm' o 'deterministic': {req.engine!r}")

    match.trace_id = match_id
    session = MatchSession(
        match_id,
        match,
        web_controllers,
        step_gate=step_gate,
        agent_configs=agent_configs,
        engine_config=engine_config,
        team_bluff_levels=req.team_bluff_levels,
    )
    session_holder["session"] = session
    with _registry_lock:
        _sessions[match_id] = session
    log_event(
        logger,
        "match.created",
        match_id=match_id,
        agents=len(agent_configs),
        web_players=len(web_controllers),
        step_mode=step_gate is not None,
    )
    session.thread.start()

    return {"match_id": match_id, "mode": req.mode,
            "target_score": req.target_score,
            "flor_enabled": req.flor_enabled,
            "picardia_scope": "team" if req.team_bluff_levels else "player",
            "players": names,
            "state": _snapshot(session, names[0])}


@app.get("/matches/{match_id}/state")
def match_state(match_id: str,
                player: Optional[str] = Query(default=None),
                spectator: bool = Query(default=False)):
    session = get_session(match_id)
    if spectator and session.web_controllers:
        raise HTTPException(
            status_code=403,
            detail="La vista con manos visibles requiere una partida 100% agente",
        )
    return _snapshot(session, player, reveal_agent_hands=spectator)


@app.get("/matches/{match_id}/diagnostics")
def match_diagnostics(match_id: str):
    """Metadatos operativos seguros para diagnosticar esperas y bloqueos."""
    session = get_session(match_id)
    diagnostic = session.diagnostics()
    log_event(
        logger,
        "match.diagnostics.read",
        match_id=match_id,
        thread_alive=diagnostic["thread_alive"],
        pending=diagnostic["pending_step"],
        last_progress=diagnostic["last_progress_event"],
    )
    return diagnostic


@app.post("/matches/{match_id}/actions")
def post_action(match_id: str, req: ActionRequest):
    session = get_session(match_id)
    log_event(
        logger,
        "http.action.received",
        match_id=match_id,
        player=req.player,
        action=req.action,
        call=req.call,
        respond=req.respond,
        tapada=req.tapada,
    )
    controller = session.web_controllers.get(req.player)
    if controller is None:
        raise HTTPException(status_code=404,
                            detail=f"'{req.player}' no es un jugador web de esta partida")
    _validate_and_push(controller, req)
    # Espera a que el hilo del motor consuma la respuesta para devolver
    # estado fresco (la decisión puede haber cambiado de jugador).
    consumed = controller.wait_consumed()
    log_event(
        logger,
        "http.action.consumed",
        severity=logging.INFO if consumed else logging.WARNING,
        match_id=match_id,
        player=req.player,
        consumed=consumed,
    )
    return _snapshot(session, req.player)


def _wait_for_step_resolution(session: MatchSession, before_generation: int,
                               timeout: float = 60.0) -> bool:
    """Espera a que la movida liberada se aplique y se publique la siguiente.

    Al abrir el gate, ``SteppedController`` primero retira el pending actual y
    recién después consulta al LLM/aplica la decisión. Esperar solo un cambio
    de generación devolvía el snapshot en ese estado intermedio: la carta aún
    no estaba en ``played`` y ``pending_step`` era ``None``. El espectador veía
    siluetas vacías aunque el autoplay estuviera avanzando.

    La siguiente decisión no se publica hasta que la anterior quedó aplicada,
    por eso esperamos una generación nueva *y* un pending no nulo (salvo fin o
    error). `timeout` cubre proveedores LLM reales lentos.
    """
    import time as _time

    started = _time.monotonic()
    deadline = started + timeout
    log_event(
        logger,
        "step.resolution.wait.start",
        match_id=session.id,
        generation=before_generation,
        timeout=timeout,
    )
    while _time.monotonic() < deadline:
        next_step = session.snapshot_pending_step()
        if (session.match.winner is not None or session.error is not None):
            log_event(
                logger,
                "step.resolution.wait.end",
                match_id=session.id,
                result="terminal",
                duration_ms=round((_time.monotonic() - started) * 1000, 1),
            )
            return True
        if session.step_generation() != before_generation and next_step is not None:
            log_event(
                logger,
                "step.resolution.wait.end",
                match_id=session.id,
                result="next_pending",
                next_player=next_step.get("player"),
                next_kind=next_step.get("kind"),
                generation=session.step_generation(),
                duration_ms=round((_time.monotonic() - started) * 1000, 1),
            )
            return True
        threading.Event().wait(timeout=0.02)
    log_event(
        logger,
        "step.resolution.wait.timeout",
        severity=logging.ERROR,
        match_id=session.id,
        generation=before_generation,
        current_generation=session.step_generation(),
        pending=session.snapshot_pending_step(),
        duration_ms=round((_time.monotonic() - started) * 1000, 1),
    )
    return False


@app.post("/matches/{match_id}/step")
def post_step(match_id: str, req: Optional[StepRequest] = None):
    session = get_session(match_id)
    if session.step_gate is None:
        raise HTTPException(status_code=422,
                            detail="Esta partida no está en modo paso a paso")
    if session.snapshot_pending_step() is None:
        raise HTTPException(status_code=404,
                            detail="No hay ninguna movida pendiente ahora mismo")
    before_generation = session.step_generation()
    pending = session.snapshot_pending_step()
    source = req.source if req is not None else "manual"
    session.record_progress(
        "step.requested",
        source=source,
        generation=before_generation,
        player=pending.get("player") if pending else None,
        kind=pending.get("kind") if pending else None,
    )
    session.step_gate.open()
    resolved = _wait_for_step_resolution(session, before_generation)
    session.record_progress(
        "step.request.completed" if resolved else "step.request.timeout",
        source=source,
        generation=session.step_generation(),
    )
    return _snapshot(session, None, reveal_agent_hands=True)


@app.post("/matches/{match_id}/senas", status_code=201)
def post_sena(match_id: str, req: SenaRequest):
    """Señas efímeras compañero→compañero (reglas-v2.md §4).

    Se entregan una sola vez: aparecen en el próximo GET /state del
    receptor (campo `you.sena_recibida`) y se eliminan.
    """
    session = get_session(match_id)
    teams = {p.name: p.team.name for p in session.match.players}
    if req.de not in teams or req.para not in teams:
        raise HTTPException(status_code=404, detail="Jugador inexistente")
    if teams[req.de] != teams[req.para]:
        raise HTTPException(status_code=422,
                            detail="Las señas son solo entre compañeros de equipo")
    if req.de == req.para:
        raise HTTPException(status_code=422,
                            detail="No te podés mandar una seña a vos mismo")
    if req.sena not in SENAS_VALIDAS:
        raise HTTPException(status_code=422,
                            detail=f"Seña inválida (válidas: {SENAS_VALIDAS})")
    with session.senas_lock:
        session.senas_inbox[req.para] = (req.de, req.sena)
    log_event(
        logger,
        "signal.sent",
        match_id=match_id,
        sender=req.de,
        receiver=req.para,
        signal=req.sena,
    )
    return {"ok": True, "de": req.de, "para": req.para, "sena": req.sena}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000, access_log=False)
