"""API REST por turnos del motor de Truco (docs/api-spec.md).

Cada partida corre el bucle del motor en un hilo; los jugadores `web`
deciden vía HTTP mediante WebController, que publica la decisión pendiente
y se bloquea hasta recibir la respuesta validada por esta capa.
"""
from __future__ import annotations

import random
import threading
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple, Union

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from .cards import Card
from .controller import (
    DeterministicMockLLMClient,
    LLMController,
    PlayerController,
    VisibleState,
)
from .engine import ENVIDO_ESCALATION, Match, Player, Team, TRUCO_ESCALATION


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

    def __init__(self, name: str):
        self.name = name
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
                return False
            self._inbox.extend(_Answer(k, v) for k, v in answers)
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
        d = Decision(kind=kind, options=options, call=call, visible=state)
        with self._lock:
            self.pending = d
        try:
            return self._take(kind).value
        finally:
            with self._lock:
                self.pending = None

    # -- PlayerController -------------------------------------------------
    # Menús propios de la fase previa a la 1ª carta (reglas-v2.md)
    FASE_ENVITE_CALLS = {"envido", "flor"}
    FLOR_RESPONSE_OPTIONS = ["con_flor_quiero", "con_flor_me_achico",
                             "contraflor", "contraflor_al_resto"]

    def choose_action(self, state: VisibleState,
                      available_calls: List[str]) -> str:
        if available_calls and set(available_calls) <= self.FASE_ENVITE_CALLS:
            return self._ask("offer", ["paso"] + list(available_calls), state)
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
            options = ["quiero", "no_quiero"] + TRUCO_ESCALATION[idx + 1:]
        elif call in ENVIDO_ESCALATION:
            idx = ENVIDO_ESCALATION.index(call)
            options = ["quiero", "no_quiero"] + ENVIDO_ESCALATION[idx + 1:]
        else:
            options = ["quiero", "no_quiero"]
        return self._ask("response", options, state, call)


# --------------------------------------------------------------- sesiones


class MatchSession:
    def __init__(self, match_id: str, match: Match,
                 web_controllers: Dict[str, WebController]):
        self.id = match_id
        self.match = match
        self.web_controllers = web_controllers
        self.error: Optional[str] = None
        # Señas compañero→compañero (reglas-v2.md §4): entrega única
        self.senas_inbox: Dict[str, Tuple[str, str]] = {}  # receptor -> (de, seña)
        self.senas_lock = threading.Lock()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        try:
            self.match.play_match()
        except Exception as exc:  # noqa: BLE001 - se reporta por /state
            self.error = f"{type(exc).__name__}: {exc}"


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


class CreateMatchRequest(BaseModel):
    mode: str                    # 1v1 | 2v2
    target_score: int = 15
    players: List[PlayerSpec]
    seed: Optional[int] = None


class ActionRequest(BaseModel):
    player: str
    action: Optional[str] = None     # play_card | irse_al_mazo
    call: Optional[str] = None       # truco | retruco | vale_cuatro | envido...
    respond: Optional[str] = None    # quiero | no_quiero | paso | con_flor_...
    card: Optional[CardIn] = None
    tapada: bool = False             # jugar la carta boca abajo (reglas-v2.md)


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
              player_name: Optional[str]) -> dict:
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

    data = {
        "match_id": session.id,
        "target_score": match.target_score,
        "finished": winner is not None or session.error is not None,
        "winner": winner.name if winner else None,
        "error": session.error,
        "teams": [
            {
                "name": t.name,
                "score": t.score,
                "players": [p.name for p in t.players],
            }
            for t in match.teams
        ],
        "mano": match.players[match.mano_index].name if winner is None else None,
        "turn": turn,
        "call_vigente": call_vigente,
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
            if isinstance(p.controller, WebController):
                data["you"]["pending"] = p.controller.snapshot_pending()
        else:
            data["others"].append(entry)
    if you is None:
        data["you"] = None
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
        if req.respond in ("paso", "no_envido"):
            _submit([("offer", "no_envido")])
            return
        if req.respond == "envido" and "envido" in options:
            _submit([("offer", "envido")])
            return
        if req.respond == "flor" and "flor" in options:
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

    web_controllers: Dict[str, WebController] = {}
    players: List[Player] = []
    for i, spec in enumerate(req.players):
        if spec.kind == "web":
            ctrl: PlayerController = WebController(spec.name)
            web_controllers[spec.name] = ctrl
        elif spec.kind == "agent":
            ctrl = LLMController(spec.name, DeterministicMockLLMClient(spec.seed))
        else:
            raise HTTPException(status_code=422,
                                detail=f"kind inválido: {spec.kind} (web|agent)")
        players.append(Player(spec.name, ctrl))

    teams = [Team("Equipo 1", [p for i, p in enumerate(players) if i % 2 == 0]),
             Team("Equipo 2", [p for i, p in enumerate(players) if i % 2 == 1])]
    for p in players:
        p.team = next(t for t in teams if p in t.players)

    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    match = Match(teams, target_score=req.target_score, rng=rng)

    match_id = uuid.uuid4().hex[:12]
    session = MatchSession(match_id, match, web_controllers)
    with _registry_lock:
        _sessions[match_id] = session
    session.thread.start()

    return {"match_id": match_id, "mode": req.mode,
            "target_score": req.target_score,
            "players": names,
            "state": _snapshot(session, names[0])}


@app.get("/matches/{match_id}/state")
def match_state(match_id: str,
                player: Optional[str] = Query(default=None)):
    session = get_session(match_id)
    return _snapshot(session, player)


@app.post("/matches/{match_id}/actions")
def post_action(match_id: str, req: ActionRequest):
    session = get_session(match_id)
    controller = session.web_controllers.get(req.player)
    if controller is None:
        raise HTTPException(status_code=404,
                            detail=f"'{req.player}' no es un jugador web de esta partida")
    _validate_and_push(controller, req)
    # Espera a que el hilo del motor consuma la respuesta para devolver
    # estado fresco (la decisión puede haber cambiado de jugador).
    controller.wait_consumed()
    return _snapshot(session, req.player)


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
    return {"ok": True, "de": req.de, "para": req.para, "sena": req.sena}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
