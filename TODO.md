# ZS v0.2 — TODO


## Срез 13 — zs_retrieve: agent-side retrieval

Агент выполняет retrieval своими host-tools, сервер фиксирует результат в трейсе.
Trust по provenance: внешний источник → verified, из знаний агента → asserted.

### 13.1. Protocol

- [x] **13.1.1** `messages.ts` — расширить `zRetrieveReq`: `query: string`, `source?: string`, `data: unknown`, `provenance: string`. Убрать старый формат.
- [x] **13.1.2** `messages.ts` — `zRetrieveRes`: `{ ok: true }` (данные приняты) или ошибка.
- [x] **13.1.3** `service.ts` — убрать stub `retrieve()`. Записать событие в трейс: `op: "retrieve"`, `realizer: "external"`, `trust` по provenance.

### 13.2. MCP tool

- [x] **13.2.1** `mcp-tools.ts` — обновить description `zs_retrieve`.
- [x] **13.2.2** `app.ts` — не требуется (retrieve делегирует через handle, не через callTool dispatch).

### 13.3. Guide (agent-facing docs)

- [x] **13.3.1** `guide/01-operations.md` — retrieve: семантика, provenance, отличие от report и ground.
- [x] **13.3.2** `guide/02-trust.md` — trust по provenance.
- [x] **13.3.3** `guide/09-discipline.md` — retrieve vs ground.

### 13.4. Help (user-facing docs)

- [x] **13.4.1** `public/docs/en/concepts/trust-classes.md` + `ru/` — retrieve provenance → trust.
- [x] **13.4.2** `public/docs/en/concepts/how-scripts-work.md` + `ru/` — retrieve в таблице операций с provenance.

### 13.5. Тесты и финализация

- [x] **13.5.1** Тест: `zs_retrieve` с provenance → событие в трейсе, trust verified.
- [x] **13.5.2** Тест: `zs_retrieve` без provenance → trust asserted.
- [x] **13.5.3** Typecheck clean, 242 теста зелёные.
- [x] **13.5.4** Обновить CLAUDE.md.
