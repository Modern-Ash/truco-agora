"""Referee: narrador/observador opcional de la partida vía LLM pluggable.

Diseño (docs/llm-providers.md): el Referee es estrictamente un observador.
Recibe snapshots de estado *después* de que el motor ya resolvió una jugada,
nunca antes, y no tiene ninguna referencia a `Match`/`engine.py` que le
permita alterar el resultado. Su único efecto es producir texto.
"""
from __future__ import annotations

from typing import List, Optional, Protocol


class LLMClient(Protocol):
    def decide(self, prompt: str, options: List[str]) -> str: ...

    def generate(self, prompt: str) -> str:
        """Texto libre. Referee solo usa este método, nunca `decide`:
        la narración no es una decisión de juego acotada a opciones."""
        ...


class Referee:
    """Genera comentario/narración de la partida a partir de snapshots
    públicos de estado. No recibe ni puede mutar el objeto `Match`."""

    def __init__(self, client: Optional[LLMClient]):
        self.client = client

    def narrate(self, snapshot: dict) -> str:
        """`snapshot` es un dict de estado público (p.ej. el mismo payload
        que expone la API REST), nunca el objeto `Match` ni las manos
        privadas de un jugador."""
        fallback = self._fallback_narration(snapshot)
        if self.client is None or not hasattr(self.client, "generate"):
            return fallback
        prompt = self._build_prompt(snapshot)
        try:
            text = self.client.generate(prompt)
        except Exception:  # noqa: BLE001 - narración best-effort, nunca rompe la partida
            return fallback
        return text.strip() or fallback

    def _build_prompt(self, snapshot: dict) -> str:
        teams = snapshot.get("teams", [])
        marcador = " - ".join(f"{t['name']} {t['score']}" for t in teams)
        return (
            "Sos el relator de una partida de Truco Argentino. "
            f"Marcador actual: {marcador}. "
            f"Mano: {snapshot.get('mano')}. Turno: {snapshot.get('turn')}. "
            f"Canto vigente: {snapshot.get('call_vigente')}. "
            "Narrá en una frase breve y entusiasta lo que está pasando."
        )

    def _fallback_narration(self, snapshot: dict) -> str:
        teams = snapshot.get("teams", [])
        marcador = " - ".join(f"{t['name']} {t['score']}" for t in teams)
        return f"Marcador: {marcador}."
