"""Tests de API v2: señas efímeras y cartas tapadas por HTTP."""
import time

import pytest
from fastapi.testclient import TestClient

from truco.api import app, get_session


@pytest.fixture()
def client():
    return TestClient(app)


def _match_2v2(client, **kw):
    payload = {"mode": "2v2", "target_score": 15,
               "players": [{"name": n} for n in ("A", "B", "C", "D")]}
    payload.update(kw)
    return client.post("/matches", json=payload).json()["match_id"]


# ------------------------------------------------------------------ señas

def test_sena_mismo_equipo_entrega_unica(client):
    mid = _match_2v2(client)
    r = client.post(f"/matches/{mid}/senas",
                    json={"de": "A", "para": "C", "sena": "guiño"})
    assert r.status_code == 201 and r.json()["ok"]

    # entrega única: aparece una vez en el GET del receptor y desaparece
    s1 = client.get(f"/matches/{mid}/state", params={"player": "C"}).json()
    assert s1["you"]["sena_recibida"] == {"de": "A", "sena": "guiño"}
    s2 = client.get(f"/matches/{mid}/state", params={"player": "C"}).json()
    assert s2["you"]["sena_recibida"] is None


def test_sena_rival_rechazada(client):
    mid = _match_2v2(client)
    r = client.post(f"/matches/{mid}/senas",
                    json={"de": "A", "para": "B", "sena": "guiño"})
    assert r.status_code == 422
    assert "compañeros" in r.json()["detail"]


def test_sena_invalida_y_autoenvio_rechazados(client):
    mid = _match_2v2(client)
    assert client.post(f"/matches/{mid}/senas",
                       json={"de": "A", "para": "C", "sena": "pispi"}).status_code == 422
    assert client.post(f"/matches/{mid}/senas",
                       json={"de": "A", "para": "A", "sena": "guiño"}).status_code == 422


def test_sena_jugador_inexistente_404(client):
    mid = _match_2v2(client)
    r = client.post(f"/matches/{mid}/senas",
                    json={"de": "A", "para": "Z", "sena": "guiño"})
    assert r.status_code == 404


# ----------------------------------------------------------------- tapadas

def test_tapada_por_http_oculta_cara_a_los_demas(client):
    """Un jugador juega tapada: los rivales ven {'tapada': true}; el dueño ve
    la cara real. Se fuerza con seed hasta encontrar mano de apertura."""
    mid = client.post("/matches", json={
        "mode": "2v2", "target_score": 15, "seed": 7,
        "players": [{"name": n} for n in ("A", "B", "C", "D")],
    }).json()["match_id"]

    def pending(name):
        return client.get(f"/matches/{mid}/state",
                          params={"player": name}).json()

    # avanza hasta que A tenga un menú de acción (jugar) disponible
    state = None
    for _ in range(4000):
        st_a = pending("A")
        pend = (st_a["you"] or {}).get("pending")
        if pend and pend["decision"] == "action":
            state = st_a
            break
        if pend and pend["decision"] == "offer":
            client.post(f"/matches/{mid}/actions",
                        json={"player": "A", "respond": "paso"})
            continue
        # si el turno es de otro, responde mínimo para avanzar
        for n in ("B", "C", "D"):
            st = pending(n)
            pd = (st["you"] or {}).get("pending")
            if not pd:
                continue
            if pd["decision"] == "offer":
                client.post(f"/matches/{mid}/actions",
                            json={"player": n, "respond": "paso"})
            elif pd["decision"] == "response":
                client.post(f"/matches/{mid}/actions",
                            json={"player": n, "respond": "no_quiero"})
            else:
                card = st["you"]["hand"][0]
                client.post(f"/matches/{mid}/actions",
                            json={"player": n, "action": "play_card",
                                  "card": card})
            break
        time.sleep(0.001)

    assert state is not None, "A nunca tuvo turno de acción"
    card = state["you"]["hand"][0]
    r = client.post(f"/matches/{mid}/actions",
                    json={"player": "A", "action": "play_card",
                          "card": card, "tapada": True})
    assert r.status_code == 200, r.text

    own = pending("A")["you"]["played"]
    assert {"palo": card["palo"], "numero": card["numero"]} in own

    for rival in ("B", "C", "D"):
        st = pending(rival)
        a_entry = next(o for o in st["others"] if o["name"] == "A")
        assert {"tapada": True} in a_entry["played"], (rival, a_entry)
