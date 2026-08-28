"""Motor de reglas v2: reparto, flor/envido oficiales antes de la 1ª carta,
3 bazas con cartas tapadas, escalado de truco, irse al mazo, fin de partida.

Reglas nuevas (docs/reglas-v2.md, fuente bureaudejuegos.com/reglas-truco):
- Flor: 3 cartas del mismo palo; anula el envido; envites flor/contraflor/
  contraflor al resto/con flor quiero/me achico.
- Envido oficial: cadenas acumulativas; no quiero paga lo ya aceptado (min 1);
  falta envido gana el chico en malas o el faltante del líder en buenas;
  cualquier jugador puede cantar; empate lo resuelve el equipo mano.
- Cartas tapadas: pierden contra todas, empatan solo entre sí; su cara no se
  revela a rivales por estado ni prompts.
"""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Tuple

from .cards import Card, beats, full_deck
from .controller import PlayerController, VisibleState
from .envido import best_envido, best_flor, has_flor
from .observability import log_event


logger = logging.getLogger(__name__)

TRUCO_ESCALATION = ["truco", "retruco", "vale_cuatro"]
TRUCO_POINTS = {"truco": 2, "retruco": 3, "vale_cuatro": 4}
ENVIDO_ESCALATION = ["envido", "real_envido", "falta_envido"]
ENVIDO_POINTS = {"envido": 2, "real_envido": 3}

# Puntos de la flor (reglas-v2.md §2)
FLOR_POINTS = 3
CON_FLOR_QUIERO_POINTS = 4
CONTRAFLOR_POINTS = 6
CONTRAFLOR_RECHAZADA_PTS = 4      # contraflor no querida: +4 al contracantante
CONTRAFLOR_RESTO_RECHAZADA_PTS = 6


class IllegalMove(Exception):
    pass


def _cmp_plays(a: Optional[Card], b: Optional[Card]) -> int:
    """Compara dos jugadas de una baza. None = carta boca abajo: pierde contra
    todas y empata solo con otra tapada."""
    if a is None and b is None:
        return 0
    if a is None:
        return -1
    if b is None:
        return 1
    return beats(a, b)


@dataclass
class Team:
    name: str
    players: List[Player] = field(default_factory=list)
    score: int = 0


@dataclass
class Player:
    name: str
    controller: PlayerController
    team: Optional[Team] = None
    hand: List[Card] = field(default_factory=list)
    played: List[Card] = field(default_factory=list)
    face_down: List[bool] = field(default_factory=list)  # paralelo a `played`

    @staticmethod
    def _masked(cards: List[Card], flags: List[bool]) -> List[Optional[Card]]:
        """Las tapadas se ven como None salvo para su dueño."""
        return [c if not fd else None for c, fd in zip(cards, flags)]

    def visible_state(self, match: "Match", pending_call: Optional[str],
                      history: List[str]) -> VisibleState:
        teammate = next((p for p in self.team.players if p is not self), None) if self.team else None
        opponents = [p for p in match.players if p.team != self.team] if self.team else []

        return VisibleState(
            hand_cards=list(self.hand),
            played_by_me=list(self.played),
            played_by_teammate=(self._masked(teammate.played, teammate.face_down)
                                if teammate else None),
            played_by_opponents=[self._masked(p.played, p.face_down) for p in opponents],
            my_team_score=self.team.score if self.team else 0,
            opponent_team_score=match.players[0].team.score if (self.team and match.players[0].team != self.team) else 0,
            pending_call=pending_call,
            call_history=list(history),
        )


class Match:
    """Partida hasta `target_score` (15 o 30 según spec.md). Soporta 1v1 y 2v2."""

    def __init__(self, teams: List[Team],
                 target_score: int = 15, rng: Optional[random.Random] = None,
                 flor_enabled: bool = True,
                 compare_fn: Optional[Callable[[Optional[Card], Optional[Card]], int]] = None,
                 envido_fn: Optional[Callable[[List[Card]], int]] = None):
        if target_score not in (15, 30):
            raise ValueError("target_score debe ser 15 o 30 (spec.md)")
        self.teams = teams
        self.players = []
        for t in teams:
            self.players.extend(t.players)

        self.target_score = target_score
        self.flor_enabled = bool(flor_enabled)
        self.rng = rng or random.Random()
        self.mano_index = 0  # índice del jugador "mano" en self.players
        self.hand_log: List[str] = []
        self.winner_team: Optional[Team] = None  # primero en alcanzar el objetivo
        # Puntos de arbitraje inyectables (docs/llm-engine.md): por default el
        # cálculo determinista de cards.py/envido.py; LLMEngine los reemplaza
        # por equivalentes arbitrados por LLM sin tocar el resto del motor.
        self._compare_plays: Callable[[Optional[Card], Optional[Card]], int] = (
            compare_fn or _cmp_plays)
        self._envido_value: Callable[[List[Card]], int] = envido_fn or best_envido

    def _trace(self, event: str, **fields) -> None:
        log_event(
            logger,
            event,
            match_id=getattr(self, "trace_id", None),
            **fields,
        )

    @property
    def winner(self) -> Optional[Team]:
        if self.winner_team is not None:
            return self.winner_team
        return next((t for t in self.teams if t.score >= self.target_score), None)

    def _award(self, team: Team, points: int) -> None:
        """Suma puntos registrando al primer equipo que alcanza el objetivo."""
        before = team.score
        team.score += points
        self._trace(
            "engine.score.awarded",
            team=team.name,
            points=points,
            before=before,
            after=team.score,
        )
        if self.winner_team is None and team.score >= self.target_score:
            self.winner_team = team

    def play_match(self) -> Team:
        self._trace("engine.match.start", target=self.target_score)
        while self.winner is None:
            self.play_hand()
        self._trace("engine.match.end", winner=self.winner.name)
        return self.winner

    def _deal(self) -> None:
        deck = full_deck()
        self.rng.shuffle(deck)
        for p in self.players:
            p.hand = [deck.pop() for _ in range(3)]
            p.played = []
            p.face_down = []
        self._trace(
            "engine.deal.completed",
            players=len(self.players),
            cards_each=3,
            deck_remaining=len(deck),
        )

    @property
    def mano_team(self) -> Team:
        return self.players[self.mano_index].team

    def _faltante(self, ganador: Team) -> int:
        """Puntos de falta envido / contraflor al resto aceptados.

        En malas (ambos equipos bajo la mitad): gana el chico directo.
        En buenas: el faltante del líder (reglas-v2.md §1).
        """
        mitad = self.target_score / 2
        if all(t.score < mitad for t in self.teams):
            return max(self.target_score - ganador.score, 1)
        lider = max(t.score for t in self.teams)
        return max(self.target_score - lider, 1)

    def play_hand(self) -> None:
        self._trace(
            "engine.hand.start",
            mano=self.players[self.mano_index].name,
            scores=",".join(f"{team.name}:{team.score}" for team in self.teams),
        )
        self._deal()
        self.hand_log = []
        order = list(self.players)
        order = order[self.mano_index:] + order[:self.mano_index]

        truco_points = 1
        truco_level = None
        truco_raise_team: Optional[Team] = None
        folded_by: Optional[Player]
        results: List[Optional[Player]] = []

        # ---- Fase de envites: flor y envido, antes de la primera carta ----
        folded_by = self._resolve_primera_fase(order)
        if folded_by is not None:
            # Irse al mazo antes de cantar/jugar: pierde el truco en juego (1)
            self._settle_fold(folded_by, truco_points=1)
            self._advance_mano()
            self._trace("engine.hand.end", reason="fold_first_phase")
            return
        if self.winner_team is not None:
            # Los envites definieron el chico: la mano termina acá.
            self._advance_mano()
            self._trace("engine.hand.end", reason="envite_match_winner")
            return

        for round_no in range(3):
            if folded_by is not None:
                break

            round_cards: List[Tuple[Player, Optional[Card]]] = []
            self._trace(
                "engine.round.start",
                round=round_no + 1,
                order=",".join(player.name for player in order),
                truco_level=truco_level or "none",
            )
            for p in order:
                action = p.controller.choose_action(
                    p.visible_state(self, None, self.hand_log),
                    self._available_truco_calls(truco_level, p, truco_raise_team),
                )
                self._trace(
                    "engine.player.action",
                    round=round_no + 1,
                    player=p.name,
                    action=action,
                )
                if action == "irse_al_mazo":
                    folded_by = p
                    break
                if action in TRUCO_ESCALATION:
                    pts, lvl, fold_truco, raise_team = self._resolve_truco_call(
                        p, action, truco_level
                    )
                    truco_points = pts
                    truco_level = lvl
                    truco_raise_team = raise_team
                    if fold_truco is not None:
                        folded_by = fold_truco
                        break

                card = p.hand.pop(
                    p.hand.index(p.controller.choose_card(
                        p.visible_state(self, None, self.hand_log)))
                )
                tapada = p.controller.choose_face_down(
                    p.visible_state(self, None, self.hand_log))
                p.played.append(card)
                p.face_down.append(bool(tapada))
                round_cards.append((p, None if tapada else card))
                self._trace(
                    "engine.card.played",
                    round=round_no + 1,
                    player=p.name,
                    face_down=bool(tapada),
                    remaining=len(p.hand),
                )

            if folded_by is not None:
                break

            best_p = self._round_winner(round_cards)
            is_parda = best_p is None
            results.append(best_p)
            self._trace(
                "engine.round.end",
                round=round_no + 1,
                result="parda" if is_parda else "winner",
                winner=best_p.name if best_p else None,
            )

            if not is_parda:
                idx = self.players.index(best_p)
                order = [self.players[(idx + i) % len(self.players)] for i in range(len(self.players))]

            if self._decide_hand_winner(results) is not None:
                break

        if folded_by is not None:
            self._settle_fold(folded_by, truco_points=truco_points)
            reason = "fold"
        else:
            hand_winner = self._decide_hand_winner(results)
            winner_team = hand_winner.team if hand_winner else self.mano_team
            self._award(winner_team, truco_points)
            reason = "bazas"

        self._advance_mano()
        self._trace(
            "engine.hand.end",
            reason=reason,
            scores=",".join(f"{team.name}:{team.score}" for team in self.teams),
        )

    def _decide_hand_winner(self, results: List[Optional[Player]]) -> Optional[Player]:
        if not results:
            return None

        first = results[0]
        if first is not None:
            if len(results) < 2: return None
            second = results[1]
            if second is not None and second.team is first.team: return first
            if second is None: return first
            if len(results) < 3: return None
            third = results[2]
            return first if third is None else third
        else:
            if len(results) < 2: return None
            second = results[1]
            if second is not None: return second
            if len(results) < 3: return None
            third = results[2]
            return third if third is not None else self.players[self.mano_index]

    def _round_winner(
        self, round_cards: List[Tuple[Player, Optional[Card]]]
    ) -> Optional[Player]:
        """Devuelve el ganador de baza o ``None`` cuando empardan los bandos.

        Dos cartas máximas del mismo equipo no producen parda: la igualdad
        relevante es entre equipos contrarios.
        """
        best_card = round_cards[0][1]
        for _, card in round_cards[1:]:
            if self._compare_plays(card, best_card) > 0:
                best_card = card
        top_players = [
            player
            for player, card in round_cards
            if self._compare_plays(card, best_card) == 0
        ]
        winner = top_players[0]
        if any(player.team is not winner.team for player in top_players[1:]):
            return None
        return winner

    # ------------------------------------------------------------ envites

    def _resolve_primera_fase(self, order: List[Player]) -> Optional[Player]:
        """Fase previa a la 1ª carta: cualquier jugador puede cantar envido;
        quien tiene flor puede declararla, lo que anula todo envido
        (pendiente u otorgado en esta fase).

        Devuelve el jugador que se fue al mazo durante la fase, o None.
        """
        envido_award: Optional[Tuple[Team, int]] = None
        envido_called = False
        self._trace(
            "engine.first_phase.start",
            order=",".join(player.name for player in order),
            flor_enabled=self.flor_enabled,
        )
        for p in order:
            player_has_flor = self.flor_enabled and has_flor(p.hand)
            if player_has_flor:
                opts = ["flor"]
            elif not envido_called:
                opts = list(ENVIDO_ESCALATION)
            else:
                continue
            act = p.controller.choose_action(
                p.visible_state(self, None, self.hand_log), opts
            )
            self._trace(
                "engine.first_phase.action",
                player=p.name,
                action=act,
                has_flor=player_has_flor,
            )
            if act == "irse_al_mazo":
                return p
            if player_has_flor:
                # En la variante con flor, declararla es obligatorio.
                self._resolve_flor(p, order)  # anula el envido
                return None
            if act in ENVIDO_ESCALATION and not envido_called:
                envido_called = True
                envido_award = self._resolve_envido_chain(p, act)

        if envido_award is not None:
            team, pts = envido_award
            self._award(team, pts)
        self._trace("engine.first_phase.end", envido_called=envido_called)
        return None

    def _team_best(self, score_fn) -> Team:
        """Mejor equipo según `score_fn`; empate lo resuelve el equipo mano."""
        scores = [(t, score_fn(t)) for t in self.teams]
        top = max(s for _, s in scores)
        candidatos = [t for t, s in scores if s == top]
        return self.mano_team if self.mano_team in candidatos else candidatos[0]

    def _envido_winner(self) -> Team:
        return self._team_best(
            lambda t: max(self._envido_value(p.hand) for p in t.players))

    def _flor_winner(self) -> Team:
        def mejor_flor(t: Team) -> float:
            flores = [best_flor(p.hand) for p in t.players if has_flor(p.hand)]
            return max(flores) if flores else float("-inf")
        return self._team_best(mejor_flor)

    def _resolve_envido_chain(
        self, caller: Player, initial_level: str = "envido"
    ) -> Tuple[Team, int]:
        """Cadena oficial de envido con acumulación (reglas-v2.md §1).

        Cada escalada implica querer el canto vigente: sus puntos quedan
        aceptados. Un `no_quiero` paga solo lo acumulado (mínimo 1).
        Devuelve (equipo_a_pagar, puntos).
        """
        if initial_level not in ENVIDO_ESCALATION:
            raise IllegalMove(f"Envite inicial inválido: {initial_level}")
        accepted = 0
        level = initial_level
        # Solo el envido admite repetirse una vez (envido-envido).
        idx_level = -1 if level == "envido" else ENVIDO_ESCALATION.index(level)
        proposer_team = caller.team
        self.hand_log.append(level)
        self._trace(
            "engine.envido.start",
            caller=caller.name,
            level=level,
        )
        while True:
            opp_team = next(t for t in self.teams if t != proposer_team)
            responder = opp_team.players[0]
            resp = responder.controller.choose_call_response(
                responder.visible_state(self, level, self.hand_log), level
            )
            self._trace(
                "engine.envido.response",
                responder=responder.name,
                level=level,
                response=resp,
                accepted_points=accepted,
            )
            if resp == "quiero":
                # Al querer, cobra quien tenga mejor envido (empate: mano)
                ganador = self._envido_winner()
                if level == "falta_envido":
                    points = self._faltante(ganador)
                else:
                    points = accepted + ENVIDO_POINTS[level]
                self._trace(
                    "engine.envido.end",
                    result="accepted",
                    winner=ganador.name,
                    points=points,
                )
                return ganador, points
            if (resp in ENVIDO_ESCALATION
                    and ENVIDO_ESCALATION.index(resp) > idx_level):
                accepted += ENVIDO_POINTS[level]
                level = resp
                idx_level = ENVIDO_ESCALATION.index(level)
                proposer_team = opp_team
                self.hand_log.append(level)
                continue
            # no_quiero (o respuesta inválida): se cobra lo aceptado, min 1
            points = max(accepted, 1)
            self._trace(
                "engine.envido.end",
                result="rejected",
                winner=proposer_team.name,
                points=points,
            )
            return proposer_team, points

    def _resolve_flor(self, singer: Player, order: List[Player]) -> None:
        """Resolución completa de la flor (reglas-v2.md §2)."""
        self._trace("engine.flor.start", singer=singer.name)
        rival_has_flor = any(has_flor(p.hand) for p in self.players
                             if p.team != singer.team)
        if not rival_has_flor:
            self._award(singer.team, FLOR_POINTS)
            return

        idx = order.index(singer)
        rotated = order[idx + 1:] + order[:idx + 1]
        defender = next(p for p in rotated if p.team != singer.team)

        resp = defender.controller.choose_call_response(
            defender.visible_state(self, "flor", self.hand_log), "flor"
        )
        self._trace(
            "engine.flor.response",
            singer=singer.name,
            defender=defender.name,
            response=resp,
        )
        if resp == "con_flor_quiero":
            self._award(self._flor_winner(), CON_FLOR_QUIERO_POINTS)
        elif resp == "contraflor":
            r = singer.controller.choose_call_response(
                singer.visible_state(self, "contraflor", self.hand_log),
                "contraflor")
            if r == "quiero":
                self._award(self._flor_winner(), CONTRAFLOR_POINTS)
            else:
                self._award(defender.team, CONTRAFLOR_RECHAZADA_PTS)
        elif resp == "contraflor_al_resto":
            r = singer.controller.choose_call_response(
                singer.visible_state(self, "contraflor_al_resto", self.hand_log),
                "contraflor_al_resto")
            if r == "quiero":
                ganador = self._flor_winner()
                self._award(ganador, self._faltante(ganador))
            else:
                self._award(defender.team, CONTRAFLOR_RESTO_RECHAZADA_PTS)
        else:
            # con_flor_me_achico (o respuesta desconocida): canta primero +3
            self._award(singer.team, FLOR_POINTS)

    # -------------------------------------------------------------- truco

    def _available_truco_calls(
        self,
        current_level: Optional[str],
        player: Player,
        raise_team: Optional[Team],
    ) -> List[str]:
        if current_level is None:
            return ["truco"]
        if player.team is not raise_team:
            return []
        idx = TRUCO_ESCALATION.index(current_level)
        if idx + 1 < len(TRUCO_ESCALATION):
            return [TRUCO_ESCALATION[idx + 1]]
        return []

    def _resolve_truco_call(
        self,
        caller: Player,
        call: str,
        current_level: Optional[str],
    ):
        """Resuelve el canto y su escalada (truco → retruco → vale cuatro).

        Devuelve (puntos, nivel_final, fold|None). Un `no_quiero` termina la
        mano otorgando al cantante los puntos del nivel anterior; una
        contracanta (escalada) invierte roles y vuelve a consultar.
        """
        if current_level is None:
            expected = "truco"
        else:
            current_idx = TRUCO_ESCALATION.index(current_level)
            expected = (
                TRUCO_ESCALATION[current_idx + 1]
                if current_idx + 1 < len(TRUCO_ESCALATION)
                else None
            )
        if call != expected:
            raise IllegalMove(f"Escalado de truco inválido: se esperaba {expected}")
        level = call
        proposer = caller
        self.hand_log.append(level)
        self._trace(
            "engine.truco.start",
            caller=caller.name,
            level=level,
            previous=current_level or "none",
        )
        while True:
            opp_team = next(t for t in self.teams if t != proposer.team)
            responder = opp_team.players[0]
            resp = responder.controller.choose_call_response(
                responder.visible_state(self, level, self.hand_log), level
            )
            self._trace(
                "engine.truco.response",
                proposer=proposer.name,
                responder=responder.name,
                level=level,
                response=resp,
            )
            if resp == "quiero":
                idx = TRUCO_ESCALATION.index(level)
                raise_team = responder.team if idx + 1 < len(TRUCO_ESCALATION) else None
                points = TRUCO_POINTS[level]
                self._trace(
                    "engine.truco.end",
                    result="accepted",
                    level=level,
                    points=points,
                )
                return points, level, None, raise_team
            if resp == "no_quiero":
                idx = TRUCO_ESCALATION.index(level)
                prev_points = 1 if idx == 0 else TRUCO_POINTS[TRUCO_ESCALATION[idx - 1]]
                self._trace(
                    "engine.truco.end",
                    result="rejected",
                    level=level,
                    points=prev_points,
                    folded=responder.name,
                )
                return prev_points, level, responder, None
            idx = TRUCO_ESCALATION.index(level)
            next_level = (
                TRUCO_ESCALATION[idx + 1]
                if idx + 1 < len(TRUCO_ESCALATION)
                else None
            )
            if resp != next_level:
                # Respuesta desconocida o salto de nivel: no querida.
                prev_points = 1 if idx == 0 else TRUCO_POINTS[TRUCO_ESCALATION[idx - 1]]
                return prev_points, level, responder, None
            level = resp
            proposer = responder
            self.hand_log.append(level)

    def _settle_fold(self, folded_by: Player, truco_points: int) -> None:
        opp_team = next(t for t in self.teams if t != folded_by.team)
        self._trace(
            "engine.fold",
            player=folded_by.name,
            winner=opp_team.name,
            points=truco_points,
        )
        self._award(opp_team, truco_points)

    def _advance_mano(self) -> None:
        self.mano_index = (self.mano_index + 1) % len(self.players)
        self._trace(
            "engine.mano.advanced",
            next_mano=self.players[self.mano_index].name,
        )
