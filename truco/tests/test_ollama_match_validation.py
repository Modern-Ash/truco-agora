from unittest.mock import patch

import pytest
from fastapi import HTTPException

from truco.api import CreateMatchRequest, create_match


def ollama_request(model=None):
    return CreateMatchRequest.model_validate({
        "mode": "1v1",
        "target_score": 15,
        "engine": "deterministic",
        "players": [
            {"name": "A", "kind": "agent", "provider": "ollama", "model": model},
            {"name": "B", "kind": "agent", "provider": "mock"},
        ],
    })


def test_rechaza_ollama_sin_servicio_o_modelos():
    catalog = {"available": False, "models": [], "message": "sin conexión"}
    with patch("truco.api.discover_models", return_value=catalog):
        with pytest.raises(HTTPException, match="no está disponible") as error:
            create_match(ollama_request())
    assert error.value.status_code == 422


def test_rechaza_modelo_ollama_vacio_aunque_haya_tags():
    catalog = {"available": True, "models": ["qwen2.5:7b"]}
    with patch("truco.api.discover_models", return_value=catalog):
        with pytest.raises(HTTPException, match="elegí un modelo instalado"):
            create_match(ollama_request())


def test_rechaza_modelo_ollama_que_no_esta_instalado():
    catalog = {"available": True, "models": ["qwen2.5:7b"]}
    with patch("truco.api.discover_models", return_value=catalog):
        with pytest.raises(HTTPException, match="no está instalado"):
            create_match(ollama_request("llama3"))
