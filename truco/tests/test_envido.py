from truco.cards import Card
from truco.envido import best_envido


def test_two_same_suit_sums_plus_twenty():
    cards = [Card("oro", 7), Card("oro", 4), Card("copa", 12)]
    assert best_envido(cards) == 31  # 7+4+20


def test_no_pair_returns_highest_single_value():
    cards = [Card("oro", 5), Card("copa", 3), Card("espada", 12)]
    assert best_envido(cards) == 5


def test_figures_are_zero_for_envido():
    cards = [Card("oro", 10), Card("copa", 11), Card("espada", 12)]
    assert best_envido(cards) == 0


def test_three_same_suit_uses_two_highest():
    cards = [Card("basto", 7), Card("basto", 6), Card("basto", 2)]
    assert best_envido(cards) == 33  # 7+6+20
