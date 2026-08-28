"""Logging consistente y seguro para el backend de Truco."""
from __future__ import annotations

import logging
import os
import re
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

LOG_LEVEL_ENV = "TRUCO_LOG_LEVEL"
LOG_FILE_ENV = "TRUCO_LOG_FILE"
DEFAULT_LOG_FILE = Path(__file__).resolve().parents[1] / "logs" / "truco-backend-debug.log"
_FORMAT = (
    "%(asctime)s %(levelname)s %(name)s [%(threadName)s] %(message)s"
)
_SENSITIVE_FIELD_NAMES = {
    "authorization", "body", "credentials", "password", "prompt", "secret",
}
_SENSITIVE_VALUE = re.compile(
    r"(?i)\b(authorization|api[_-]?key|token|password|secret|credentials)"
    r"(\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+"
)


def _level() -> int:
    raw = os.getenv(LOG_LEVEL_ENV, "DEBUG").upper()
    return getattr(logging, raw, logging.DEBUG)


def configure_logging() -> None:
    """Configura el namespace ``truco`` sin duplicar handlers de uvicorn."""
    package_logger = logging.getLogger("truco")
    package_logger.setLevel(_level())
    # Se propaga para que pytest/caplog y colectores externos puedan capturar
    # los mismos eventos. El handler propio garantiza salida aun si uvicorn no
    # configuró el root logger.
    package_logger.propagate = True
    formatter = logging.Formatter(_FORMAT, datefmt="%Y-%m-%dT%H:%M:%S")

    if not any(getattr(handler, "_truco_console", False)
               for handler in package_logger.handlers):
        console = logging.StreamHandler()
        console.setFormatter(formatter)
        console._truco_console = True  # type: ignore[attr-defined]
        package_logger.addHandler(console)

    # En esta aplicación de desarrollo el diagnóstico debe estar disponible
    # aun cuando Uvicorn corra en otra terminal. Un valor vacío desactiva el
    # archivo explícitamente: TRUCO_LOG_FILE="".
    log_file = os.getenv(LOG_FILE_ENV, str(DEFAULT_LOG_FILE))
    if log_file and not any(getattr(handler, "_truco_file", None) == log_file
                            for handler in package_logger.handlers):
        path = Path(log_file).expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            path,
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        file_handler._truco_file = log_file  # type: ignore[attr-defined]
        package_logger.addHandler(file_handler)

    log_event(
        package_logger,
        "backend.logging.configured",
        configured_level=logging.getLevelName(package_logger.level),
        file_enabled=bool(log_file),
        rotation_max_mib=5 if log_file else None,
        rotation_backups=3 if log_file else None,
    )


def _safe_value(value: Any) -> str:
    text = _SENSITIVE_VALUE.sub(r"\1\2[REDACTED]", str(value))
    return (
        text.replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace(" ", "_")
    )


def log_event(
    logger: logging.Logger,
    event: str,
    *,
    severity: int = logging.INFO,
    **fields: Any,
) -> None:
    """Emite eventos grep-friendly sin serializar payloads ni prompts."""
    details = " ".join(
        f"{key}={_safe_value(value)}"
        for key, value in fields.items()
        if value is not None and key.lower() not in _SENSITIVE_FIELD_NAMES
    )
    logger.log(severity, "event=%s%s", event, f" {details}" if details else "")
