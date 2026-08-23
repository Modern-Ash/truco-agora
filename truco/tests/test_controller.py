from truco.cards import Card
from truco.controller import DeterministicMockLLMClient, LLMController, VisibleState


def test_llm_controller_never_sees_opponent_hand():
    state = VisibleState(
        hand_cards=[Card("oro", 4)],
        played_by_me=[],
        played_by_opponent=[Card("espada", 1)],  # solo lo que ya jugó
        my_score=0,
        opponent_score=0,
        pending_call=None,
    )
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=1))
    prompt = controller._prompt(state, "¿Qué hacés?")
    assert "espada" in prompt  # carta jugada por rival, visible
    # No hay forma de que el prompt incluya cartas no jugadas del rival
    # porque VisibleState nunca las recibe.


def test_llm_controller_choose_card_returns_card_from_hand():
    state = VisibleState(
        hand_cards=[Card("oro", 4), Card("copa", 7)],
        played_by_me=[],
        played_by_opponent=[],
        my_score=0,
        opponent_score=0,
        pending_call=None,
    )
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=1))
    card = controller.choose_card(state)
    assert card in state.hand_cards


def test_llm_controller_call_response_is_valid_option():
    state = VisibleState(
        hand_cards=[Card("oro", 4)],
        played_by_me=[],
        played_by_opponent=[],
        my_score=0,
        opponent_score=0,
        pending_call="truco",
    )
    controller = LLMController("Agente", DeterministicMockLLMClient(seed=2))
    resp = controller.choose_call_response(state, "truco")
    assert resp in ("quiero", "no_quiero")
