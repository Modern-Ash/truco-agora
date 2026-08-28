from truco.api import MatchSession


class RecoveringMatch:
    def __init__(self):
        self.winner = None
        self.calls = 0

    def play_hand(self):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("fallo transitorio")
        self.winner = object()


def test_session_reintenta_una_mano_sin_publicar_interrupcion(monkeypatch):
    monkeypatch.setattr("truco.api.SESSION_RECOVERY_DELAY_SECONDS", 0)
    match = RecoveringMatch()
    session = MatchSession("recoverable", match, {})

    session._run()

    assert match.calls == 2
    assert session.error is None
    assert session.recovering is False
    assert session.recovery_error is None
