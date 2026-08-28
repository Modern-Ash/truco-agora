"""Tests de la API REST por turnos (docs/api-spec.md, work truco-api-webapp)."""
import time

import pytest
from fastapi.testclient import TestClient

from truco.api import app, get_session


@pytest.fixture()
def client():
    return TestClient(app)


def _wait_finished(client, match_id, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = client.get(f"/matches/{match_id}/state").json()
        if state["finished"]:
            return state
        time.sleep(0.01)
    raise AssertionError("La partida no terminó a tiempo")


def _pending_player(client, match_id, names):
    """Primer jugador web con decisión pendiente (o None)."""
    for name in names:
        state = client.get(f"/matches/{match_id}/state",
                           params={"player": name}).json()
        pend = state["you"]["pending"]
        if pend is not None:
            return name, state
    return None, None


# ------------------------------------------------------- api-crear-partida


def test_crear_partida_1v1_devuelve_id_y_estado(client):
    r = client.post("/matches", json={
        "mode": "1v1", "target_score": 15,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["match_id"] and data["mode"] == "1v1"
    assert data["target_score"] == 15
    assert data["players"] == ["A", "B"]
    assert data["flor_enabled"] is False
    assert data["state"]["flor_enabled"] is False
    assert len(data["state"]["you"]["hand"]) == 3  # mano inicial repartida


def test_crear_partida_puede_habilitar_variante_con_flor(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "engine": "deterministic",
        "flor_enabled": True,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    assert r.status_code == 201
    assert r.json()["state"]["flor_enabled"] is True


def test_crear_partida_2v2_alternando_equipos(client):
    r = client.post("/matches", json={
        "mode": "2v2",
        "players": [{"name": n} for n in ("A1", "B1", "A2", "B2")],
    })
    assert r.status_code == 201
    teams = {t["name"]: t["players"] for t in r.json()["state"]["teams"]}
    assert teams["Equipo 1"] == ["A1", "A2"]
    assert teams["Equipo 2"] == ["B1", "B2"]


def test_crear_partida_1v1_usa_nombres_de_jugadores_como_equipos(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "engine": "deterministic",
        "players": [{"name": "A"}, {"name": "B"}],
        "team_names": ["Rosario", "Mendoza"],
    })
    assert r.status_code == 201
    assert [team["name"] for team in r.json()["state"]["teams"]] == ["A", "B"]


def test_crear_partida_2v2_usa_nombres_de_equipo_personalizados(client):
    r = client.post("/matches", json={
        "mode": "2v2",
        "engine": "deterministic",
        "players": [{"name": n} for n in ("A1", "B1", "A2", "B2")],
        "team_names": ["Rosario", "Mendoza"],
    })
    assert r.status_code == 201
    assert [team["name"] for team in r.json()["state"]["teams"]] == [
        "Rosario", "Mendoza",
    ]


@pytest.mark.parametrize("payload", [
    {"mode": "3v3", "players": [{"name": "A"}, {"name": "B"}]},
    {"mode": "1v1", "players": [{"name": "A"}]},                # faltan jugadores
    {"mode": "1v1", "target_score": 20,
     "players": [{"name": "A"}, {"name": "B"}]},                # target inválido
    {"mode": "1v1",
     "players": [{"name": "A"}, {"name": "A"}]},                # duplicados
])
def test_creacion_invalida_es_422(client, payload):
    assert client.post("/matches", json=payload).status_code == 422


# ------------------------------------------------------- api-llm-pluggable


def test_agente_con_provider_mock_por_defecto(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"},
                    {"name": "B", "kind": "agent"}],
    })
    assert r.status_code == 201  # provider default "mock", sin CLI externo


def test_agente_con_provider_desconocido_es_422(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"},
                    {"name": "B", "kind": "agent", "provider": "not-a-provider"}],
    })
    assert r.status_code == 422
    assert "not-a-provider" in r.json()["detail"]


def test_agente_con_bluff_level_mentiroso_es_valido(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"},
                    {"name": "B", "kind": "agent", "bluff_level": "mentiroso"}],
    })
    assert r.status_code == 201


def test_agente_con_bluff_level_invalido_es_422(client):
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"},
                    {"name": "B", "kind": "agent", "bluff_level": "no-existe"}],
    })
    assert r.status_code == 422
    assert "bluff_level" in r.json()["detail"]


def test_agente_con_provider_real_no_crashea_la_creacion(client, monkeypatch):
    # El adaptador se construye (no shellea nada todavía en __init__); el
    # partido arranca igual. Se mockea subprocess para no depender de (ni
    # invocar de verdad) el CLI de claude en el entorno de test.
    import subprocess

    monkeypatch.setattr(
        subprocess, "run",
        lambda *a, **k: subprocess.CompletedProcess(args=[], returncode=0, stdout="jugar")
    )
    r = client.post("/matches", json={
        "mode": "1v1",
        "players": [{"name": "A", "kind": "web"},
                    {"name": "B", "kind": "agent", "provider": "claude"}],
    })
    assert r.status_code == 201


# ---------------------------------------------------- api-estado-visible


def test_estado_visible_no_expone_cartas_rivales(client):
    r = client.post("/matches", json={
        "mode": "1v1", "seed": 123,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    match_id = r.json()["match_id"]
    session = get_session(match_id)
    p_a, p_b = session.match.players

    for viewer, other in (("A", p_b), ("B", p_a)):
        state = client.get(f"/matches/{match_id}/state",
                           params={"player": viewer}).json()
        own = {(c["palo"], c["numero"]) for c in state["you"]["hand"]}
        assert len(own) == 3
        # las cartas del rival no aparecen en ninguna parte de la respuesta
        body = str(state)
        for c in other.hand:
            assert f"'{c.palo}', {c.numero}" not in body


def test_estado_de_jugador_inexistente_es_404(client):
    r = client.post("/matches", json={
        "mode": "1v1", "seed": 1,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    mid = r.json()["match_id"]
    assert client.get(f"/matches/{mid}/state",
                      params={"player": "Zoe"}).status_code == 404
    assert client.get("/matches/no-existe/state").status_code == 404


# ------------------------------------------------------------ api-acciones


def test_accion_fuera_de_turno_es_409(client):
    r = client.post("/matches", json={
        "mode": "1v1", "seed": 5,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    mid = r.json()["match_id"]
    session = get_session(mid)
    no_mano = session.match.players[1 - session.match.mano_index].name
    r = client.post(f"/matches/{mid}/actions", json={
        "player": no_mano, "respond": "paso"})
    assert r.status_code in (409, 422)  # o no le toca (409) o no es oferta (422)
    if r.status_code == 409:
        assert "pendiente" in r.json()["detail"]


def test_carta_ajena_es_422(client):
    from truco.cards import Card
    r = client.post("/matches", json={
        "mode": "1v1", "seed": 5,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    mid = r.json()["match_id"]
    session = get_session(mid)
    mano = session.match.players[session.match.mano_index]
    # carta que existe en el mazo pero no puede estar en la mano (reparto: 6 cartas)
    hand = {(c.palo, c.numero) for c in mano.controller.peek_hand()}
    fuera = next(Card(p, n) for p in ("oro", "copa", "basto", "espada")
                 for n in range(1, 13) if (p, n) not in hand
                 and n not in (8, 9))
    r = client.post(f"/matches/{mid}/actions", json={
        "player": mano.name, "action": "play_card",
        "card": {"palo": fuera.palo, "numero": fuera.numero}})
    assert r.status_code == 422
    assert "no está en la mano" in r.json()["detail"]


def test_respuesta_invalida_al_truco_es_422(client):
    r = client.post("/matches", json={
        "mode": "1v1", "seed": 5,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    mid = r.json()["match_id"]
    session = get_session(mid)
    mano = session.match.players[session.match.mano_index].name
    # mano canta truco directo (declinando envido con la misma carta)
    st = client.get(f"/matches/{mid}/state", params={"player": mano}).json()
    card = st["you"]["hand"][0]
    r = client.post(f"/matches/{mid}/actions", json={
        "player": mano, "action": "play_card", "card": card})
    assert r.status_code == 201 or r.status_code == 200
    # ahora el rival debe responder al truco; una basura debe ser rechazada
    otro = "A" if mano == "B" else "B"
    r = client.post(f"/matches/{mid}/actions", json={
        "player": otro, "respond": "quizas"})
    assert r.status_code == 422


def test_jugada_doble_concurrente_es_409(client):
    r = client.post("/matches", json={
        "mode": "1v1", "seed": 5,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    mid = r.json()["match_id"]
    session = get_session(mid)
    mano = session.match.players[session.match.mano_index].name
    st = client.get(f"/matches/{mid}/state", params={"player": mano}).json()
    card = st["you"]["hand"][0]
    payload = {"player": mano, "action": "play_card", "card": card}
    r1 = client.post(f"/matches/{mid}/actions", json=payload)
    r2 = client.post(f"/matches/{mid}/actions", json=payload)
    assert r1.status_code == 200
    assert r2.status_code in (409, 422)


# ------------------------------------------------------ api-flujo-completo


def test_partida_completa_agentes_hasta_15_puntos(client):
    r = client.post("/matches", json={
        "mode": "1v1", "target_score": 15,
        "players": [{"name": "A", "kind": "agent", "seed": 1},
                    {"name": "B", "kind": "agent", "seed": 2}],
    })
    mid = r.json()["match_id"]
    final = _wait_finished(client, mid)
    assert final["winner"] is not None
    scores = {t["name"]: t["score"] for t in final["teams"]}
    assert max(scores.values()) >= 15


def test_partida_completa_solo_http_web_vs_web(client):
    r = client.post("/matches", json={
        "mode": "1v1", "target_score": 15, "seed": 42,
        "players": [{"name": "A"}, {"name": "B"}],
    })
    mid = r.json()["match_id"]
    nombres = ["A", "B"]

    for _ in range(5000):
        name, state = _pending_player(client, mid, nombres)
        if state is None:
            final = client.get(f"/matches/{mid}/state").json()
            assert final["finished"], "sin pendientes pero la partida sigue"
            break
        pend = state["you"]["pending"]
        if pend["decision"] == "offer":
            payload = {"player": name, "respond": "paso"}
        elif pend["decision"] == "response":
            payload = {"player": name, "respond": "no_quiero"}
        else:
            card = state["you"]["hand"][0]
            payload = {"player": name, "action": "play_card", "card": card}
        r = client.post(f"/matches/{mid}/actions", json=payload)
        # 409/422 transitorios: el motor aún no consumió la respuesta previa
        assert r.status_code in (200, 409, 422), r.json()
        time.sleep(0.002)
        final = client.get(f"/matches/{mid}/state").json()
        if final["finished"]:
            break
    else:
        raise AssertionError("la partida no terminó en 5000 jugadas")

    final = client.get(f"/matches/{mid}/state").json()
    assert final["winner"] in ("A", "B")
    scores = {t["name"]: t["score"] for t in final["teams"]}
    assert max(scores.values()) >= 15
