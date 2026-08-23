# Spec: Motor de reglas arbitrado por LLM

Work item: `truco-llm-engine/llm-arbitrated-engine`.

## Decisión y riesgo aceptado (documentado explícitamente)

El usuario pidió reemplazar el motor determinista (`engine.py`: `beats()`,
`best_envido()`, `_decide_hand_winner()`) por arbitraje vía LLM en **todos**
los puntos de entrada (CLI, API, webapp), como default.

Se le advirtió el riesgo concreto antes de implementar:
- Las reglas del truco son fijas, pero un LLM arbitrando en vivo puede fallar
  **aritmética** (ej. sumar 7+4+20=31 para envido) o **lógica condicional
  multi-caso** (ej. la cadena de resolución de parda: 1ª ronda empata → decide
  la 2ª → si también empata, decide la 3ª → si las tres empatan, gana la
  mano) de forma silenciosa — sin tirar error, devolviendo una respuesta que
  suena razonable pero es incorrecta.
- Esto puede alterar quién gana una mano/partida sin que nadie lo note, y sin
  garantía de reproducibilidad (el mismo estado puede arbitrarse distinto en
  corridas distintas).

**El usuario aceptó explícitamente este riesgo** y pidió proceder igual, tras
la advertencia. Esta spec documenta esa decisión como registro de la sesión.

## Mitigación (no elimina el riesgo, lo acota)
- El motor determinista (`engine.py`) **no se borra**: sigue siendo la
  implementación de referencia, usable con `--engine deterministic`, y sigue
  siendo la base de los tests de reglas ya existentes (cards/envido/engine).
- `LLMEngine` solo cae al cálculo determinista cuando la respuesta del LLM
  **no se puede parsear** como JSON válido (fallback de robustez técnica, no
  una preferencia de reglas) — y cada fallback se loguea (`logger.warning`)
  para que sea auditable cuántas veces el LLM "falló en responder" vs.
  "respondió pero puede haberse equivocado en el contenido" (este segundo
  caso no es detectable automáticamente sin el propio motor determinista
  corriendo en paralelo, que es exactamente el modo que el usuario pidió
  reemplazar).

## Diseño de `LLMEngine` (`truco/llm_engine.py`)
Reutiliza `Card`, `Player`, `Team` de `engine.py` (modelo de datos, sin
lógica de arbitraje). Reemplaza tres puntos de decisión, cada uno vía
`LLMClient.generate()` con un prompt que pide **JSON estricto**:

1. `compare_cards(a: Card, b: Card) -> int`: le pasa al LLM las dos cartas y
   el ranking completo del reglamento (extraído de spec.md), pide
   `{"result": 1 | -1 | 0}`.
2. `envido_value(cards: List[Card]) -> int`: le pasa las 3 cartas de la mano
   y las reglas de cálculo de envido, pide `{"value": <int>}`.
3. `decide_hand_winner(results, mano_name, pie_name) -> Optional[str]`: le
   pasa la secuencia de resultados de ronda (mano/pie/parda) y la regla de
   resolución de pardas completa, pide `{"winner": "<name>" | null}`.

Cada llamada arma el prompt con el fragmento relevante del reglamento
(spec.md) embebido, para que el LLM tenga el contexto completo y no dependa
de memoria de entrenamiento sobre las reglas del truco.

## Selección de motor
`--engine {llm,deterministic}` en CLI (default: `llm`); campo `engine` en
`CreateMatchRequest` de la API (default: `"llm"`); la webapp hereda el
default de la API salvo que se pase explícito.

## Tests (parity, no e2e con LLM real)
Los tests no llaman a un LLM real: mockean `LLMClient.generate()` con
respuestas JSON *correctas* conocidas, y verifican que `LLMEngine` produce
el mismo resultado que las funciones deterministas equivalentes en los
mismos casos ya cubiertos por `test_cards.py`/`test_envido.py`/
`test_engine.py`. Esto prueba que el *mecanismo* de arbitraje LLM funciona
como se diseñó — no prueba que un LLM real en producción vaya a acertar
siempre (ese es precisamente el riesgo aceptado arriba, no verificable con
tests deterministas).

## Fuera de alcance
- Verificación cruzada en tiempo real LLM-vs-determinista (anularía el
  propósito de "reemplazar" el motor).
- Telemetría de tasa de acierto del LLM en producción.
