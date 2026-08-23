"""Adaptadores LLMClient pluggables (docs/llm-providers.md).

Cada adaptador implementa el protocolo `LLMClient` existente
(`decide(prompt, options) -> str`) shelleando el CLI del proveedor
correspondiente, o hablando HTTP local para Ollama. Ninguno agrega un SDK
de proveedor como dependencia de Python.

Principio de diseño: el LLM nunca decide reglas, solo elige una opción de
una lista ya acotada por el motor. Si la respuesta no matchea ninguna
opción válida (parseo fallido) o el proceso no responde a tiempo, cada
adaptador cae de forma determinista a la primera opción — nunca bloquea
ni corrompe la partida.
"""
from __future__ import annotations

import json
import logging
import subprocess
import urllib.error
import urllib.request
from typing import List, Optional

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 30.0


class ProviderUnavailableError(RuntimeError):
    """El binario/servicio del proveedor no está disponible en este entorno."""


def _fallback(options: List[str], reason: str) -> str:
    logger.warning("LLM provider fallback (%s); usando primera opción", reason)
    return options[0]


def _build_decision_prompt(prompt: str, options: List[str]) -> str:
    opciones = ", ".join(options)
    return (
        f"{prompt}\n\n"
        f"Respondé con EXACTAMENTE una de estas opciones, sin texto adicional: "
        f"{opciones}"
    )


def _match_option(raw: str, options: List[str]) -> Optional[str]:
    cleaned = raw.strip().strip('"').strip("'").lower()
    for opt in options:
        if opt.lower() == cleaned:
            return opt
    # Segunda pasada: la respuesta puede traer texto alrededor de la opción.
    for opt in options:
        if opt.lower() in cleaned:
            return opt
    return None


class _CLISubprocessClient:
    """Base para adaptadores que shellean un CLI de un solo turno
    (prompt por stdin o argv, respuesta por stdout)."""

    binary: str

    def __init__(self, model: Optional[str] = None,
                 timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self.model = model
        self.timeout = timeout

    def _command(self, prompt: str) -> List[str]:
        raise NotImplementedError

    def decide(self, prompt: str, options: List[str]) -> str:
        if not options:
            raise ValueError("No hay opciones para decidir")
        full_prompt = _build_decision_prompt(prompt, options)
        try:
            result = subprocess.run(
                self._command(full_prompt),
                capture_output=True,
                text=True,
                timeout=self.timeout,
                check=False,
            )
        except FileNotFoundError as exc:
            raise ProviderUnavailableError(
                f"'{self.binary}' no está instalado o no está en PATH"
            ) from exc
        except subprocess.TimeoutExpired:
            return _fallback(options, f"{self.binary} timeout tras {self.timeout}s")

        if result.returncode != 0:
            return _fallback(
                options, f"{self.binary} salió con código {result.returncode}"
            )

        matched = _match_option(result.stdout, options)
        if matched is None:
            return _fallback(options, f"{self.binary} respuesta no parseable: "
                                       f"{result.stdout[:120]!r}")
        return matched

    def generate(self, prompt: str) -> str:
        """Texto libre, sin acotar a un conjunto de opciones (usado por
        Referee para narración; nunca por PlayerController)."""
        try:
            result = subprocess.run(
                self._command(prompt),
                capture_output=True,
                text=True,
                timeout=self.timeout,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return ""
        return result.stdout.strip() if result.returncode == 0 else ""


class ClaudeCLIClient(_CLISubprocessClient):
    """Shellea `claude --print` (modo no interactivo, una sola respuesta)."""

    binary = "claude"

    def _command(self, prompt: str) -> List[str]:
        cmd = [self.binary, "--print", "--permission-mode", "bypassPermissions"]
        if self.model:
            cmd += ["--model", self.model]
        cmd.append(prompt)
        return cmd


class CodexCLIClient(_CLISubprocessClient):
    """Shellea `codex exec` (OpenAI Codex CLI, modo no interactivo)."""

    binary = "codex"

    def _command(self, prompt: str) -> List[str]:
        cmd = [self.binary, "exec"]
        if self.model:
            cmd += ["--model", self.model]
        cmd.append(prompt)
        return cmd


class OpenCodeCLIClient(_CLISubprocessClient):
    """Shellea `opencode run` (modo no interactivo)."""

    binary = "opencode"

    def _command(self, prompt: str) -> List[str]:
        cmd = [self.binary, "run"]
        if self.model:
            cmd += ["--model", self.model]
        cmd.append(prompt)
        return cmd


class OllamaClient:
    """Habla HTTP local con un servidor Ollama (sin dependencias nuevas:
    usa `urllib` de la stdlib)."""

    def __init__(self, model: str = "llama3",
                 host: str = "http://localhost:11434",
                 timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self.model = model
        self.host = host.rstrip("/")
        self.timeout = timeout

    def decide(self, prompt: str, options: List[str]) -> str:
        if not options:
            raise ValueError("No hay opciones para decidir")
        full_prompt = _build_decision_prompt(prompt, options)
        payload = json.dumps({
            "model": self.model,
            "prompt": full_prompt,
            "stream": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{self.host}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise ProviderUnavailableError(
                f"No se pudo conectar a Ollama en {self.host}: {exc}"
            ) from exc
        except TimeoutError:
            return _fallback(options, f"Ollama timeout tras {self.timeout}s")

        matched = _match_option(body.get("response", ""), options)
        if matched is None:
            return _fallback(options, f"Ollama respuesta no parseable: "
                                       f"{body.get('response', '')[:120]!r}")
        return matched

    def generate(self, prompt: str) -> str:
        """Texto libre, sin acotar a un conjunto de opciones (usado por
        Referee para narración; nunca por PlayerController)."""
        payload = json.dumps({
            "model": self.model, "prompt": prompt, "stream": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{self.host}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError):
            return ""
        return body.get("response", "").strip()


PROVIDERS = {
    "claude": ClaudeCLIClient,
    "codex": CodexCLIClient,
    "opencode": OpenCodeCLIClient,
    "ollama": OllamaClient,
}


def build_llm_client(provider: str, model: Optional[str] = None, **kwargs):
    """Factory usada tanto por jugadores agenticos como por el referee.

    provider="mock" devuelve None; el llamador debe usar
    `DeterministicMockLLMClient` en ese caso (se mantiene en controller.py
    para no crear una dependencia circular con este módulo).
    """
    if provider == "mock":
        return None
    if provider not in PROVIDERS:
        raise ValueError(
            f"Proveedor LLM desconocido: {provider!r} "
            f"(válidos: mock, {', '.join(PROVIDERS)})"
        )
    cls = PROVIDERS[provider]
    if model is not None:
        kwargs["model"] = model
    return cls(**kwargs)
