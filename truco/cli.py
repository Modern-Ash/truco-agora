"""CLI jugable 1v1: cada jugador configurable como humano o agente LLM."""
from __future__ import annotations

import argparse

from .controller import DeterministicMockLLMClient, HumanController, LLMController
from .engine import Match, Player


def build_controller(kind: str, name: str):
    if kind == "human":
        return HumanController(name)
    if kind == "llm":
        return LLMController(name, DeterministicMockLLMClient())
    raise ValueError(f"Tipo de jugador desconocido: {kind}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Truco Argentino 1v1")
    parser.add_argument("--player1", choices=["human", "llm"], default="human")
    parser.add_argument("--player2", choices=["human", "llm"], default="human")
    parser.add_argument("--target", type=int, choices=[15, 30], default=15)
    args = parser.parse_args()

    p1 = Player("Jugador 1", build_controller(args.player1, "Jugador 1"))
    p2 = Player("Jugador 2", build_controller(args.player2, "Jugador 2"))

    match = Match(p1, p2, target_score=args.target)
    winner = match.play_match()
    print(f"\n¡Ganó {winner.name}! ({p1.score} - {p2.score})")


if __name__ == "__main__":
    main()
