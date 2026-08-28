from truco.cards import Card, beats, full_deck


def test_full_deck_has_40_cards():
    deck = full_deck()
    assert len(deck) == 40
    assert len(set(deck)) == 40  # sin duplicados


def test_ranking_ancho_espada_is_top():
    ancho_espada = Card("espada", 1)
    ancho_basto = Card("basto", 1)
    assert beats(ancho_espada, ancho_basto) > 0
    for palo, numero in [("oro", 12), ("copa", 4), ("basto", 7)]:
        assert beats(ancho_espada, Card(palo, numero)) > 0


def test_ranking_siete_espada_beats_siete_oro():
    assert beats(Card("espada", 7), Card("oro", 7)) > 0


def test_tie_between_same_number_different_suit_is_parda():
    # Dentro del mismo número (salvo casos especiales), distinto palo empata.
    assert beats(Card("copa", 12), Card("oro", 12)) == 0
    assert beats(Card("basto", 4), Card("copa", 4)) == 0


def test_figure_beats_number_low_card():
    assert beats(Card("oro", 12), Card("copa", 4)) > 0


def test_figures_beat_false_sevens_in_official_order():
    for figure in (12, 11, 10):
        for false_seven_suit in ("basto", "copa"):
            assert beats(Card("oro", figure), Card(false_seven_suit, 7)) > 0


def test_complete_truco_hierarchy_boundaries():
    ordered = [
        Card("espada", 1),
        Card("basto", 1),
        Card("espada", 7),
        Card("oro", 7),
        Card("copa", 3),
        Card("oro", 2),
        Card("copa", 1),
        Card("basto", 12),
        Card("espada", 11),
        Card("oro", 10),
        Card("copa", 7),
        Card("basto", 6),
        Card("oro", 5),
        Card("espada", 4),
    ]
    assert all(beats(high, low) > 0 for high, low in zip(ordered, ordered[1:]))
