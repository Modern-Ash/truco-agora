"""Adaptadores LLMClient pluggables (docs/llm-providers.md).

Cada adaptador implementa el protocolo `LLMClient` existente
(`decide(prompt, options) -> str`) shelleando el CLI del proveedor
correspondiente, o hablando HTTP local para Ollama. Ninguno agrega un SDK
de proveedor como dependencia de Python.

Principio de diseño: el LLM nunca decide reglas, solo elige una opción de
una lista ya acotada por el motor. Una respuesta ambigua se reintenta una
vez con un formato estricto. Si el proveedor sigue sin responder de forma
válida, se usa una opción legal reproducible que no depende de la posición
de la lista; la procedencia de la decisión queda disponible para auditoría.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from typing import List, Optional

from .observability import log_event

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 30.0
MODEL_DISCOVERY_TIMEOUT_SECONDS = 8.0

CLAUDE_MODEL_ALIASES = ["sonnet", "opus", "haiku", "fable"]
_ANSI_ESCAPE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.IGNORECASE | re.DOTALL)
_JSON_DECISION_KEYS = ("choice", "option", "decision", "answer", "response")


class ProviderUnavailableError(RuntimeError):
    """El binario/servicio del proveedor no está disponible en este entorno."""


def deterministic_fallback(prompt: str, options: List[str]) -> str:
    """Elige una opción reproducible sin privilegiar el orden recibido."""
    if not options:
        raise ValueError("No hay opciones para decidir")
    canonical = sorted(options)
    material = (prompt + "\0" + "\0".join(canonical)).encode("utf-8")
    index = int.from_bytes(hashlib.sha256(material).digest()[:8], "big")
    return canonical[index % len(canonical)]


def _record_decision(client, *, source: str, choice: str,
                     attempts: int, reason: Optional[str] = None) -> None:
    client.last_decision = {
        "source": source,
        "choice": choice,
        "attempts": attempts,
        "reason": reason,
    }


def _public_reason(reason: str) -> str:
    """Reduce errores externos a categorías seguras para snapshots públicos."""
    lowered = reason.casefold()
    if "timeout" in lowered:
        return "provider-timeout"
    if "no está instalado" in lowered or "no se pudo usar" in lowered:
        return "provider-unavailable"
    if "código" in lowered:
        return "provider-exit"
    if "reparación" in lowered:
        return "repair-failed"
    if "parseable" in lowered:
        return "invalid-response"
    return "provider-error"


def _fallback(client, prompt: str, options: List[str], reason: str,
              attempts: int = 1) -> str:
    choice = deterministic_fallback(prompt, options)
    logger.warning("LLM provider fallback (%s); usando opción legal estable", reason)
    _record_decision(
        client, source="fallback", choice=choice, attempts=attempts,
        reason=_public_reason(reason),
    )
    log_event(
        logger,
        "provider.fallback",
        severity=logging.WARNING,
        reason=reason,
        choice=choice,
        strategy="stable-hash",
        attempts=attempts,
    )
    return choice


def _build_decision_prompt(prompt: str, options: List[str]) -> str:
    opciones = ", ".join(options)
    return (
        f"{prompt}\n\n"
        f"Respondé con EXACTAMENTE una de estas opciones, sin texto adicional: "
        f"{opciones}"
    )


def _build_repair_prompt(raw: str, options: List[str]) -> str:
    # No incluye el prompt original nuevamente: reduce latencia y evita que el
    # CLI repita contexto cuando sólo necesitamos normalizar su salida.
    bounded_raw = _ANSI_ESCAPE.sub("", raw).strip()[-1200:]
    return (
        "Tu respuesta anterior no coincidió inequívocamente con una opción.\n"
        f"Respuesta anterior: {bounded_raw}\n"
        "Devolvé sólo JSON válido con esta forma: "
        '{"choice":"OPCION"}. '
        f"OPCION debe ser exactamente una de: {', '.join(options)}"
    )


def _match_option(raw: str, options: List[str]) -> Optional[str]:
    cleaned = _THINK_BLOCK.sub(" ", _ANSI_ESCAPE.sub("", raw)).strip()
    candidates = [cleaned]
    for fragment in re.findall(r"\{[^{}]*\}", cleaned, flags=re.DOTALL):
        try:
            payload = json.loads(fragment)
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(payload, dict):
            candidates.extend(
                str(payload[key]) for key in _JSON_DECISION_KEYS
                if key in payload and payload[key] is not None
            )

    normalized = {opt.casefold(): opt for opt in options}
    for candidate in candidates:
        exact = candidate.strip().strip('"').strip("'").casefold()
        if exact in normalized:
            return normalized[exact]

    # Opciones largas primero evita que `quiero` capture `no_quiero`.
    matches = []
    lowered = cleaned.casefold()
    for opt in sorted(options, key=len, reverse=True):
        pattern = rf"(?<![\w]){re.escape(opt.casefold())}(?![\w])"
        if re.search(pattern, lowered):
            matches.append(opt)
    if len(matches) == 1:
        return matches[0]
    return None


class _CLISubprocessClient:
    """Base para adaptadores que shellean un CLI de un solo turno
    (prompt por stdin o argv, respuesta por stdout)."""

    binary: str

    def __init__(self, model: Optional[str] = None,
                 timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self.model = model
        self.timeout = timeout
        self.last_decision: Optional[dict] = None

    def _command(self, prompt: str) -> List[str]:
        raise NotImplementedError

    def decide(self, prompt: str, options: List[str]) -> str:
        if not options:
            raise ValueError("No hay opciones para decidir")
        full_prompt = _build_decision_prompt(prompt, options)
        started = time.monotonic()
        log_event(
            logger,
            "provider.cli.start",
            provider=self.binary,
            model=self.model or "default",
            timeout=self.timeout,
            option_count=len(options),
        )
        try:
            result = self._run_decision(full_prompt)
        except FileNotFoundError:
            return _fallback(
                self, prompt, options,
                f"{self.binary} no está instalado o no está en PATH",
            )
        except subprocess.TimeoutExpired:
            return _fallback(
                self, prompt, options, f"{self.binary} timeout tras {self.timeout}s"
            )
        except OSError as exc:
            return _fallback(
                self, prompt, options,
                f"{self.binary} no se pudo ejecutar: {type(exc).__name__}",
            )

        if result.returncode != 0:
            return _fallback(
                self, prompt, options,
                f"{self.binary} salió con código {result.returncode}",
            )

        matched = _match_option(result.stdout, options)
        if matched is None:
            try:
                repair = self._run_decision(_build_repair_prompt(result.stdout, options))
            except (OSError, subprocess.TimeoutExpired) as exc:
                return _fallback(
                    self, prompt, options,
                    f"{self.binary} reparación fallida: {type(exc).__name__}",
                    attempts=2,
                )
            matched = _match_option(repair.stdout, options) if repair.returncode == 0 else None
            if matched is None:
                return _fallback(
                    self, prompt, options,
                    f"{self.binary} respuesta no parseable tras reparación",
                    attempts=2,
                )
            source = "repaired"
            attempts = 2
        else:
            source = "model"
            attempts = 1
        _record_decision(
            self, source=source, choice=matched, attempts=attempts
        )
        log_event(
            logger,
            "provider.cli.end",
            provider=self.binary,
            model=self.model or "default",
            choice=matched,
            source=source,
            attempts=attempts,
            returncode=result.returncode,
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return matched

    def _run_decision(self, prompt: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            self._command(prompt),
            capture_output=True,
            text=True,
            timeout=self.timeout,
            check=False,
        )

    def generate(self, prompt: str) -> str:
        """Texto libre, sin acotar a un conjunto de opciones (usado por
        Referee para narración; nunca por PlayerController)."""
        started = time.monotonic()
        log_event(
            logger,
            "provider.cli.generate.start",
            provider=self.binary,
            model=self.model or "default",
            timeout=self.timeout,
        )
        try:
            result = subprocess.run(
                self._command(prompt),
                capture_output=True,
                text=True,
                timeout=self.timeout,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
            log_event(
                logger,
                "provider.cli.generate.error",
                severity=logging.WARNING,
                provider=self.binary,
                model=self.model or "default",
                error_type=type(exc).__name__,
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return ""
        output = result.stdout.strip() if result.returncode == 0 else ""
        log_event(
            logger,
            "provider.cli.generate.end",
            provider=self.binary,
            model=self.model or "default",
            returncode=result.returncode,
            output_chars=len(output),
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return output


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
        self.last_decision: Optional[dict] = None

    def decide(self, prompt: str, options: List[str]) -> str:
        if not options:
            raise ValueError("No hay opciones para decidir")
        full_prompt = _build_decision_prompt(prompt, options)
        started = time.monotonic()
        log_event(
            logger,
            "provider.ollama.start",
            provider="ollama",
            model=self.model,
            host=self.host,
            timeout=self.timeout,
            option_count=len(options),
        )
        try:
            body = self._request_decision(full_prompt)
        except urllib.error.URLError as exc:
            return _fallback(
                self, prompt, options,
                f"No se pudo usar Ollama en {self.host}: {exc}",
            )
        except TimeoutError:
            return _fallback(
                self, prompt, options, f"Ollama timeout tras {self.timeout}s"
            )
        except (json.JSONDecodeError, UnicodeDecodeError):
            return _fallback(self, prompt, options, "Ollama respuesta no parseable")

        matched = _match_option(body.get("response", ""), options)
        if matched is None:
            try:
                repair = self._request_decision(
                    _build_repair_prompt(body.get("response", ""), options)
                )
            except (
                urllib.error.URLError,
                TimeoutError,
                json.JSONDecodeError,
                UnicodeDecodeError,
            ) as exc:
                return _fallback(
                    self, prompt, options,
                    f"Ollama reparación fallida: {type(exc).__name__}",
                    attempts=2,
                )
            matched = _match_option(repair.get("response", ""), options)
            if matched is None:
                return _fallback(
                    self, prompt, options,
                    "Ollama respuesta no parseable tras reparación",
                    attempts=2,
                )
            source = "repaired"
            attempts = 2
        else:
            source = "model"
            attempts = 1
        _record_decision(self, source=source, choice=matched, attempts=attempts)
        log_event(
            logger,
            "provider.ollama.end",
            provider="ollama",
            model=self.model,
            choice=matched,
            source=source,
            attempts=attempts,
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return matched

    def _request_decision(self, prompt: str) -> dict:
        payload = json.dumps({
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{self.host}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def generate(self, prompt: str) -> str:
        """Texto libre, sin acotar a un conjunto de opciones (usado por
        Referee para narración; nunca por PlayerController)."""
        started = time.monotonic()
        log_event(
            logger,
            "provider.ollama.generate.start",
            provider="ollama",
            model=self.model,
            host=self.host,
            timeout=self.timeout,
        )
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
        except (urllib.error.URLError, TimeoutError) as exc:
            log_event(
                logger,
                "provider.ollama.generate.error",
                severity=logging.WARNING,
                provider="ollama",
                model=self.model,
                error_type=type(exc).__name__,
                duration_ms=round((time.monotonic() - started) * 1000, 1),
            )
            return ""
        output = body.get("response", "").strip()
        log_event(
            logger,
            "provider.ollama.generate.end",
            provider="ollama",
            model=self.model,
            output_chars=len(output),
            duration_ms=round((time.monotonic() - started) * 1000, 1),
        )
        return output


PROVIDERS = {
    "claude": ClaudeCLIClient,
    "codex": CodexCLIClient,
    "opencode": OpenCodeCLIClient,
    "ollama": OllamaClient,
}


def _catalog(
    provider: str,
    *,
    available: bool,
    models: Optional[List[str]] = None,
    source: str,
    message: str,
) -> dict:
    log_event(
        logger,
        "provider.catalog.result",
        provider=provider,
        available=available,
        source=source,
        model_count=len(models or []),
        message=message,
    )
    return {
        "provider": provider,
        "available": available,
        "models": sorted(set(models or [])),
        "source": source,
        "allow_custom_model": provider != "mock",
        "message": message,
    }


def _run_catalog_command(command: List[str]) -> subprocess.CompletedProcess:
    started = time.monotonic()
    log_event(
        logger,
        "provider.catalog.command.start",
        provider=command[0],
        timeout=MODEL_DISCOVERY_TIMEOUT_SECONDS,
    )
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=MODEL_DISCOVERY_TIMEOUT_SECONDS,
        check=False,
    )
    log_event(
        logger,
        "provider.catalog.command.end",
        provider=command[0],
        returncode=result.returncode,
        duration_ms=round((time.monotonic() - started) * 1000, 1),
    )
    return result


def discover_models(provider: str) -> dict:
    """Descubre modelos utilizables por el adaptador local del proveedor.

    Los catálogos de Codex, OpenCode y Ollama se consultan en el entorno donde
    corre la API. Claude Code no ofrece un comando de listado; se publican sus
    aliases estables y se mantiene habilitada la entrada de un nombre completo.
    Nunca se leen ni devuelven credenciales.
    """
    log_event(logger, "provider.catalog.start", provider=provider)
    valid = {"mock", *PROVIDERS}
    if provider not in valid:
        raise ValueError(
            f"Proveedor LLM desconocido: {provider!r} "
            f"(válidos: {', '.join(sorted(valid))})"
        )

    if provider == "mock":
        return _catalog(
            provider,
            available=True,
            source="builtin",
            message="El mock es determinista y no utiliza un modelo externo.",
        )

    binary = shutil.which(provider)
    if provider == "claude":
        return _catalog(
            provider,
            available=binary is not None,
            models=CLAUDE_MODEL_ALIASES,
            source="cli-aliases",
            message=(
                "Aliases de Claude Code; también podés escribir un nombre completo."
                if binary
                else "Claude Code no está instalado; podés guardar un modelo, pero no podrá ejecutarse."
            ),
        )

    if provider == "ollama":
        try:
            with urllib.request.urlopen(
                "http://localhost:11434/api/tags",
                timeout=MODEL_DISCOVERY_TIMEOUT_SECONDS,
            ) as response:
                payload = json.loads(response.read().decode("utf-8"))
            models = [
                item.get("name") or item.get("model")
                for item in payload.get("models", [])
                if item.get("name") or item.get("model")
            ]
            return _catalog(
                provider,
                available=True,
                models=models,
                source="ollama-api",
                message=(
                    f"{len(models)} modelo(s) instalado(s) en Ollama."
                    if models
                    else "Ollama responde, pero todavía no tiene modelos instalados."
                ),
            )
        except (OSError, TimeoutError, ValueError, json.JSONDecodeError):
            return _catalog(
                provider,
                available=False,
                source="ollama-api",
                message="Ollama no responde en localhost:11434.",
            )

    if binary is None:
        return _catalog(
            provider,
            available=False,
            source="cli",
            message=f"El CLI de {provider} no está instalado o no está en PATH.",
        )

    command = (
        [binary, "debug", "models"]
        if provider == "codex"
        else [binary, "models", "--pure"]
    )
    try:
        result = _run_catalog_command(command)
    except (OSError, subprocess.TimeoutExpired):
        return _catalog(
            provider,
            available=True,
            source="cli",
            message=f"{provider} está instalado, pero el catálogo no respondió.",
        )

    models: List[str] = []
    if result.returncode == 0 and provider == "codex":
        try:
            payload = json.loads(result.stdout)
            models = [
                item["slug"]
                for item in payload.get("models", [])
                if item.get("slug") and item.get("visibility") != "hide"
            ]
        except (TypeError, KeyError, json.JSONDecodeError):
            models = []
    elif result.returncode == 0:
        for raw_line in result.stdout.splitlines():
            model = _ANSI_ESCAPE.sub("", raw_line).strip()
            if model and "/" in model and not any(char.isspace() for char in model):
                models.append(model)

    return _catalog(
        provider,
        available=True,
        models=models,
        source="cli",
        message=(
            f"{len(models)} modelo(s) detectado(s) por {provider}."
            if models
            else f"{provider} está instalado, pero no devolvió modelos; podés escribir uno manualmente."
        ),
    )


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
