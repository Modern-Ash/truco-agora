"""CLI jugable 1v1 y 2v2: cada jugador configurable como humano o agente LLM."""
from __future__ import annotations

import argparse

from .controller import DeterministicMockLLMClient, HumanController, LLMController
from .engine import Match, Player, Team

def build_controller(kind: str, name: str):
    if kind == "human":
        return HumanController(name)
    if kind == "llm":
        return LLMController(name, DeterministicMockLLMClient())
    raise ValueError(f"Tipo de jugador desconocido: {kind}")

def main() -> None:
    parser = argparse.ArgumentParser(description="Truco Argentino (1v1 o 2v2)")
    parser.add_argument("--mode", choices=["1v1", "2v2"], default="1v1")
    parser.add_argument("--target", type=int, choices=[15, 30], default=15)
    args = parser.parse_args()

    if args.mode == "1v1":
        p1 = Player("Jugador 1", build_controller("human", "Jugador 1"))
        p2 = Player("Jugador 2", build_controller("human", "Jugador 2"))
        t1 = Team("Equipo 1", [p1])
        t2 = Team("Equipo 2", [p2])
        p1.team, p2.team = t1, t2
        teams = [t1, t2]
    else:
        p1 = Player("Jugador 1", build_controller("human", "Jugador 1"))
        p2 = Player("Jugador 2", build_controller("human", "Jugador 2"))
        p3 = Player("Jugador 3", build_controller("human", "Jugador 3"))
        p4 = Player("Jugador 4", build_controller("human", "Jugador 4"))
        t1 = Team("Equipo 1", [p1, p3])
        t2 = Team("Equipo 2", [p2, p4])
        for p in t1.players: p.team = t1
        for p in t2.players: p.team = t2
        teams = [t1, t2]

    match = Match(teams, target_score=args.target)
    winner = match.play_match()
    print(f"\n¡Ganó el {winner.name}! (Marcador: {teams[0].score} - {teams[1].score})")

if __name__ == "__main__":
    main()
