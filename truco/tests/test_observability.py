import logging
import time

from truco.api import (
    CreateMatchRequest,
    create_match,
    get_session,
    match_diagnostics,
)
from truco.observability import DEFAULT_LOG_FILE, _level, configure_logging, log_event


def test_debug_y_archivo_estan_activos_por_defecto(monkeypatch):
    monkeypatch.delenv("TRUCO_LOG_LEVEL", raising=False)
    monkeypatch.delenv("TRUCO_LOG_FILE", raising=False)

    assert _level() == logging.DEBUG
    configure_logging()
    assert any(
        getattr(handler, "_truco_file", None) == str(DEFAULT_LOG_FILE)
        for handler in logging.getLogger("truco").handlers
    )


def test_log_file_configurable_escribe_eventos_sin_payload(tmp_path, monkeypatch):
    log_path = tmp_path / "truco.log"
    package_logger = logging.getLogger("truco")
    original_level = package_logger.level
    monkeypatch.setenv("TRUCO_LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("TRUCO_LOG_FILE", str(log_path))
    configure_logging()

    logger = logging.getLogger("truco.test.observability")
    log_event(
        logger,
        "test.safe",
        match_id="m-1",
        player="Ana María",
        option_count=3,
        prompt="esto nunca debe registrarse",
        error="fallo api_key=supersecreto",
    )
    for handler in logging.getLogger("truco").handlers:
        handler.flush()

    content = log_path.read_text(encoding="utf-8")
    assert "event=test.safe" in content
    assert "match_id=m-1" in content
    assert "player=Ana_María" in content
    assert "prompt" not in content
    assert "supersecreto" not in content
    assert "[REDACTED]" in content

    # El handler apunta a un directorio temporal que pytest eliminará.
    for handler in list(package_logger.handlers):
        if getattr(handler, "_truco_file", None) == str(log_path):
            package_logger.removeHandler(handler)
            handler.close()
    package_logger.setLevel(original_level)


def test_diagnostics_muestra_paso_hilo_y_ultimo_progreso_sin_cartas():
    created = create_match(CreateMatchRequest(
        mode="1v1",
        engine="deterministic",
        step_mode=True,
        players=[
            {"name": "Agente A", "kind": "agent", "provider": "mock"},
            {"name": "Agente B", "kind": "agent", "provider": "mock"},
        ],
    ))
    match_id = created["match_id"]
    session = get_session(match_id)
    deadline = time.monotonic() + 1
    while session.snapshot_pending_step() is None and time.monotonic() < deadline:
        time.sleep(0.005)

    diagnostic = match_diagnostics(match_id)

    assert diagnostic["thread_alive"] is True
    assert diagnostic["thread_name"] == f"match-{match_id}"
    assert diagnostic["pending_step"]["player"] in {"Agente A", "Agente B"}
    assert diagnostic["pending_age_seconds"] >= 0
    assert diagnostic["last_progress_event"] == "step.pending"
    assert {"hand", "cards", "prompt", "credentials"}.isdisjoint(diagnostic)


def test_session_diagnostics_actualiza_edad_de_progreso():
    created = create_match(CreateMatchRequest(
        mode="1v1",
        engine="deterministic",
        players=[{"name": "Humano A"}, {"name": "Humano B"}],
    ))
    session = get_session(created["match_id"])

    first = session.diagnostics()
    time.sleep(0.002)
    second = session.diagnostics()

    assert second["last_progress_age_seconds"] >= first["last_progress_age_seconds"]
    assert second["last_progress_event"] == "match.hand.start"
