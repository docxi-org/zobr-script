# zobr-script-v2

Реализация **ZS (Zobr Script) v0.2** — язык когнитивных скриптов как MCP-сервис.
Спецификация — отдельный пакет документов (`zs-spec/`).

## Стек
- Node 22 LTS, **pnpm**, **ESM**
- **TypeScript 6**, **Vitest** (тесты)
- бэкенд (позже): **NestJS 12** + MCP SDK 1.29 (Streamable HTTP)

## Раскладка (монорепо, pnpm workspaces)
- `packages/core` — framework-free доменное ядро ZS (инстанс/стор/трейс/валидация/
  песочница/контроллер). Тестируется в изоляции. *Срез 1: семя пакета.*
- `packages/scaffold` — каноничный scaffold ZS-библиотеки (`zs.*.d.ts` + tsconfig'и),
  который сервер материализует авторам, + тесты, доказывающие, что типы принуждают спеку.
- `packages/server` — оболочка NestJS 12 (DI ядра, монтирование MCP, позже REST). *Заглушка (срез 6).*

## Команды
```
pnpm install
pnpm run typecheck
pnpm test
```

## Статус
**Срез 1** — слой типов + scaffold + проверка валидацией (зелёный).
**Срез 2** — детерминированное ядро `@zobr/core` (зелёный): handle + store (pass-by-handle),
trace + метрика покрытия, status/lifecycle, budgets, instance.
**Срез 3** — движок валидации `@zobr/validator` (зелёный): tsc-как-библиотека + структурный
AST-fence. Одна функция `validateScript()` для write-тайма и старта.
**Срез 4** — порт песочницы (зелёный): `SandboxHost` (порт), `SandboxDispatcher`
(capability-скоупинг, charge бюджета, стор-по-хэндлу, verified-трейс), `CapabilitySet`.
**Срез 5** — контроллер + схема на стыке (зелёный): порт `ControllerHost`
(`onStart`/`onCheckpoint`/`onReport`, `NO_CONTROLLER` для чисто когнитивных скриптов),
`ControlDriver` (`report` fire-and-forget, `checkpoint` → `Directive` с применением `halt`,
`ask` сквозь), и `checkShape`/`Shape` — структурная валидация значения на verified-стыке
(sandbox-выход, report/checkpoint-payload): грубый сбой → `schema_mismatch`, форма а не истина.
Дескриптор формы выводится из TS-типа (единый источник); ядро без зависимостей.

**Срез 6a** — транспортно-независимый протокол `@zobr/protocol` (зелёный): контракты `zs_*`
с zod-схемами (единый zod на MCP/REST/рантайм), `InvocationRegistry` (идемпотентность по
ключу, fail-closed), `ZsService` поверх портов `@zobr/core` — start/sandbox/report/checkpoint/
conclude/status, с валидацией результата `conclude` против `concludeShape`. Тестируется
фейковыми loader/controller/host, без транспорта. (`@zobr/core` без зависимостей; zod — здесь.)

**6b-контракт** — каркас `@zobr/server` (зелёный + спецификация): `ZsApp` (composition
root), `MCP_TOOLS`+`dispatchTool` (реестр zs_*-инструментов с zod, транспортно-независимый),
`FsScriptLoader` (реальная validate-at-start через `@zobr/validator`), сигнатуры
`WorkerSandboxHost`/`ScriptSourceReader`. Реальные части протестированы (87 passed); то, что
требует рантайма, зафиксировано как **13 `it.todo`** в `test/6b-contract.test.ts` — это
исполняемый список для Claude Code (реализовать → превратить todo в проходящий тест).

**Дальше — 6b-мясо (Claude Code):** `main.ts`, монтирование MCP Streamable HTTP (SDK 1.29),
DI-проводка Nest, worker_threads-реализация `WorkerSandboxHost`, FS-reader/материализация
scaffold, role-guards. red→green против каркаса и `it.todo`-спецификации с живым транспортом.
