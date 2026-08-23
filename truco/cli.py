"""CLI jugable 1v1 y 2v2: cada jugador configurable como humano o agente LLM,
con proveedor LLM pluggable (docs/llm-providers.md)."""
from __future__ import annotations

import argparse
import os

from .controller import DeterministicMockLLMClient, HumanController, LLMController
from .engine import Match, Player, Team
from .llm_engine import LLMEngine
from .llm_providers import PROVIDERS, build_llm_client

DEFAULT_PROVIDER = os.environ.get("TRUCO_LLM_PROVIDER", "mock")
DEFAULT_ENGINE = os.environ.get("TRUCO_ENGINE", "llm")


def build_controller(kind: str, name: str, provider: str = "mock",
                      model: str | None = None):
    if kind == "human":
        return HumanController(name)
    if kind == "llm":
        client = build_llm_client(provider, model=model)
        if client is None:  # provider == "mock"
            client = DeterministicMockLLMClient()
        return LLMController(name, client)
    raise ValueError(f"Tipo de jugador desconocido: {kind}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Truco Argentino (1v1 o 2v2)")
    parser.add_argument("--mode", choices=["1v1", "2v2"], default="1v1")
    parser.add_argument("--target", type=int, choices=[15, 30], default=15)
    parser.add_argument(
        "--llm-provider",
        choices=["mock", *PROVIDERS],
        default=DEFAULT_PROVIDER,
        help=(
            "Proveedor LLM para jugadores 'llm' (default: env "
            "TRUCO_LLM_PROVIDER o 'mock')"
        ),
    )
    parser.add_argument("--llm-model", default=None, help="Modelo a pedirle al proveedor")
    parser.add_argument(
        "--engine",
        choices=["llm", "deterministic"],
        default=DEFAULT_ENGINE,
        help=(
            "Motor de reglas: 'llm' (default; arbitra comparación de cartas, "
            "envido y resolución de mano vía LLM — ver docs/llm-engine.md y "
            "el riesgo aceptado documentado ahí) o 'deterministic' (Python "
            "puro, sin dependencia de LLM para el arbitraje)"
        ),
    )
    args = parser.parse_args()

    def player(i: int) -> Player:
        return Player(
            f"Jugador {i}",
            build_controller("human", f"Jugador {i}", args.llm_provider, args.llm_model),
        )

    if args.mode == "1v1":
        p1, p2 = player(1), player(2)
        t1 = Team("Equipo 1", [p1])
        t2 = Team("Equipo 2", [p2])
        p1.team, p2.team = t1, t2
        teams = [t1, t2]
    else:
        p1, p2, p3, p4 = player(1), player(2), player(3), player(4)
        t1 = Team("Equipo 1", [p1, p3])
        t2 = Team("Equipo 2", [p2, p4])
        for p in t1.players:
            p.team = t1
        for p in t2.players:
            p.team = t2
        teams = [t1, t2]

    if args.engine == "llm":
        engine_client = build_llm_client(args.llm_provider, model=args.llm_model)
        match = LLMEngine(teams, target_score=args.target, client=engine_client)
    else:
        match = Match(teams, target_score=args.target)
    winner = match.play_match()
    print(f"\n¡Ganó el {winner.name}! (Marcador: {teams[0].score} - {teams[1].score})")


if __name__ == "__main__":
    main()
