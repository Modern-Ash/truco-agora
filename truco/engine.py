"""Motor de reglas: reparto, ronda de envido, 3 bazas, escalado de truco,
irse al mazo, fin de partida (spec.md)."""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import List, Optional

from .cards import Card, beats, full_deck
from .controller import PlayerController, VisibleState
from .envido import best_envido

TRUCO_ESCALATION = ["truco", "retruco", "vale_cuatro"]
TRUCO_POINTS = {"truco": 2, "retruco": 3, "vale_cuatro": 4}
ENVIDO_ESCALATION = ["envido", "real_envido", "falta_envido"]
ENVIDO_POINTS = {"envido": 2, "real_envido": 3}


class IllegalMove(Exception):
    pass


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

    def visible_state(self, match: "Match", pending_call: Optional[str],
                       history: List[str]) -> VisibleState:
        teammate = next((p for p in self.team.players if p is not self), None) if self.team else None
        opponents = [p for p in match.players if p.team != self.team] if self.team else []

        return VisibleState(
            hand_cards=list(self.hand),
            played_by_me=list(self.played),
            played_by_teammate=list(teammate.played) if teammate else None,
            played_by_opponents=[list(p.played) for p in opponents],
            my_team_score=self.team.score if self.team else 0,
            opponent_team_score=match.players[0].team.score if (self.team and match.players[0].team != self.team) else 0,
            pending_call=pending_call,
            call_history=list(history),
        )


class Match:
    """Partida hasta `target_score` (15 o 30 según spec.md). Soporta 1v1 y 2v2."""

    def __init__(self, teams: List[Team],
                 target_score: int = 15, rng: Optional[random.Random] = None):
        if target_score not in (15, 30):
            raise ValueError("target_score debe ser 15 o 30 (spec.md)")
        self.teams = teams
        self.players = []
        for t in teams:
            self.players.extend(t.players)

        self.target_score = target_score
        self.rng = rng or random.Random()
        self.mano_index = 0  # índice del jugador "mano" en self.players
        self.hand_log: List[str] = []
        self.winner_team: Optional[Team] = None  # primero en alcanzar el objetivo

    @property
    def winner(self) -> Optional[Team]:
        if self.winner_team is not None:
            return self.winner_team
        return next((t for t in self.teams if t.score >= self.target_score), None)

    def _award(self, team: Team, points: int) -> None:
        """Suma puntos registrando al primer equipo que alcanza el objetivo."""
        team.score += points
        if self.winner_team is None and team.score >= self.target_score:
            self.winner_team = team

    def play_match(self) -> Team:
        while self.winner is None:
            self.play_hand()
        return self.winner

    def _deal(self) -> None:
        deck = full_deck()
        self.rng.shuffle(deck)
        for p in self.players:
            p.hand = [deck.pop() for _ in range(3)]
            p.played = []

    def play_hand(self) -> None:
        self._deal()
        order = list(self.players)
        order = order[self.mano_index:] + order[:self.mano_index]

        truco_points = 1
        truco_level = None
        folded_by: Optional[Player] = None
        envido_resolved = False
        results: List[Optional[Player]] = []

        for round_no in range(3):
            if folded_by is not None:
                break

            if round_no == 0 and not envido_resolved:
                envido_resolved = True
                kind, payload = self._resolve_envido_phase(order)
                if kind == "fold":
                    # Irse al mazo antes de cantar: pierde el truco en juego (1)
                    self._settle_fold(payload, truco_points=1)
                    self._advance_mano()
                    return
                if kind == "rechazado":
                    self._award(payload, 1)
                elif kind == "aceptado":
                    self._award(self._envido_winner(), payload)

            round_cards: List[tuple[Player, Card]] = []
            for p in order:
                action = p.controller.choose_action(
                    p.visible_state(self, None, self.hand_log),
                    self._available_truco_calls(truco_level),
                )
                if action == "irse_al_mazo":
                    folded_by = p
                    break
                if action in TRUCO_ESCALATION:
                    pts, lvl, fold_truco = self._resolve_truco_call(
                        p, action, truco_level
                    )
                    truco_points = pts
                    truco_level = lvl
                    if fold_truco is not None:
                        folded_by = fold_truco
                        break

                card = p.hand.pop(
                    p.hand.index(p.controller.choose_card(
                        p.visible_state(self, None, self.hand_log)))
                )
                p.played.append(card)
                round_cards.append((p, card))

            if folded_by is not None:
                break

            best_p, best_card = round_cards[0]
            for p, card in round_cards[1:]:
                if beats(card, best_card) > 0:
                    best_p, best_card = p, card

            is_parda = any(beats(card, best_card) == 0 for p, card in round_cards if p != best_p)
            results.append(None if is_parda else best_p)

            if not is_parda:
                idx = self.players.index(best_p)
                order = [self.players[(idx + i) % len(self.players)] for i in range(len(self.players))]

            if self._decide_hand_winner(results) is not None:
                break

        if folded_by is not None:
            self._settle_fold(folded_by, truco_points=truco_points)
        else:
            hand_winner = self._decide_hand_winner(results)
            winner_team = hand_winner.team if hand_winner else self.players[self.mano_index].team
            self._award(winner_team, truco_points)

        self._advance_mano()

    def _decide_hand_winner(self, results: List[Optional[Player]]) -> Optional[Player]:
        if not results:
            return None

        first = results[0]
        if first is not None:
            if len(results) < 2: return None
            second = results[1]
            if second is first: return first
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

    def _envido_winner(self) -> Team:
        best_team, max_score = None, -1
        for t in self.teams:
            score = max(best_envido(p.hand) for p in t.players)
            if score > max_score:
                max_score, best_team = score, t
        return best_team

    def _resolve_envido_phase(self, order):
        """Fase de envido (spec.md): solo en la 1ª ronda, antes de jugar cartas.

        Devuelve (kind, payload):
          ("skip", None)             nadie cantó envido
          ("rechazado", team)        el rival no quiso: 1 punto al cantante,
                                     la mano continúa
          ("aceptado", puntos)       se comparan manos vía _envido_winner()
          ("fold", player)           alguien se fue al mazo durante la fase
        """
        caller = order[0]
        act = caller.controller.choose_action(
            caller.visible_state(self, None, self.hand_log), ["envido"]
        )
        if act == "irse_al_mazo":
            return "fold", caller
        if act != "envido":
            return "skip", None

        level = "envido"
        while True:
            opp_team = next(t for t in self.teams if t != caller.team)
            responder = opp_team.players[0]
            resp = responder.controller.choose_call_response(
                responder.visible_state(self, level, self.hand_log), level
            )
            if resp == "no_quiero":
                return "rechazado", caller.team
            if resp == "quiero":
                if level == "falta_envido":
                    lider = max(t.score for t in self.teams)
                    return "aceptado", max(self.target_score - lider, 1)
                return "aceptado", ENVIDO_POINTS[level]
            if (resp in ENVIDO_ESCALATION
                    and ENVIDO_ESCALATION.index(resp) > ENVIDO_ESCALATION.index(level)):
                level = resp
                caller = responder
                continue
            return "aceptado", ENVIDO_POINTS[level]

    def _available_truco_calls(self, current_level: Optional[str]) -> List[str]:
        if current_level is None:
            return ["truco"]
        idx = TRUCO_ESCALATION.index(current_level)
        if idx + 1 < len(TRUCO_ESCALATION):
            return [TRUCO_ESCALATION[idx + 1]]
        return []

    def _resolve_truco_call(self, caller: Player, call: str, current_level: Optional[str]):
        """Resuelve el canto y su escalada (truco → retruco → vale cuatro).

        Devuelve (puntos, nivel_final, fold|None). Un `no_quiero` termina la
        mano otorgando al cantante los puntos del nivel anterior; una
        contracanta (escalada) invierte roles y vuelve a consultar.
        """
        level = call
        proposer = caller
        while True:
            opp_team = next(t for t in self.teams if t != proposer.team)
            responder = opp_team.players[0]
            resp = responder.controller.choose_call_response(
                responder.visible_state(self, level, self.hand_log), level
            )
            if resp == "quiero":
                return TRUCO_POINTS[level], level, None
            if resp == "no_quiero":
                idx = TRUCO_ESCALATION.index(level)
                prev_points = 1 if idx == 0 else TRUCO_POINTS[TRUCO_ESCALATION[idx - 1]]
                return prev_points, level, responder
            level = resp
            proposer = responder

    def _settle_fold(self, folded_by: Player, truco_points: int) -> None:
        opp_team = next(t for t in self.teams if t != folded_by.team)
        self._award(opp_team, truco_points)

    def _advance_mano(self) -> None:
        self.mano_index = (self.mano_index + 1) % len(self.players)
