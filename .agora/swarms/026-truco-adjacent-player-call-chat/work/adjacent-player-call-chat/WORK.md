---
schema: "agora/work/v1"
id: "adjacent-player-call-chat"
swarm: "truco-adjacent-player-call-chat"
title: "Chats de canto junto a cada mano"
state: "completed"
operational-status: "active"
status-reason: null
status-by: null
status-at: null
acceptance-criteria: {"adjacent-player-chat":"Cada participante tiene su historial inmediatamente al lado de su mano","participant-message-routing":"Cada chat muestra s\u00f3lo la voz de su participante y conserva el orden global","responsive-chat-placement":"Los chats se reflejan en desktop y se apilan sin desbordar en mobile","adjacent-chat-verification":"Tests, lint, build y E2E verifican el layout y la conversaci\u00f3n"}
satisfied-criteria: ["adjacent-player-chat","participant-message-routing","responsive-chat-placement","adjacent-chat-verification"]
criterion-statuses: {"adjacent-player-chat":["satisfied"],"participant-message-routing":["satisfied"],"responsive-chat-placement":["satisfied"],"adjacent-chat-verification":["satisfied"]}
required-artifacts: ["spec","source-code","test-report"]
child-work-refs: []
budget-limits: null
---

# Chats de canto junto a cada mano

## Description

Separar el historial por participante y colocarlo junto a su mano en una composición responsive

## Acceptance criteria

- [x] **adjacent-player-chat:** Cada participante tiene su historial inmediatamente al lado de su mano; stages: satisfied
- [x] **participant-message-routing:** Cada chat muestra sólo la voz de su participante y conserva el orden global; stages: satisfied
- [x] **responsive-chat-placement:** Los chats se reflejan en desktop y se apilan sin desbordar en mobile; stages: satisfied
- [x] **adjacent-chat-verification:** Tests, lint, build y E2E verifican el layout y la conversación; stages: satisfied

## Required artifacts

- spec
- source-code
- test-report
