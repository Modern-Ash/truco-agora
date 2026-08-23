"""Cálculo de puntaje de Envido y Flor (spec.md, reglas-v2.md)."""
from __future__ import annotations

from itertools import combinations
from typing import List

from .cards import Card


def best_envido(cards: List[Card]) -> int:
    """Mejor puntaje de envido posible con las cartas dadas.

    - Dos cartas del mismo palo: suma de valores + 20.
    - Tres del mismo palo: las dos más altas + 20.
    - Sin pareja de palo: la carta individual de mayor valor (0-7).
    """
    by_palo: dict[str, List[Card]] = {}
    for c in cards:
        by_palo.setdefault(c.palo, []).append(c)

    best = max((c.envido_value for c in cards), default=0)

    for palo_cards in by_palo.values():
        if len(palo_cards) >= 2:
            values = sorted((c.envido_value for c in palo_cards), reverse=True)
            score = values[0] + values[1] + 20
            best = max(best, score)

    return best


def has_flor(cards: List[Card]) -> bool:
    """Flor: las tres cartas de la mano son del mismo palo (reglas-v2.md)."""
    return len(cards) == 3 and len({c.palo for c in cards}) == 1


def best_flor(cards: List[Card]) -> int:
    """Valor de la flor: suma de valores de envido + 20 (figuras valen 0)."""
    return sum(c.envido_value for c in cards) + 20
