"""Tests del rol Referee: narración best-effort, aislado del motor
(docs/llm-providers.md)."""
from __future__ import annotations

from truco.referee import Referee

SNAPSHOT = {
    "teams": [{"name": "Equipo 1", "score": 3}, {"name": "Equipo 2", "score": 1}],
    "mano": "Ana",
    "turn": "Ana",
    "call_vigente": "truco",
}


class _FakeGenerateClient:
    def __init__(self, text: str):
        self.text = text
        self.last_prompt = None

    def generate(self, prompt: str) -> str:
        self.last_prompt = prompt
        return self.text


class _DecideOnlyClient:
    """No implementa `generate`; simula un LLMClient de jugador reusado
    por error como referee. Referee debe ignorarlo, no crashear."""

    def decide(self, prompt, options):
        return options[0]


def test_narrate_without_client_uses_fallback():
    referee = Referee(client=None)
    text = referee.narrate(SNAPSHOT)
    assert "Equipo 1 3" in text
    assert "Equipo 2 1" in text


def test_narrate_uses_llm_generate_output():
    client = _FakeGenerateClient("¡Truco cantado, tensión en la mesa!")
    referee = Referee(client=client)
    text = referee.narrate(SNAPSHOT)
    assert text == "¡Truco cantado, tensión en la mesa!"
    assert "truco" in client.last_prompt.lower()


def test_narrate_falls_back_when_generate_returns_empty():
    client = _FakeGenerateClient("")
    referee = Referee(client=client)
    text = referee.narrate(SNAPSHOT)
    assert "Equipo 1 3" in text


def test_narrate_falls_back_when_client_has_no_generate_method():
    referee = Referee(client=_DecideOnlyClient())
    text = referee.narrate(SNAPSHOT)
    assert "Equipo 1 3" in text


def test_narrate_falls_back_when_generate_raises():
    class _BrokenClient:
        def generate(self, prompt):
            raise RuntimeError("boom")

    referee = Referee(client=_BrokenClient())
    text = referee.narrate(SNAPSHOT)
    assert "Equipo 1 3" in text


def test_referee_has_no_access_to_match_internals():
    # Referee nunca importa Match/engine: solo opera sobre el dict de
    # snapshot público. Verificamos que su módulo no depende de engine.py.
    import truco.referee as referee_module

    assert "engine" not in referee_module.__dict__
    with open(referee_module.__file__, encoding="utf-8") as f:
        source = f.read()
    assert "from .engine" not in source
    assert "import engine" not in source
