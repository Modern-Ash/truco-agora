"""Cálculo de puntaje de Envido (spec.md)."""
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
