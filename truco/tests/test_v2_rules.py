"""Tests de reglas v2 (docs/reglas-v2.md): envido oficial, flor, tapadas.

Fuente de puntos: bureaudejuegos.com/reglas-truco.
Truco de determinismo: se deja al equipo cobrador a N puntos del objetivo;
al querer/cantar el envite alcanza el chico y la partida termina sin jugar
trucos, así los puntajes son exactos.
"""
from __future__ import annotations

import random

from truco.cards import Card
from truco.engine import Match, Player, Team, _cmp_plays
from truco.envido import best_flor, has_flor
from truco.tests.helpers import ScriptedController


def make_1v1(*, actions_a=None, actions_b=None, resp_a=None, resp_b=None,
             tap_a=None, tap_b=None, cards_a=None, cards_b=None,
             score=(0, 0), target=15, seed=1):
    p1 = Player("A", ScriptedController(actions=actions_a,
                                        call_responses=resp_a,
                                        face_down_plays=tap_a,
                                        cards_to_play=cards_a))
    p2 = Player("B", ScriptedController(actions=actions_b,
                                        call_responses=resp_b,
                                        face_down_plays=tap_b,
                                        cards_to_play=cards_b))
    t1, t2 = Team("T1", [p1]), Team("T2", [p2])
    p1.team, p2.team = t1, t2
    m = Match([t1, t2], target_score=target, rng=random.Random(seed))
    t1.score, t2.score = score
    return m, t1, t2, p1, p2


def deal(m, hand_a, hand_b):
    def fixed():
        m.players[0].hand = list(hand_a)
        m.players[1].hand = list(hand_b)
        for p in m.players:
            p.played, p.face_down = [], []
    m._deal = fixed


# Fuerza de cartas (rank): espada1>basto1>espada7>oro7>3s>2s>1 falsos>
# 7 falsos>12s>11s>10s>6s>5s>4s. Envido: mismo palo suma +20.

# ------------------------------------------------------------------ envido

def test_envido_simple_quiero_paga_2_al_mejor():
    m, t1, t2, *_ = make_1v1(score=(0, 13), actions_a=["envido"],
                             resp_b=["quiero"])
    deal(m, [Card("oro", 6), Card("copa", 5), Card("basto", 4)],   # 6
            [Card("basto", 7), Card("oro", 5), Card("copa", 4)])   # 7
    m.play_match()
    assert t2.score == 15 and m.winner is t2


def test_envido_envido_no_quiero_paga_2():
    # A canta; B re-canta envido (quiere el primero); A no quiere: B cobra 2
    m, t1, t2, *_ = make_1v1(score=(0, 13), actions_a=["envido"],
                             resp_b=["envido"], resp_a=["no_quiero"])
    m.play_match()
    assert t2.score == 15 and m.winner is t2


def test_envido_envido_quiero_paga_4():
    m, t1, t2, *_ = make_1v1(score=(0, 11), actions_a=["envido"],
                             resp_b=["envido"], resp_a=["quiero"])
    deal(m, [Card("oro", 6), Card("copa", 5), Card("basto", 4)],   # 6
            [Card("oro", 7), Card("oro", 2), Card("copa", 12)])    # 9
    m.play_match()
    assert t2.score == 15 and m.winner is t2


def test_envido_real_quiero_paga_5_y_no_quiero_2():
    m, t1, t2, *_ = make_1v1(score=(0, 13), actions_a=["envido"],
                             resp_b=["real_envido"], resp_a=["no_quiero"])
    m.play_match()
    assert t2.score == 15 and m.winner is t2

    m, t1, t2, *_ = make_1v1(score=(0, 10), actions_a=["envido"],
                             resp_b=["real_envido"], resp_a=["quiero"])
    deal(m, [Card("oro", 6), Card("copa", 5), Card("basto", 4)],   # 6
            [Card("oro", 7), Card("oro", 2), Card("copa", 12)])    # 9
    m.play_match()
    assert t2.score == 15 and m.winner is t2


def test_envido_envido_real_paga_7_querido_y_4_rechazado():
    # A canta E; B re-canta E; A re-canta R; B quiere → 2+2+3 = 7
    m, t1, t2, *_ = make_1v1(score=(8, 0), actions_a=["envido"],
                             resp_b=["envido"], resp_a=["real_envido"])
    m.players[1].controller._responses = ["quiero"]
    deal(m, [Card("espada", 7), Card("espada", 2), Card("copa", 12)],  # 9
            [Card("oro", 7), Card("oro", 2), Card("basto", 12)])       # 9 empate→mano T1
    m.play_match()
    assert t1.score == 15 and m.winner is t1

    # igual cadena pero B rechaza la R: cobra solo E+E = 4
    m, t1, t2, *_ = make_1v1(score=(0, 11), actions_a=["envido"],
                             resp_b=["envido"], resp_a=["real_envido"])
    m.players[1].controller._responses = ["no_quiero"]
    m.play_match()
    assert t2.score == 15 and m.winner is t2


def test_falta_envido_tras_envido_rechazado_cobra_lo_acumulado():
    # A canta E; B escala falta_envido; A no quiere: B cobra E (2)
    m, t1, t2, *_ = make_1v1(score=(0, 13), actions_a=["envido"],
                             resp_b=["falta_envido"], resp_a=["no_quiero"])
    m.play_match()
    assert t2.score == 15 and m.winner is t2


def test_falta_envido_malas_gana_el_chico():
    m, t1, t2, *_ = make_1v1(score=(5, 4), target=30,
                             actions_a=["envido"], resp_b=["falta_envido"],
                             resp_a=["quiero"])
    deal(m, [Card("oro", 6), Card("copa", 5), Card("basto", 4)],   # 11
            [Card("oro", 7), Card("oro", 2), Card("copa", 12)])    # 29
    m.play_match()
    assert t2.score == 30          # malas: se lleva el chico directo
    assert m.winner is t2


def test_falta_envido_buenas_faltante_del_lider():
    m, t1, t2, *_ = make_1v1(score=(16, 18), target=30,
                             actions_a=["envido"], resp_b=["falta_envido"],
                             resp_a=["quiero"])
    deal(m, [Card("oro", 7), Card("oro", 2), Card("copa", 11)],   # 29 (A va 16)
            [Card("oro", 6), Card("copa", 5), Card("basto", 4)])  # 6  (B va 18, líder)
    awards = []
    original = m._award

    def spying(team, points):
        awards.append((team.name, points))
        return original(team, points)
    m._award = spying
    m.play_match()
    # la falta pagó exactamente el faltante del líder (30-18)
    assert ("T1", 12) in awards
    assert t2.score == 18
    assert m.winner is t1


def test_cualquier_jugador_puede_cantar_envido():
    # El mano pasa; B canta; cobra el mejor envido aunque no haya cantado primero
    m, t1, t2, *_ = make_1v1(score=(13, 0), actions_a=["paso"],
                             actions_b=["envido"], resp_a=["quiero"])
    deal(m, [Card("oro", 7), Card("oro", 2), Card("copa", 12)],   # 29 (A)
            [Card("oro", 6), Card("copa", 5), Card("basto", 4)])  # 6  (B)
    m.play_match()
    assert t1.score == 15 and m.winner is t1


def test_empate_de_envido_lo_resuelve_el_mano():
    m, t1, t2, *_ = make_1v1(score=(13, 0), actions_a=["envido"],
                             resp_b=["quiero"])
    deal(m, [Card("espada", 7), Card("copa", 11), Card("basto", 12)],  # 7
            [Card("basto", 7), Card("oro", 10), Card("copa", 11)])     # 7
    m.play_match()
    assert t1.score == 15 and m.winner is t1  # mano gana el empate


# -------------------------------------------------------------------- flor

def test_has_flor_y_best_flor():
    flor = [Card("oro", 7), Card("oro", 1), Card("oro", 12)]
    assert has_flor(flor)
    assert best_flor(flor) == 7 + 1 + 20
    assert not has_flor([Card("oro", 7), Card("oro", 1), Card("copa", 12)])


def test_flor_sola_suma_3():
    m, t1, t2, *_ = make_1v1(score=(12, 0), actions_a=["flor"])
    deal(m, [Card("oro", 7), Card("oro", 1), Card("oro", 12)],
            [Card("basto", 3), Card("oro", 2), Card("copa", 12)])
    m.play_match()
    assert t1.score == 15 and m.winner is t1


def test_flor_anula_envido_aceptado():
    # A canta envido y B quiere; B declara flor → el envido queda anulado
    m, t1, t2, *_ = make_1v1(score=(0, 12), actions_a=["envido"],
                             resp_b=["quiero"], actions_b=["flor"])
    deal(m, [Card("oro", 7), Card("oro", 2), Card("copa", 12)],       # sin flor
            [Card("basto", 7), Card("basto", 1), Card("basto", 12)])  # flor
    m.play_match()
    assert t1.score == 0            # ni un punto de envido
    assert t2.score == 15           # solo los 3 de la flor
    assert m.winner is t2


def test_flor_contra_flor_quiero_paga_4_al_mejor():
    m, t1, t2, *_ = make_1v1(score=(11, 0), actions_a=["flor"],
                             resp_b=["con_flor_quiero"])
    deal(m, [Card("oro", 7), Card("oro", 1), Card("oro", 12)],     # 28
            [Card("copa", 7), Card("copa", 1), Card("copa", 10)])  # 18
    m.play_match()
    assert t1.score == 15 and m.winner is t1


def test_flor_empate_lo_resuelve_el_mano():
    m, t1, t2, *_ = make_1v1(score=(11, 0), actions_a=["flor"],
                             resp_b=["con_flor_quiero"])
    deal(m, [Card("oro", 7), Card("oro", 1), Card("oro", 12)],
            [Card("copa", 7), Card("copa", 1), Card("copa", 12)])
    m.play_match()
    assert t1.score == 15 and m.winner is t1  # mismas flores → mano


def test_contraflor_querida_paga_6():
    m, t1, t2, *_ = make_1v1(score=(9, 0), actions_a=["flor"],
                             resp_b=["contraflor"], resp_a=["quiero"])
    deal(m, [Card("oro", 7), Card("oro", 1), Card("oro", 12)],
            [Card("copa", 7), Card("copa", 1), Card("copa", 10)])
    m.play_match()
    assert t1.score == 15 and m.winner is t1


def test_contraflor_rechazada_paga_4_al_contracantante():
    m, t1, t2, *_ = make_1v1(score=(0, 11), actions_a=["flor"],
                             resp_b=["contraflor"], resp_a=["no_quiero"])
    m.play_match()
    assert t2.score == 15 and m.winner is t2


def test_contraflor_al_resto_querida_gana_el_chico():
    m, t1, t2, *_ = make_1v1(score=(16, 14), target=30,
                             actions_a=["flor"], resp_b=["contraflor_al_resto"],
                             resp_a=["quiero"])
    deal(m, [Card("oro", 7), Card("oro", 1), Card("oro", 12)],
            [Card("copa", 7), Card("copa", 1), Card("copa", 10)])
    m.play_match()
    assert t1.score == 30  # faltante del líder (30-16) → chico
    assert m.winner is t1


def test_contraflor_al_resto_rechazada_paga_6_al_contracantante():
    m, t1, t2, *_ = make_1v1(score=(0, 24), target=30,
                             actions_a=["flor"], resp_b=["contraflor_al_resto"],
                             resp_a=["no_quiero"])
    m.play_match()
    assert t2.score == 30 and m.winner is t2


def test_con_flor_me_achico_paga_3_al_primero():
    m, t1, t2, *_ = make_1v1(score=(12, 0), actions_a=["flor"],
                             resp_b=["con_flor_me_achico"])
    deal(m, [Card("oro", 7), Card("oro", 1), Card("oro", 12)],
            [Card("copa", 7), Card("copa", 1), Card("copa", 10)])
    m.play_match()
    assert t1.score == 15 and m.winner is t1


def test_flor_que_alcanza_el_chico_termina_la_partida():
    m, t1, t2, *_ = make_1v1(score=(27, 0), target=30, actions_a=["flor"])
    deal(m, [Card("oro", 7), Card("oro", 1), Card("oro", 12)],
            [Card("basto", 3), Card("oro", 2), Card("copa", 12)])
    m.play_match()
    assert m.winner is t1 and t1.score == 30


# ----------------------------------------------------------------- tapadas

def test_cmp_plays_semantica_de_tapadas():
    alta, baja = Card("espada", 1), Card("copa", 4)
    assert _cmp_plays(baja, None) > 0        # cualquier carta vence a una tapada
    assert _cmp_plays(None, alta) < 0        # tapada pierde contra todas
    assert _cmp_plays(None, None) == 0       # dos tapadas empatan entre sí
    assert _cmp_plays(alta, baja) > 0
    assert _cmp_plays(baja, baja) == 0


def test_tapada_pierde_incluso_con_la_carta_mas_alta():
    # A juega el 1 de espada boca abajo y pierde la baza contra un 3;
    # B gana la mano completa → truco para T2
    m, t1, t2, p1, p2 = make_1v1(
        tap_a=[True], cards_a=[("espada", 1)],
        cards_b=[("copa", 3), ("basto", 3), ("oro", 4)])
    deal(m, [Card("espada", 1), Card("copa", 11), Card("basto", 12)],
            [Card("copa", 3), Card("basto", 3), Card("oro", 4)])
    m.play_hand()
    assert t1.score == 0 and t2.score >= 1
    assert p1.face_down[0] is True
    assert p2.face_down[0] is False  # B nunca jugó tapada


def test_dos_tapadas_empatan_entre_si_y_todo_parda_es_del_mano():
    m, t1, t2, p1, p2 = make_1v1(tap_a=[True, True, True],
                                 tap_b=[True, True, True])
    deal(m, [Card("espada", 1), Card("espada", 2), Card("espada", 3)],
            [Card("copa", 1), Card("copa", 2), Card("copa", 3)])
    m.play_hand()
    assert all(p1.face_down) and all(p2.face_down)
    # tres bazas pardas → la mano la define el equipo mano (T1)
    assert t1.score == 1 and t2.score == 0


def test_visible_state_oculta_tapadas_salvo_del_dueño():
    m, t1, t2, p1, p2 = make_1v1()
    p1.played = [Card("espada", 1)]
    p1.face_down = [True]
    st_rival = p2.visible_state(m, None, [])
    assert st_rival.played_by_opponents[0][0] is None      # rival: dorso
    st_propio = p1.visible_state(m, None, [])
    assert st_propio.played_by_me[0] == Card("espada", 1)  # dueño: cara real
