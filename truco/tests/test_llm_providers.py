"""Tests de adaptadores LLM pluggables (docs/llm-providers.md).

Todos mockean el subprocess/HTTP real: no requieren tener claude/codex/
opencode instalados ni un servidor Ollama corriendo para pasar en CI.
"""
from __future__ import annotations

import subprocess
from unittest.mock import MagicMock, patch

import pytest

from truco.llm_providers import (
    ClaudeCLIClient,
    CodexCLIClient,
    OllamaClient,
    OpenCodeCLIClient,
    ProviderUnavailableError,
    build_llm_client,
)


def _completed(stdout: str, returncode: int = 0) -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout)


@pytest.mark.parametrize("cls,binary", [
    (ClaudeCLIClient, "claude"),
    (CodexCLIClient, "codex"),
    (OpenCodeCLIClient, "opencode"),
])
def test_cli_client_parses_matching_option(cls, binary):
    client = cls()
    with patch("subprocess.run", return_value=_completed("truco\n")) as run:
        result = client.decide("¿Qué hacés?", ["jugar", "truco", "irse_al_mazo"])
    assert result == "truco"
    assert run.call_args.args[0][0] == binary


def test_cli_client_falls_back_to_first_option_on_unparseable_response():
    client = ClaudeCLIClient()
    with patch("subprocess.run", return_value=_completed("no entendí la pregunta")):
        result = client.decide("¿Qué hacés?", ["jugar", "truco"])
    assert result == "jugar"


def test_cli_client_falls_back_on_nonzero_exit():
    client = ClaudeCLIClient()
    with patch("subprocess.run", return_value=_completed("", returncode=1)):
        result = client.decide("¿Qué hacés?", ["jugar", "truco"])
    assert result == "jugar"


def test_cli_client_falls_back_on_timeout():
    client = ClaudeCLIClient(timeout=0.01)
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("claude", 0.01)):
        result = client.decide("¿Qué hacés?", ["jugar", "truco"])
    assert result == "jugar"


def test_cli_client_raises_provider_unavailable_when_binary_missing():
    client = ClaudeCLIClient()
    with patch("subprocess.run", side_effect=FileNotFoundError()):
        with pytest.raises(ProviderUnavailableError):
            client.decide("¿Qué hacés?", ["jugar"])


def test_cli_client_matches_option_surrounded_by_extra_text():
    client = CodexCLIClient()
    with patch("subprocess.run", return_value=_completed("Yo elijo: irse_al_mazo.")):
        result = client.decide("¿Qué hacés?", ["jugar", "irse_al_mazo"])
    assert result == "irse_al_mazo"


def test_ollama_client_parses_matching_option():
    client = OllamaClient()
    fake_response = MagicMock()
    fake_response.read.return_value = b'{"response": "quiero"}'
    fake_response.__enter__.return_value = fake_response
    with patch("urllib.request.urlopen", return_value=fake_response):
        result = client.decide("¿Aceptás?", ["quiero", "no_quiero"])
    assert result == "quiero"


def test_ollama_client_raises_provider_unavailable_on_connection_error():
    import urllib.error

    client = OllamaClient()
    with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("refused")):
        with pytest.raises(ProviderUnavailableError):
            client.decide("¿Aceptás?", ["quiero", "no_quiero"])


def test_build_llm_client_mock_returns_none():
    assert build_llm_client("mock") is None


def test_build_llm_client_unknown_provider_raises():
    with pytest.raises(ValueError, match="claude, codex, opencode, ollama"):
        build_llm_client("not-a-real-provider")


@pytest.mark.parametrize("provider,cls", [
    ("claude", ClaudeCLIClient),
    ("codex", CodexCLIClient),
    ("opencode", OpenCodeCLIClient),
    ("ollama", OllamaClient),
])
def test_build_llm_client_returns_correct_adapter(provider, cls):
    client = build_llm_client(provider, model="a-model")
    assert isinstance(client, cls)
    assert client.model == "a-model"
