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
# Puntos si se acepta ("quiero") cada canto. Si se rechaza, se otorgan los
# puntos del nivel anterior (1 para "no quiero" a truco, ya que la mano sin
# cantos vale 1 punto base). Validado contra bureaudejuegos.com y wikipedia.
TRUCO_POINTS = {"truco": 2, "retruco": 3, "vale_cuatro": 4}
ENVIDO_POINTS = {"envido": 2, "real_envido": 3}


class IllegalMove(Exception):
    pass


@dataclass
class Player:
    name: str
    controller: PlayerController
    score: int = 0
    hand: List[Card] = field(default_factory=list)
    played: List[Card] = field(default_factory=list)

    def visible_state(self, opponent: "Player", pending_call: Optional[str],
                       history: List[str]) -> VisibleState:
        return VisibleState(
            hand_cards=list(self.hand),
            played_by_me=list(self.played),
            played_by_opponent=list(opponent.played),
            my_score=self.score,
            opponent_score=opponent.score,
            pending_call=pending_call,
            call_history=list(history),
        )


class Match:
    """Partida 1v1 hasta `target_score` (15 o 30 según spec.md)."""

    def __init__(self, player_a: Player, player_b: Player,
                 target_score: int = 15, rng: Optional[random.Random] = None):
        if target_score not in (15, 30):
            raise ValueError("target_score debe ser 15 o 30 (spec.md)")
        self.players = [player_a, player_b]
        self.target_score = target_score
        self.rng = rng or random.Random()
        self.mano_index = 0  # índice del jugador "mano" en self.players
        self.hand_log: List[str] = []

    @property
    def winner(self) -> Optional[Player]:
        for p in self.players:
            if p.score >= self.target_score:
                return p
        return None

    def play_match(self) -> Player:
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
        mano = self.players[self.mano_index]
        pie = self.players[1 - self.mano_index]
        order = [mano, pie]

        truco_points = 1
        truco_level = None  # None | "truco" | "retruco" | "vale_cuatro"
        folded_by: Optional[Player] = None
        envido_resolved = False

        # Resultado de cada ronda jugada: mano, pie, o None (parda).
        results: List[Optional[Player]] = []

        for round_no in range(3):
            if folded_by is not None:
                break

            # Fase de envido solo antes de la primera carta de la 1ra ronda.
            if round_no == 0 and not envido_resolved:
                envido_points, folded_by = self._resolve_envido(mano, pie)
                envido_resolved = True
                if folded_by is not None:
                    winner = pie if folded_by is mano else mano
                    winner.score += envido_points
                    self._settle_fold(folded_by, truco_points=1, envido_pending=False)
                    self._advance_mano()
                    return
                if envido_points:
                    winner_env = self._envido_winner(mano, pie)
                    winner_env.score += envido_points

            first, second = order
            action = first.controller.choose_action(
                first.visible_state(second, None, self.hand_log),
                self._available_truco_calls(truco_level),
            )
            if action == "irse_al_mazo":
                folded_by = first
                break
            if action in TRUCO_ESCALATION:
                truco_points, truco_level, folded_by = self._resolve_truco_call(
                    first, second, action, truco_level
                )
                if folded_by is not None:
                    break

            card_a = first.hand.pop(
                first.hand.index(first.controller.choose_card(
                    first.visible_state(second, None, self.hand_log)))
            )
            first.played.append(card_a)
            card_b = second.hand.pop(
                second.hand.index(second.controller.choose_card(
                    second.visible_state(first, None, self.hand_log)))
            )
            second.played.append(card_b)

            cmp = beats(card_a, card_b)
            if cmp > 0:
                results.append(first)
                order = [first, second]
            elif cmp < 0:
                results.append(second)
                order = [second, first]
            else:
                results.append(None)  # parda: mantiene el orden actual

            if self._decide_hand_winner(results, mano, pie) is not None:
                break

        if folded_by is not None:
            self._settle_fold(folded_by, truco_points=truco_points,
                               envido_pending=False)
        else:
            hand_winner = self._decide_hand_winner(results, mano, pie)
            (hand_winner or mano).score += truco_points

        self._advance_mano()

    def _decide_hand_winner(self, results: List[Optional[Player]],
                             mano: Player, pie: Player) -> Optional[Player]:
        """Determina si la mano ya está decidida con las rondas jugadas
        hasta ahora, aplicando la regla real de parda (spec.md):
        - Gana quien gane 2 rondas seguidas, o quien ganó la ronda previa
          a una parda posterior (la parda "hereda" el resultado anterior).
        - Si la primera ronda es parda, decide la segunda (si no es parda);
          si también empata, decide la tercera; si las tres empatan, gana
          la mano.
        - Si la primera ronda tiene ganador y la segunda es parda, gana
          quien ganó la primera.
        - Si la primera y la segunda las gana cada uno, decide la tercera;
          si la tercera también empata, gana quien ganó la primera ronda.
        """
        if not results:
            return None

        first = results[0]
        if first is not None:
            if len(results) < 2:
                return None
            second = results[1]
            if second is first:
                return first  # 2 rondas seguidas
            if second is None:
                return first  # parda hereda el resultado anterior
            # segunda la ganó el otro: define la tercera
            if len(results) < 3:
                return None
            third = results[2]
            return first if third is None else third
        else:
            # primera ronda parda
            if len(results) < 2:
                return None
            second = results[1]
            if second is not None:
                return second
            if len(results) < 3:
                return None
            third = results[2]
            return third if third is not None else mano

    def _envido_winner(self, mano: Player, pie: Player) -> Player:
        env_mano = best_envido(mano.hand)
        env_pie = best_envido(pie.hand)
        # En empate de envido gana la mano.
        return mano if env_mano >= env_pie else pie

    def _resolve_envido(self, mano: Player, pie: Player):
        """Devuelve (puntos_otorgados, jugador_que_dijo_no_quiero_o_None)."""
        state_mano = mano.visible_state(pie, None, self.hand_log)
        calls = ["envido", "real_envido"]
        action = mano.controller.choose_action(state_mano, calls)
        if action not in calls:
            return 0, None

        level = action
        points = ENVIDO_POINTS[level]
        while True:
            responder = pie
            resp = responder.controller.choose_call_response(
                responder.visible_state(mano, level, self.hand_log), level
            )
            if resp == "no_quiero":
                return 1, responder
            if resp == "quiero":
                return points, None
            if resp in ENVIDO_POINTS and resp != level:
                level = resp
                points = ENVIDO_POINTS[level]
                mano, pie = pie, mano  # el que escaló ahora espera respuesta
                continue
            return points, None

    def _available_truco_calls(self, current_level: Optional[str]) -> List[str]:
        if current_level is None:
            return ["truco"]
        idx = TRUCO_ESCALATION.index(current_level)
        if idx + 1 < len(TRUCO_ESCALATION):
            return [TRUCO_ESCALATION[idx + 1]]
        return []

    def _resolve_truco_call(self, caller: Player, responder: Player,
                             call: str, current_level: Optional[str]):
        level = call
        while True:
            resp = responder.controller.choose_call_response(
                responder.visible_state(caller, level, self.hand_log), level
            )
            if resp == "no_quiero":
                prev_idx = TRUCO_ESCALATION.index(level) - 1
                prev_points = 1 if prev_idx < 0 else TRUCO_POINTS[TRUCO_ESCALATION[prev_idx]]
                return prev_points, level, responder
            if resp == "quiero":
                return TRUCO_POINTS[level], level, None
            if resp in TRUCO_ESCALATION and resp != level:
                idx = TRUCO_ESCALATION.index(resp)
                if idx != TRUCO_ESCALATION.index(level) + 1:
                    raise IllegalMove(f"Escalada inválida: {level} -> {resp}")
                caller, responder = responder, caller
                level = resp
                continue
            raise IllegalMove(f"Respuesta inválida a {level}: {resp}")

    def _settle_fold(self, folded_by: Player, truco_points: int,
                      envido_pending: bool) -> None:
        winner = self.players[0] if folded_by is self.players[1] else self.players[1]
        winner.score += truco_points

    def _advance_mano(self) -> None:
        self.mano_index = 1 - self.mano_index
