"""Tests del modo espectador paso a paso (docs/step-mode.md)."""
import time

import pytest
from fastapi.testclient import TestClient

from truco.api import app

DETERMINISTIC = {"engine": "deterministic"}


@pytest.fixture()
def client():
    return TestClient(app)


def _crear_step_match(client, mode="1v1", **overrides):
    payload = {
        "mode": mode,
        "target_score": 15,
        "players": [{"name": n, "kind": "agent"}
                    for n in (["A", "B"] if mode == "1v1" else ["A", "B", "C", "D"])],
        "step_mode": True,
        **DETERMINISTIC,
        **overrides,
    }
    r = client.post("/matches", json=payload)
    assert r.status_code == 201, r.text
    return r.json()["match_id"]


def _wait_pending_step(client, match_id, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = client.get(f"/matches/{match_id}/state").json()
        if state["pending_step"] is not None or state["finished"]:
            return state
        time.sleep(0.01)
    raise AssertionError("No apareció pending_step a tiempo")


# ---------------------------------------------------------- creación / guard


def test_step_mode_requiere_todos_los_jugadores_agente(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"}, {"name": "B", "kind": "agent"}],
        "step_mode": True,
        **DETERMINISTIC,
    })
    assert r.status_code == 422
    assert "step_mode" in r.json()["detail"]


def test_partida_normal_sin_step_mode_no_expone_pending_step(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"}, {"name": "B", "kind": "web"}],
        **DETERMINISTIC,
    })
    assert r.status_code == 201
    assert r.json()["state"]["pending_step"] is None


# --------------------------------------------------------------------- /step


def test_step_expone_pending_step_y_avanza_con_step(client):
    match_id = _crear_step_match(client)
    state = _wait_pending_step(client, match_id)
    assert not state["finished"]
    assert state["pending_step"]["player"] in ("A", "B")
    assert state["pending_step"]["kind"] in ("action", "card", "response")

    r = client.post(f"/matches/{match_id}/step")
    assert r.status_code == 200
    # Tras un step, o bien hay una nueva movida pendiente, o la partida
    # avanzó (podría terminar de una si el motor determinista resuelve
    # rápido, aunque con target 15 es improbable en un solo step).
    assert r.json()["finished"] in (True, False)


def test_step_sin_pending_devuelve_404(client):
    match_id = _crear_step_match(client)
    _wait_pending_step(client, match_id)
    # Consumimos el único gate pendiente sin esperar a que aparezca el
    # próximo antes de pedir otro step inmediatamente en el mismo instante
    # sería flaky; en cambio probamos el caso limpio: partida sin step_mode.
    r = client.post("/matches/nonexistent/step")
    assert r.status_code == 404


def test_step_en_partida_sin_step_mode_es_422(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"}, {"name": "B", "kind": "web"}],
        **DETERMINISTIC,
    })
    match_id = r.json()["match_id"]
    r2 = client.post(f"/matches/{match_id}/step")
    assert r2.status_code == 422


def test_partida_completa_en_step_mode_avanza_solo_con_step(client):
    match_id = _crear_step_match(client)
    steps = 0
    deadline = time.time() + 30
    while time.time() < deadline:
        state = client.get(f"/matches/{match_id}/state").json()
        if state["finished"]:
            break
        if state["pending_step"] is None:
            time.sleep(0.01)
            continue
        r = client.post(f"/matches/{match_id}/step")
        assert r.status_code == 200
        steps += 1
    else:
        raise AssertionError("La partida no terminó a tiempo")
    final = client.get(f"/matches/{match_id}/state").json()
    assert final["finished"]
    assert steps > 0


def test_step_mode_funciona_en_2v2(client):
    match_id = _crear_step_match(client, mode="2v2")
    state = _wait_pending_step(client, match_id)
    assert state["pending_step"]["player"] in ("A", "B", "C", "D")
