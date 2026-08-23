import random

from truco.engine import Match, Player
from truco.tests.helpers import ScriptedController


def make_match(target=15, seed=1):
    a = Player("A", ScriptedController())
    b = Player("B", ScriptedController())
    return Match(a, b, target_score=target, rng=random.Random(seed)), a, b


def test_match_ends_when_target_reached():
    match, a, b = make_match(target=15, seed=42)
    winner = match.play_match()
    assert winner in (a, b)
    assert winner.score >= 15
    assert max(a.score, b.score) >= 15


def test_no_quiero_on_truco_gives_one_point_to_caller():
    a = Player("A", ScriptedController(actions=["no_envido", "truco"]))
    b = Player("B", ScriptedController(call_responses=["no_quiero"]))
    match = Match(a, b, target_score=30, rng=random.Random(7))
    match.play_hand()
    assert a.score == 1
    assert b.score == 0


def test_quiero_truco_awards_two_points_to_winner_of_hand():
    a = Player("A", ScriptedController(actions=["no_envido", "truco"]))
    b = Player("B", ScriptedController(call_responses=["quiero"]))
    match = Match(a, b, target_score=30, rng=random.Random(3))
    match.play_hand()
    assert a.score + b.score == 2  # Truco querido vale 2 (spec.md)


def test_no_quiero_on_retruco_gives_truco_value_to_caller():
    # A y B llegan a retruco; B no quiere -> A cobra el valor del truco (2).
    a = Player("A", ScriptedController(actions=["no_envido", "truco"],
                                        call_responses=["no_quiero"]))
    b = Player("B", ScriptedController(call_responses=["retruco"]))
    match = Match(a, b, target_score=30, rng=random.Random(11))
    match.play_hand()
    assert b.score == 2
    assert a.score == 0


def test_parda_in_first_round_is_decided_by_second_round():
    from truco.cards import Card
    a = Player("A", ScriptedController(cards_to_play=[("oro", 12), ("espada", 1)]))
    b = Player("B", ScriptedController(cards_to_play=[("copa", 12), ("basto", 4)]))
    match = Match(a, b, target_score=30, rng=random.Random(2))

    def fixed_deal():
        a.hand = [Card("oro", 12), Card("espada", 1), Card("oro", 4)]
        b.hand = [Card("copa", 12), Card("basto", 4), Card("copa", 4)]
        a.played, b.played = [], []

    match._deal = fixed_deal
    match.play_hand()
    # 1ra ronda parda (12=12), 2da la gana A (as de espada) -> A gana la mano.
    assert a.score == 1
    assert b.score == 0


def test_fold_before_hand_resolves_gives_point_to_opponent():
    a = Player("A", ScriptedController(actions=["irse_al_mazo"]))
    b = Player("B", ScriptedController())
    match = Match(a, b, target_score=30, rng=random.Random(9))
    match.play_hand()
    assert b.score >= 1
    assert a.score == 0


def test_mano_alternates_between_hands():
    match, a, b = make_match(target=30, seed=5)
    assert match.mano_index == 0
    match.play_hand()
    assert match.mano_index == 1
    match.play_hand()
    assert match.mano_index == 0
