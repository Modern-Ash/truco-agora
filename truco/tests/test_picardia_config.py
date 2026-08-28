import pytest
from fastapi import HTTPException

from truco.api import CreateMatchRequest, create_match


def team_request(*, first_level=None, team_levels=None):
    players = [
        {"name": "A1", "kind": "agent", "provider": "mock"},
        {"name": "B1", "kind": "agent", "provider": "mock"},
        {"name": "A2", "kind": "web"},
        {"name": "B2", "kind": "web"},
    ]
    if first_level is not None:
        players[0]["bluff_level"] = first_level
    return CreateMatchRequest(
        mode="2v2",
        engine="deterministic",
        players=players,
        team_bluff_levels=team_levels,
    )


def agent_configs(state):
    players = [state["you"], *state["others"]]
    return {
        player["name"]: player["agent"]
        for player in players
        if "agent" in player
    }


def test_team_bluff_levels_se_resuelven_por_paridad_de_asiento():
    data = create_match(team_request(team_levels=["mentiroso", "cauteloso"]))
    configs = agent_configs(data["state"])

    assert data["picardia_scope"] == "team"
    assert data["state"]["picardia_scope"] == "team"
    assert [team["bluff_level"] for team in data["state"]["teams"]] == [
        "mentiroso", "cauteloso",
    ]
    assert configs["A1"]["bluff_level"] == "mentiroso"
    assert configs["A1"]["bluff_scope"] == "team"
    assert configs["B1"]["bluff_level"] == "cauteloso"


def test_bluff_level_individual_tiene_precedencia_sobre_el_equipo():
    data = create_match(team_request(
        first_level="equilibrado",
        team_levels=["mentiroso", "cauteloso"],
    ))
    configs = agent_configs(data["state"])

    assert configs["A1"]["bluff_level"] == "equilibrado"
    assert configs["A1"]["bluff_scope"] == "player"


@pytest.mark.parametrize("mode, levels", [
    ("1v1", ["equilibrado", "mentiroso"]),
    ("2v2", ["equilibrado"]),
    ("2v2", ["equilibrado", "temerario"]),
])
def test_team_bluff_levels_rechaza_configuraciones_invalidas(mode, levels):
    players = (
        [{"name": "A"}, {"name": "B"}]
        if mode == "1v1"
        else [{"name": name} for name in ("A1", "B1", "A2", "B2")]
    )
    request = CreateMatchRequest(
        mode=mode,
        players=players,
        team_bluff_levels=levels,
    )

    with pytest.raises(HTTPException) as error:
        create_match(request)

    assert error.value.status_code == 422
