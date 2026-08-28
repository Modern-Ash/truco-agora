import random

from truco.engine import Match, Player, Team
from truco.tests.helpers import ScriptedController


def make_match_1v1(target=15, seed=1):
    p1 = Player("A", ScriptedController())
    p2 = Player("B", ScriptedController())
    t1 = Team("T1", [p1])
    t2 = Team("T2", [p2])
    p1.team, p2.team = t1, t2
    return Match([t1, t2], target_score=target, rng=random.Random(seed)), p1, p2


def make_match_2v2(target=15, seed=1):
    p1 = Player("A1", ScriptedController())
    p2 = Player("B1", ScriptedController())
    p3 = Player("A2", ScriptedController())
    p4 = Player("B2", ScriptedController())
    t1 = Team("T1", [p1, p3])
    t2 = Team("T2", [p2, p4])
    for p in t1.players: p.team = t1
    for p in t2.players: p.team = t2
    match = Match([t1, t2], target_score=target, rng=random.Random(seed))
    match.players = [p1, p2, p3, p4]
    return match, t1, t2


def test_match_ends_when_target_reached():
    match, p1, p2 = make_match_1v1(target=15, seed=42)
    winner = match.play_match()
    assert winner.score >= 15
    assert max(match.teams[0].score, match.teams[1].score) >= 15


def test_no_quiero_on_truco_gives_one_point_to_caller():
    p1 = Player("A", ScriptedController(actions=["no_envido", "truco"]))
    p2 = Player("B", ScriptedController(call_responses=["no_quiero"]))
    t1 = Team("T1", [p1])
    t2 = Team("T2", [p2])
    p1.team, p2.team = t1, t2
    match = Match([t1, t2], target_score=30, rng=random.Random(7))
    match.play_hand()
    assert t1.score == 1
    assert t2.score == 0


def test_quiero_truco_awards_two_points_to_winner_of_hand():
    p1 = Player("A", ScriptedController(actions=["no_envido", "truco"]))
    p2 = Player("B", ScriptedController(call_responses=["quiero"]))
    t1 = Team("T1", [p1])
    t2 = Team("T2", [p2])
    p1.team, p2.team = t1, t2
    match = Match([t1, t2], target_score=30, rng=random.Random(3))
    match.play_hand()
    assert t1.score + t2.score == 2


def test_no_quiero_on_retruco_gives_truco_value_to_caller():
    p1 = Player("A", ScriptedController(actions=["no_envido", "truco"],
                                        call_responses=["no_quiero"]))
    p2 = Player("B", ScriptedController(call_responses=["retruco"]))
    t1 = Team("T1", [p1])
    t2 = Team("T2", [p2])
    p1.team, p2.team = t1, t2
    match = Match([t1, t2], target_score=30, rng=random.Random(11))
    match.play_hand()
    assert t2.score == 2
    assert t1.score == 0


def test_parda_in_first_round_is_decided_by_second_round():
    from truco.cards import Card
    p1 = Player("A", ScriptedController(cards_to_play=[("oro", 12), ("espada", 1)]))
    p2 = Player("B", ScriptedController(cards_to_play=[("copa", 12), ("basto", 4)]))
    t1 = Team("T1", [p1])
    t2 = Team("T2", [p2])
    p1.team, p2.team = t1, t2
    match = Match([t1, t2], target_score=30, rng=random.Random(2))

    def fixed_deal():
        p1.hand = [Card("oro", 12), Card("espada", 1), Card("oro", 4)]
        p2.hand = [Card("copa", 12), Card("basto", 4), Card("copa", 4)]
        p1.played, p2.played = [], []

    match._deal = fixed_deal
    match.play_hand()
    assert t1.score == 1
    assert t2.score == 0


def test_fold_before_hand_resolves_gives_point_to_opponent():
    p1 = Player("A", ScriptedController(actions=["irse_al_mazo"]))
    p2 = Player("B", ScriptedController())
    t1 = Team("T1", [p1])
    t2 = Team("T2", [p2])
    p1.team, p2.team = t1, t2
    match = Match([t1, t2], target_score=30, rng=random.Random(9))
    match.play_hand()
    assert t2.score >= 1
    assert t1.score == 0


def test_mano_alternates_between_hands():
    match, p1, p2 = make_match_1v1(target=30, seed=5)
    assert match.mano_index == 0
    match.play_hand()
    assert match.mano_index == 1
    match.play_hand()
    assert match.mano_index == 0


def test_2v2_turn_rotation():
    match, t1, t2 = make_match_2v2(seed=10)
    # Players: P1 (T1), P2 (T2), P3 (T1), P4 (T2)
    assert match.players[0].team == t1
    assert match.players[1].team == t2
    assert match.players[2].team == t1
    assert match.players[3].team == t2

    assert match.mano_index == 0
    match.play_hand()
    # Rotation should be (0+1)%4 = 1
    assert match.mano_index == 1


def test_2v2_two_teammates_can_win_the_first_two_tricks():
    match, t1, _ = make_match_2v2(seed=10)
    first_teammate, second_teammate = t1.players
    assert match._decide_hand_winner([first_teammate, second_teammate]).team is t1


def test_equal_top_cards_from_same_team_do_not_make_a_trick_parda():
    from truco.cards import Card

    match, t1, t2 = make_match_2v2(seed=10)
    winner = match._round_winner(
        [
            (t1.players[0], Card("oro", 3)),
            (t2.players[0], Card("basto", 2)),
            (t1.players[1], Card("copa", 3)),
            (t2.players[1], Card("espada", 2)),
        ]
    )
    assert winner is not None and winner.team is t1


def test_equal_top_cards_from_opposing_teams_make_a_trick_parda():
    from truco.cards import Card

    match, t1, t2 = make_match_2v2(seed=10)
    winner = match._round_winner(
        [
            (t1.players[0], Card("oro", 3)),
            (t2.players[0], Card("basto", 3)),
            (t1.players[1], Card("copa", 2)),
            (t2.players[1], Card("espada", 2)),
        ]
    )
    assert winner is None


def test_only_team_that_accepted_truco_can_raise_to_retruco():
    match, t1, t2 = make_match_2v2(seed=10)
    assert match._available_truco_calls("truco", t1.players[0], t2) == []
    assert match._available_truco_calls("truco", t2.players[0], t2) == ["retruco"]


def test_gana_quien_alcanza_el_objetivo_primero_en_la_mano():
    from truco.cards import Card

    p1 = Player("A", ScriptedController(actions=["envido", "truco"],
                                        call_responses=["no_quiero"]))
    p2 = Player("B", ScriptedController(call_responses=["quiero", "no_quiero"]))
    t1 = Team("T1", [p1])
    t2 = Team("T2", [p2])
    p1.team, p2.team = t1, t2
    match = Match([t1, t2], target_score=15, rng=random.Random(3))
    t1.score, t2.score = 0, 14  # T2 está a 1 punto de ganar

    def fixed_deal():
        # T2 tiene mejor envido: al querer, cruza los 15 antes del truco
        p1.hand = [Card("oro", 12), Card("copa", 11), Card("basto", 10)]
        p2.hand = [Card("oro", 7), Card("oro", 1), Card("copa", 4)]
        p1.played, p2.played = [], []

    match._deal = fixed_deal
    match.play_hand()
    assert t2.score >= 15
    assert match.winner is t2  # no T1 aunque ganara la mano por truco
