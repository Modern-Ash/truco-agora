"""Tests de adaptadores LLM pluggables (docs/llm-providers.md).

Todos mockean el subprocess/HTTP real: no requieren tener claude/codex/
opencode instalados ni un servidor Ollama corriendo para pasar en CI.
"""
from __future__ import annotations

import json
import subprocess
from unittest.mock import MagicMock, patch

import pytest

from truco.llm_providers import (
    ClaudeCLIClient,
    CodexCLIClient,
    OllamaClient,
    OpenCodeCLIClient,
    build_llm_client,
    discover_models,
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


def test_cli_client_falls_back_when_binary_missing():
    client = ClaudeCLIClient()
    with patch("subprocess.run", side_effect=FileNotFoundError()):
        assert client.decide("¿Qué hacés?", ["jugar"]) == "jugar"


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


def test_ollama_client_falls_back_on_connection_error():
    import urllib.error

    client = OllamaClient()
    with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("refused")):
        assert client.decide("¿Aceptás?", ["quiero", "no_quiero"]) == "quiero"


def test_ollama_client_falls_back_on_http_404():
    import urllib.error

    client = OllamaClient(model="modelo-ausente")
    error = urllib.error.HTTPError(
        client.host, 404, "Not Found", hdrs=None, fp=None
    )
    with patch("urllib.request.urlopen", side_effect=error):
        assert client.decide("¿Qué hacés?", ["jugar", "truco"]) == "jugar"


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


def test_discover_models_mock_does_not_require_external_model():
    result = discover_models("mock")
    assert result["available"] is True
    assert result["models"] == []
    assert result["allow_custom_model"] is False


def test_discover_models_claude_exposes_aliases_and_manual_fallback():
    with patch("shutil.which", return_value="/usr/bin/claude"):
        result = discover_models("claude")
    assert result["available"] is True
    assert {"sonnet", "opus", "haiku"}.issubset(result["models"])
    assert result["allow_custom_model"] is True


def test_discover_models_codex_reads_visible_local_catalog():
    payload = {
        "models": [
            {"slug": "gpt-visible", "visibility": "list"},
            {"slug": "gpt-hidden", "visibility": "hide"},
        ]
    }
    with (
        patch("shutil.which", return_value="/usr/bin/codex"),
        patch("subprocess.run", return_value=_completed(json.dumps(payload))) as run,
    ):
        result = discover_models("codex")
    assert result["models"] == ["gpt-visible"]
    assert run.call_args.args[0] == ["/usr/bin/codex", "debug", "models"]


def test_discover_models_opencode_reads_provider_model_lines():
    output = "openai/gpt-5\nanthropic/claude-sonnet\ninvalid line with spaces\n"
    with (
        patch("shutil.which", return_value="/usr/bin/opencode"),
        patch("subprocess.run", return_value=_completed(output)),
    ):
        result = discover_models("opencode")
    assert result["models"] == ["anthropic/claude-sonnet", "openai/gpt-5"]


def test_discover_models_ollama_reads_installed_tags():
    response = MagicMock()
    response.read.return_value = b'{"models":[{"name":"qwen2.5:7b"}]}'
    response.__enter__.return_value = response
    with patch("urllib.request.urlopen", return_value=response):
        result = discover_models("ollama")
    assert result["available"] is True
    assert result["models"] == ["qwen2.5:7b"]


def test_discover_models_unknown_provider_raises():
    with pytest.raises(ValueError, match="Proveedor LLM desconocido"):
        discover_models("unknown")
