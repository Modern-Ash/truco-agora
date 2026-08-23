---
schema: "agora/approvals/v1"
approval-roles: ["spec-owner"]
---

# Approvals

| Role | Approved by | Note | Timestamp |
| --- | --- | --- | --- |
| spec-owner | project:owner | LLMEngine implementado y wireado como default en CLI/API; riesgo de arbitraje inconsistente documentado y aceptado explícitamente por el usuario en docs/llm-engine.md. 101/101 tests, E2E completo OK (default provider=mock => idéntico al motor determinista; con proveedor real configurado el riesgo advertido queda en manos del operador). | 2026-08-23T17:19:17.218605Z |
