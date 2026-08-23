"""Mazo español de 40 cartas y rankings de Truco Argentino (spec.md)."""
from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from typing import List

PALOS = ("espada", "basto", "oro", "copa")
NUMEROS = (1, 2, 3, 4, 5, 6, 7, 10, 11, 12)

# Ranking de Truco, agrupado: cartas del mismo grupo empatan (parda) entre sí.
# Primer grupo = carta más fuerte.
_TRUCO_GROUPS = [
    [("espada", 1)],
    [("basto", 1)],
    [("espada", 7)],
    [("oro", 7)],
    [("espada", 3), ("basto", 3), ("oro", 3), ("copa", 3)],
    [("espada", 2), ("basto", 2), ("oro", 2), ("copa", 2)],
    [("oro", 1), ("copa", 1)],
    [("basto", 7), ("copa", 7)],
    [("espada", 12), ("basto", 12), ("oro", 12), ("copa", 12)],
    [("espada", 11), ("basto", 11), ("oro", 11), ("copa", 11)],
    [("espada", 10), ("basto", 10), ("oro", 10), ("copa", 10)],
    [("espada", 6), ("basto", 6), ("oro", 6), ("copa", 6)],
    [("espada", 5), ("basto", 5), ("oro", 5), ("copa", 5)],
    [("espada", 4), ("basto", 4), ("oro", 4), ("copa", 4)],
]
_TRUCO_RANK = {
    card: len(_TRUCO_GROUPS) - group_idx
    for group_idx, group in enumerate(_TRUCO_GROUPS)
    for card in group
}


@dataclass(frozen=True, order=False)
class Card:
    palo: str
    numero: int

    def __post_init__(self) -> None:
        if self.palo not in PALOS:
            raise ValueError(f"Palo inválido: {self.palo}")
        if self.numero not in NUMEROS:
            raise ValueError(f"Número inválido: {self.numero}")

    @property
    def truco_rank(self) -> int:
        """Mayor valor = carta más fuerte para Truco."""
        return _TRUCO_RANK[(self.palo, self.numero)]

    @property
    def envido_value(self) -> int:
        """Valor de la carta para el cálculo de Envido (figuras = 0)."""
        return 0 if self.numero >= 10 else self.numero

    def __str__(self) -> str:
        return f"{self.numero} de {self.palo}"

    def __repr__(self) -> str:
        return f"Card({self.palo!r}, {self.numero})"


def full_deck() -> List[Card]:
    return [Card(palo, numero) for palo, numero in product(PALOS, NUMEROS)]


def beats(a: Card, b: Card) -> int:
    """Compara dos cartas para Truco. >0 si a gana, <0 si b gana, 0 si parda."""
    return a.truco_rank - b.truco_rank
