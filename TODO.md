# ZS v0.2 — TODO

---

## Срез 9 — Frontend (SPA)

Спека: `spec/ui/00-overview.md`, `spec/ui/01-wireframes.md`, `spec/ui/02-api.md`.

### 9.4. Deploy

- [x] **9.4.1** Express раздаёт `packages/web/dist/` в production (express.static в main.ts).
- [x] **9.4.2** GitHub Actions: pnpm install → build frontend → rsync → PM2 reload.
- [x] **9.4.3** workflow_dispatch input `reset_db` для разового сброса SQLite.
- [x] **9.4.4** .env шаблон с `ZS_JWT_SECRET` и `ZS_ADMIN_PASSWORD`.
- [x] **9.4.5** Push на master + ручной запуск с reset_db=true.

---

## Срез 10 — Unified Guide & Per-Agent Roles

Спека: `spec/13-unified-guide.md`.

### 10.1. Guide контент

Написать 11 `.md` файлов в `packages/scaffold/guide/`.

- [x] **10.1.1** `00-overview.md` [both] — что такое ZS, цикл, роли, как читать guide.
- [x] **10.1.2** `01-operations.md` [both] — семантика каждой когнитивной операции, trust-класс, отличия, примеры.
- [x] **10.1.3** `02-trust.md` [both] — trust-модель: asserted / verified / authority, verified seams.
- [x] **10.1.4** `03-script-structure.md` [architect] — cog + srv, контракт, entry point, conclude<T>.
- [x] **10.1.5** `04-server-module.md` [architect] — ZsScript, Db, Collection, Notes, Directive, примеры.
- [x] **10.1.6** `05-store.md` [architect] — collections + notes, store.d.ts schema, standalone vs this.db.
- [x] **10.1.7** `06-lifecycle.md` [architect] — hot/cold, TTL, eviction, resume, checkpoint для восстановления.
- [x] **10.1.8** `07-composition.md` [architect] — define-inline < @sandbox < run, когда что.
- [x] **10.1.9** `08-patterns.md` [architect] — hello, insight, gated, multi-stage.
- [x] **10.1.10** `09-discipline.md` [both] — commit/check, honesty, fail-closed, human-in-the-loop.
- [x] **10.1.11** `10-ambients.md` [both] — cognitive + server + store.d.ts, полные сигнатуры.

### 10.2. MCP tool `zs_guide`

- [x] **10.2.1** Zod-схемы: `zGuideReq` (topic?: string), `zGuideRes` (content | toc).
- [x] **10.2.2** Загрузчик `.md` файлов из `packages/scaffold/guide/`.
- [x] **10.2.3** Регистрация tool `zs_guide` в `mcp-tools.ts`.
- [x] **10.2.4** `app.ts` — handler: без topic → оглавление с пометками ролей, с topic → текст статьи.
- [x] **10.2.5** `10-ambients.md` — динамически подставлять актуальные `.d.ts` + `store.d.ts`.

### 10.3. Убрать старые источники

- [x] **10.3.1** Удалить `zs_authoring_guide` из `mcp-tools.ts`.
- [x] **10.3.2** Удалить `zs_operations` из `mcp-tools.ts`.
- [x] **10.3.3** Удалить `operations()` и `authoringGuide()` из `app.ts`.
- [x] **10.3.4** Обновить `protocol/messages.ts` — убрать старые схемы, добавить новые.

### 10.4. Минимизировать instructions

- [x] **10.4.1** `EXECUTOR_INSTRUCTION` → 1–2 предложения с указанием на `zs_guide()`.
- [x] **10.4.2** `START_PREAMBLE` → 1 предложение с указанием на `zs_guide()`.

### 10.5. Coverage: trust по содержанию

- [x] **10.5.1** `trust.ts` — `"n/a"` уже был в TrustClass.
- [x] **10.5.2** `control.ts` — report: trust `"verified"` → `"asserted"`.
- [x] **10.5.3** `instance.ts` — start и status_transition: trust `"verified"` → `"n/a"`.
- [x] **10.5.4** `trace.ts` — coverage(): пропускать trust `"n/a"` при подсчёте.
- [x] **10.5.5** Обновить тесты coverage (ожидания по verified/asserted).

### 10.6. Per-agent роли

- [x] **10.6.1** Столбец `role` в таблице agents (`db.ts`), default `executor`.
- [x] **10.6.2** `AgentRegistry.setRole(agentId, role)` + persist в SQLite.
- [x] **10.6.3** `zs_register` response — добавить `role` и `hint` про guide и повышение.
- [x] **10.6.4** `callTool` — проверка роли агента перед architect-tools, мягкий отказ с подсказкой.
- [x] **10.6.5** Убрать `ZS_ARCHITECT_MODE` из env, `http.ts`, `ecosystem.config.cjs`, `.env` template.
- [x] **10.6.6** Регистрировать все tools всегда (не фильтровать по architectMode).

### 10.7. REST API + Frontend

- [x] **10.7.1** `PUT /api/agents/:id/role` — endpoint смены роли.
- [x] **10.7.2** Agent Detail (`pages/agents.tsx`) — переключатель роли executor/architect.
- [x] **10.7.3** i18n — ключи для роли, подсказок, переключателя (en + ru).

### 10.8. Help (user-facing docs)

- [x] **10.8.1** Обновить `public/docs/en/trust-classes.md` и `ru/` — trust по содержанию, report=asserted.
- [x] **10.8.2** Обновить `public/docs/en/coverage.md` и `ru/` — новая семантика метрики.

### 10.9. Тесты и финализация

- [x] **10.9.1** Тесты: guide loading (оглавление + конкретный topic + несуществующий). → mcp-tools.test.ts
- [x] **10.9.2** Тесты: role gating (executor → architect tool → отказ, architect → ok). → 6b-contract.test.ts
- [x] **10.9.3** Тесты: coverage (report=asserted, start=n/a, sandbox=verified). → control.test.ts, instance.test.ts
- [x] **10.9.4** Тесты: `PUT /api/agents/:id/role` — 5 тестов в api.test.ts.
- [x] **10.9.5** Typecheck clean, 228 тестов зелёные.
- [x] **10.9.6** Обновить CLAUDE.md, README.md.

---

## Срез 11 — Explicit conclude(result)

Замысел: `conclude<T>()` → `conclude<T>(result: T): T`. Скрипт явно привязывает
каждое поле Result к конкретным шагам рассуждения. Агент не додумывает — исполняет.
Sem-хэндлы кастятся через `as` (`pattern as string`). Сервер валидирует итоговую форму
(shape validation не меняется).

### 11.1. Ambient + scaffold

- [x] **11.1.1** `packages/scaffold/lib-template/zs.cognitive.d.ts` — `conclude<T>()` → `conclude<T>(result: T): T`.
- [x] **11.1.2** `zs-lib/zs.cognitive.d.ts` — обновлено вручную (scaffold пересоздаст при старте).

### 11.2. Example scripts

- [x] **11.2.1** `zs-lib/examples/hello.cog.ts` — явный result: summary из synthesize, confidence из assess.
- [x] **11.2.2** `zs-lib/examples/insight.cog.ts` — полный маппинг: pattern as string, mechanisms as string[], assess → confidence, [antithesis, stress] as string[].

### 11.3. Guide

- [x] **11.3.1** `packages/scaffold/guide/01-operations.md` — conclude с примером маппинга.
- [x] **11.3.2** `packages/scaffold/guide/03-script-structure.md` — пример с explicit result.
- [x] **11.3.3** `packages/scaffold/guide/08-patterns.md` — все 4 паттерна обновлены.
- [x] **11.3.4** `packages/scaffold/guide/10-ambients.md` — сигнатура conclude(result: T).
- [x] **11.3.5** `packages/scaffold/guide/09-discipline.md` — describe explicit mapping.

### 11.4. Help (user-facing docs)

- [x] **11.4.1** `public/docs/en/concepts/how-scripts-work.md` + `ru/` — примеры с explicit conclude.
- [x] **11.4.2** Остальные help docs — упоминают conclude как текст, code-правок не требуют.

### 11.5. Validator / Fence

- [x] **11.5.1** `extractCogShapes` — парсит `conclude<T>({...})` корректно (извлекает type arg, не function arg).
- [x] **11.5.2** Fence — не блокирует conclude с аргументом.
- [x] **11.5.3** Изменений в validator/fence не потребовалось.

### 11.6. Тесты

- [x] **11.6.1** `packages/scaffold/test/` — fixtures обновлены.
- [x] **11.6.2** `packages/validator/test/` — все inline fixtures обновлены + server test fixtures.
- [x] **11.6.3** Typecheck clean, 228 тестов зелёные.

---

## Срез 12 — MCP OAuth 2.1

OAuth на MCP-подключение. Референс: MCP TypeScript SDK 2.0 (`C:\~AGI\typescript-sdk-2.0.0.1-alpha.1`).
Библиотека: `better-auth` + плагин `mcp` из `better-auth/plugins`.

### 12.1. Зависимости

- [x] **12.1.1** `pnpm add better-auth cors @types/cors` в packages/server.
- [x] **12.1.2** Совместимость подтверждена: better-auth + better-sqlite3 + Node 22.

### 12.2. Auth Server (better-auth + MCP plugin)

- [x] **12.2.1** `packages/server/src/oauth.ts` — `createZsOAuth()`: better-auth + MCP plugin, отдельный SQLite, email+password, dynamic client registration.
- [x] **12.2.2** OAuth tables — schema в initSchema(), seed admin через signUpEmail.
- [x] **12.2.3** Login page — `/oauth/sign-in` (HTML-форма, POST → signInEmail → redirect to authorize).
- [x] **12.2.4** Discovery endpoints: `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource/mcp`.

### 12.3. Bearer Auth Middleware

- [x] **12.3.1** `requireBearerAuth()` в oauth.ts — проверка token через getMcpSession, WWW-Authenticate header.
- [x] **12.3.2** Подключено к POST/GET/DELETE `/mcp` в http.ts (dynamic import когда OAuth включён).
- [x] **12.3.3** `ZS_OAUTH=true` в .env — opt-in. Без него MCP работает без auth (обратная совместимость).

### 12.4. Связка user → agent

- [x] **12.4.1** Bearer token → oauthUser (userId, email, clientId, scopes) в req.
- [x] **12.4.2** Роль агента устанавливается через REST API. OAuth защищает транспорт.
- [x] **12.4.3** PUT /api/agents/:id/role: executor-пользователь не может назначить architect.

### 12.5. SPA интеграция

- [x] **12.5.1** `/oauth/sign-in` — HTML login page для OAuth flow (form → signInEmail → authorize redirect).
- [x] **12.5.2** Consent — auto-approve через better-auth MCP plugin (allowDynamicClientRegistration).

### 12.6. Deployment

- [x] **12.6.1** `.env` — `ZS_OAUTH=true` (opt-in). OAuth DB отдельный файл (store-oauth.sqlite).
- [x] **12.6.2** Nginx — не требуется, все OAuth routes на том же порте 1978.
- [x] **12.6.3** Seed admin — реализовано в createZsOAuth (signUpEmail при старте).

### 12.7. Тесты и финализация

- [x] **12.7.1** Тест: MCP без OAuth → 228 тестов зелёные (обратная совместимость).
- [ ] **12.7.2** Тест: MCP с OAuth → 401 без токена, 200 с валидным Bearer. (Требует E2E с better-auth — отложено до ручной проверки на VPS).
- [x] **12.7.3** Тест: executor не может назначить architect (api.test.ts).
- [x] **12.7.4** Typecheck clean, 228 тестов зелёные.
- [x] **12.7.5** Обновить CLAUDE.md, README.md.

---

## Срез 13 — zs_retrieve: agent-side retrieval

Агент выполняет retrieval своими host-tools, сервер фиксирует результат в трейсе.
Trust по provenance: внешний источник → verified, из знаний агента → asserted.

### 13.1. Protocol

- [ ] **13.1.1** `messages.ts` — расширить `zRetrieveReq`: `query: string`, `source?: string`, `data: unknown`, `provenance: string`. Убрать старый формат.
- [ ] **13.1.2** `messages.ts` — `zRetrieveRes`: `{ ok: true }` (данные приняты) или ошибка.
- [ ] **13.1.3** `service.ts` — убрать stub `retrieve()`. Записать событие в трейс: `op: "retrieve"`, `realizer: "external"`, `trust` по provenance. Если provenance содержит tool/source → `"verified"`, иначе `"asserted"`.

### 13.2. MCP tool

- [ ] **13.2.1** `mcp-tools.ts` — обновить description `zs_retrieve`: "Report data retrieved from an external source using your own tools. Provide the data you obtained and the provenance (tool name, source, URL)."
- [ ] **13.2.2** `app.ts` — если retrieve проходит через callTool dispatching, обновить case.

### 13.3. Guide (agent-facing docs)

- [ ] **13.3.1** `guide/01-operations.md` — retrieve: семантика, пример с provenance, отличие от report (retrieve = факты, report = рассуждения).
- [ ] **13.3.2** `guide/02-trust.md` — trust по provenance: verified если данные из внешнего tool, asserted если из знаний агента.
- [ ] **13.3.3** `guide/09-discipline.md` — retrieve vs ground: когда что.

### 13.4. Help (user-facing docs)

- [ ] **13.4.1** `public/docs/en/concepts/how-scripts-work.md` + `ru/` — retrieve с примером.
- [ ] **13.4.2** `public/docs/en/concepts/trust-classes.md` + `ru/` — retrieve provenance → trust.

### 13.5. Тесты и финализация

- [ ] **13.5.1** Тест: `zs_retrieve` с provenance → событие в трейсе, trust verified.
- [ ] **13.5.2** Тест: `zs_retrieve` без provenance → trust asserted.
- [ ] **13.5.3** Typecheck clean, тесты зелёные.
- [ ] **13.5.4** Обновить CLAUDE.md.
