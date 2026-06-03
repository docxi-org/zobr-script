# ZS v0.2 — Известные компромиссы и технический долг

> Фиксируются по ходу реализации. Каждый пункт — осознанное решение,
> принятое в конкретном контексте, с указанием, когда и почему его стоит пересмотреть.

---

## ZsApp / callTool

- [ ] **callTool — god-method со switch на ~24 case.**
  `ZsApp.callTool()` — центральный диспетчер для всех MCP tool'ов. Делает
  три вещи в одном месте: (1) auth-проверку agent_id, (2) маршрутизацию по
  имени tool'а через switch, (3) side effects (tracking activeInvocations
  в start/conclude). Часть tool'ов делегирует в ZsService через
  `tool.handle(this.service, parsed)`, часть обрабатывается напрямую
  (store tools, register, CRUD, discovery) — помечена `"dispatched_by_app"`.
  **Причина:** tool handle получает `ZsService`, но app-level tools
  нуждаются в `ZsApp` (agents, db, library). Обходной путь — switch в callTool.
  **Следствия:** добавление нового tool'а требует правки в трёх местах
  (mcp-tools.ts: schema, app.ts: switch case + метод). Side effects
  start/conclude перемешаны с маршрутизацией. При ~24 tools работает,
  при 40+ станет неудобно.
  **Решение (отложенное):** заменить `handle(svc: ZsService, args)` на
  `handle(ctx: ToolContext, args)` где ToolContext предоставляет service,
  agents, db, library. Каждый tool получает самодостаточный handler,
  switch исчезает, callTool становится однострочным dispatch. Циклическая
  зависимость (mcp-tools ↔ app) разрешается интерфейсом ToolContext.
  **Когда чинить:** при росте числа tools до 40+, или при появлении
  per-tool middleware (rate limiting, per-tool logging, capability gates).

---

## Композиция скриптов (run)

`run` — вызов одного скрипта из другого как подзадачи. Пример: скрипт
`news` вызывает `run<Input, Result>("topics", { text: article })`.
В agent-driven это: агент делает `zs_start` child с `parent_invocation_id`,
исполняет child, `zs_conclude` child, продолжает parent с результатом.

- [x] **Лимит глубины вложенности.** ✅ 2026-06-03 (P0-4)
  `ZS_MAX_RUN_DEPTH` (default 10), проверка в `ZsService.start()`.

- [ ] **Нет runtime-проверки контракта parent↔child.**
  Родитель ожидает `run<Input, Result>("topics", ...)`. tsc проверяет типы
  при написании. Но если кто-то потом отредактирует `topics.cog.ts` и
  сменит контракт (другие поля, другой тип conclude) — при runtime
  `zs_start` этого не заметит. Ребёнок запустится, вернёт другую
  структуру, родитель получит невалидные данные без ошибки.
  Doc 03 §9: «контракт input/conclude совпадает с ожиданием вызывателя».
  **Следствия:** поздносвязанная поломка — ошибка проявится не на старте
  child, а позже, когда parent попробует использовать результат.
  **Решение:** (1) parent передаёт ожидаемый concludeShape при start,
  (2) сервер сравнивает с реальным concludeShape child,
  (3) mismatch → reject до создания инстанса.

- [ ] **Не тестировалось E2E.**
  Полный цикл parent→child (start child с parent_invocation_id →
  execute child → conclude child → use result in parent) через MCP
  ни разу не прогонялся. Механика должна работать (два вложенных
  start/conclude), но без теста не утверждается.
  **Решение:** E2E тест с двумя скриптами в библиотеке, один вызывает
  другой.

---

## Направленные действия (act)

`act` — когда скрипт направляет агента выполнить внешнее действие его
собственными host-tools (создать задачу в трекере, отправить письмо,
изменить конфигурацию).

Пример в скрипте:
```ts
const result = act("create a task 'Fix login bug' in the project tracker",
                   { reversible: false });
```

Как это должно работать по спеке (doc 02, doc 06 D14):

1. Агент читает `act(intent, { reversible: false })` в скрипте
2. Поскольку `reversible: false` — перед выполнением нужен verified-гейт:
   checkpoint → контроллер решает proceed/halt/ask → если
   `{ ask: "подтвердите" }` → ask_user → только потом действие
3. Агент вызывает свой host-tool (Jira API, email и т.д.)
4. Агент отчитывается через `zs_act_record` — intent + result + provenance
   попадают в трейс

Что реализовано: только шаг 4 — `zs_act_record` записывает факт
действия постфактум. Агент может: сделал действие → записал.

- [ ] **Нет pre-flight гейтинга.**
  `zs_act_record` — постфактум. Никакого `zs_act` tool'а, который бы
  ПЕРЕД действием спрашивал сервер «можно?». Агент вызывает host-tools
  напрямую, сервер узнаёт об этом только из `zs_act_record`.

- [ ] **Нет `reversible` флага.**
  В ambient (`zs.cognitive.d.ts`) `act` объявлен с `reversible?: boolean`,
  но рантайм этот параметр не обрабатывает — никакой разницы между
  `reversible: true` и `reversible: false`.

- [x] **Fence-правило `fence/ungated-act`.** ✅ 2026-06-03 (P2-3)
  act() без предшествующего checkpoint — warning.

Важный контекст: в agent-driven модели сервер физически не может
заблокировать host-tools агента (doc 05 §5: «сервер не может заставить
агента»). Контроль кооперативный — через структуру скрипта. Автор скрипта
ставит checkpoint перед act, контроллер гейтит через directive. Если автор
не поставил checkpoint — гейта нет.

По сути это не баг рантайма, а отсутствие fence-правила — fence мог бы
предупреждать: «act(reversible: false) без предшествующего checkpoint —
warning».

**Решение:** fence-правило `fence/ungated-act` (warning): если в cog.ts
есть `act(...)` с `reversible: false` (или без `reversible`, т.к. default
false) и перед ним нет `checkpoint(...)` — предупреждение. Не error, потому
что enforcement всё равно кооперативный.

---

## Контракт шага (commit/check)

`commit`/`check` — дисциплина контракта шага: объяви критерии ДО работы,
сверь результат ПОСЛЕ.

Пример в скрипте:
```ts
const c = commit({
  what: "Identify who benefits/loses",
  basis: "task: stakeholder analysis",
  verify: ">=3 distinct actors, each with a stated interest",
  boundaries: "no motive analysis yet",
});

const stakeholders = survey("who benefits or loses", { count: 5 });
check(c, { stakeholders });
```

Как это должно работать по спеке (doc 01 §7, doc 05 §6, doc 06 §6):

1. `commit(criteria)` — агент анонсирует в трейс: что делаю, на чём
   основываюсь, как проверю, границы
2. Агент выполняет работу (когнитивные операции)
3. `check(criteria, results)` — сверка. Спека описывает два уровня:
   - verified-сверка — механизируемый критерий проверяется через @sandbox
     (детерминированный код). Пример: «>=3 actors» — sandbox-функция
     считает `stakeholders.length >= 3`
   - asserted-исповедь — семантический критерий, агент сам оценивает
     (слабее). Пример: «each with a stated interest» — агент когнитивно
     проверяет
4. Несоответствие → throw `criteria_unmet` → ловится `try/catch`

Что реализовано: `commit` и `check` объявлены в `zs.cognitive.d.ts` —
агент может вызывать их. Трейс записывает события commit/check.
`criteria_unmet` объявлен в модели отказов.

- [ ] **Нет серверной verified-сверки.**
  `check` — чисто когнитивная операция. Агент сам решает, прошла ли
  сверка. Нет MCP tool'а `zs_check`, нет моста к sandbox. Критерий
  `">=3 actors"` мог бы проверяться sandbox-функцией автоматически — но
  этот путь не реализован. Весь `check` — asserted, даже когда критерий
  механизируем.

- [x] **Fence-правила для commit/check.** ✅ 2026-06-03 (P2-3)
  `fence/unpaired-commit` и `fence/check-without-commit` — оба warning.

- [ ] **Нет `criteria_unmet` throw.**
  `check` объявлен как `declare function check(c: Criteria, results: Sem): void`
  — возвращает void. Throw `criteria_unmet` подразумевается семантически
  (агент должен бросить, если не сходится), но рантайм ничего не бросает —
  это полностью на совести агента.

Контекст: в agent-driven `commit`/`check` — это ДИСЦИПЛИНА, а не
enforcement. Спека это признаёт (doc 06 §6: «градиент принуждения:
в кооперативе — предписанная дисциплина»). Агент может: (а) пропустить
check, (б) сказать «всё ок» когда не ок. Сервер не проверяет.

Единственный enforcement, который возможен без server-driven:

**Решение:** два fence-правила:
- `fence/unpaired-commit` (warning): commit без парного check до conclude
- `fence/check-without-commit` (warning): check без предшествующего commit

---

## Конфигурация скриптов (config.json)

Спека (doc 04) предполагала `config.json` рядом со скриптом — статические
настройки, доступные серверному модулю через `this.config`. Не реализовано.

- [ ] **config.json per-folder — общая конфигурация тематического набора скриптов.**

  Папка в `zs-lib/` — не просто группировка, а **пакет**: тематический набор
  скриптов с общими настройками. `config.json` в папке виден всем скриптам
  этой папки через `this.config` в srv.ts.

  ```
  zs-lib/
    config.json              ← корневой default (опционально)
    analytics/
      config.json            ← override для папки analytics
      market-scan.cog.ts
      market-scan.srv.ts
      trend-analysis.cog.ts
    examples/
      hello.cog.ts           ← нет config.json → наследует корневой
  ```

  **Семантика merge:** config.json в папке полностью заменяет корневой
  (shallow override, не deep merge). Если нужен per-script override —
  `script-name.config.json` рядом с `.cog.ts` (мержится поверх folder config).

  **Применение:**
  - Модельные параметры (`model`, `temperature`)
  - Пороги и лимиты (`threshold`, `maxRetries`)
  - API endpoints и ключи (не в коде скрипта)
  - Budget overrides (альтернатива `@budget` в JSDoc — для внешнего управления)

  **Реализация:**
  1. `reader.ts` — при `read(script_ref)` искать config.json: сначала
     `{folder}/config.json`, затем `{folder}/{name}.config.json`, затем
     корневой `zs-lib/config.json`. Merge в порядке: root → folder → script.
  2. `LoadedScript` — добавить `config?: Record<string, unknown>`
  3. `loader.ts` — передать config из reader в LoadedScript
  4. `srv-runtime.ts` / worker — пробросить config в `this.config`
  5. `ZsScript` base class — `this.config` уже объявлен, подставить реальные данные

  **Когда делать:** при появлении реального потребителя — третий-четвёртый
  скрипт в одной папке, или скрипт с внешними настройками (API ключ, модель).
  До тех пор `@budget` в JSDoc покрывает самый частый per-script override.

---

## Trace hierarchy (cause/effect graph)

Trace events — плоский массив, упорядоченный по seq. Нет причинно-следственных
связей между событиями. Когда скрипт делает `survey → doubt → synthesize`,
все три события лежат рядом по времени, но нет явной связи "doubt оспаривал
результат survey" или "synthesize объединял результаты doubt и survey".

- [ ] **parent_event_seq — причинно-следственные связи в трейсе**

  **Текущее состояние:**
  ```
  seq=1  op=start        trust=n/a
  seq=2  op=survey       trust=asserted   inputs=[]
  seq=3  op=doubt        trust=asserted   inputs=[]
  seq=4  op=report       trust=asserted   inputs=[]
  seq=5  op=synthesize   trust=asserted   inputs=[]
  seq=6  op=checkpoint   trust=verified   inputs=[]
  seq=7  op=conclude     trust=asserted   inputs=[]
  ```
  Все events на одном уровне. `inputs` содержит handle IDs, но это данные,
  не причинность. Нельзя узнать что `doubt` (seq=3) был ответом на
  `survey` (seq=2), или что `synthesize` (seq=5) объединял `survey` + `doubt`.

  **Предлагаемое решение:**

  1. `TraceEvent` — добавить `parent_seq?: number`:
     ```typescript
     export interface TraceEvent {
       readonly seq: number;
       readonly t: string;
       readonly op: string;
       readonly realizer: Realizer;
       readonly trust: TrustClass;
       readonly inputs: readonly string[];
       readonly output?: string;
       readonly preview?: string;
       readonly meta?: Readonly<Record<string, unknown>>;
       readonly parent_seq?: number;  // ← NEW: seq of the event this was caused by
     }
     ```

  2. **Кто устанавливает parent_seq:**
     - Агент передаёт `parent_seq` при вызове MCP tools (zs_report, zs_checkpoint и др.)
     - Это необязательное поле — агенты без поддержки hierarchy продолжают
       работать как раньше (flat trace)
     - Сервер записывает parent_seq в трейс без валидации (trust = asserted
       для причинности, как и для содержания)

  3. **Скрипт как декларация:**
     Скрипт описывает линейную последовательность, но agent может выполнять
     операции в произвольном порядке, с ветвлениями. `parent_seq` позволяет
     агенту сообщить о фактической структуре своего рассуждения.

  4. **Frontend — дерево рассуждения:**
     - Trace Detail: переключатель "Timeline / Tree" для event panel
     - Tree view группирует события по parent_seq, показывает вложенность
     - Корневые события (без parent_seq) — верхний уровень
     - Дочерние — indented под родителями

  5. **Coverage по поддеревьям:**
     С parent_seq можно вычислять coverage для каждого поддерева —
     какие ветки рассуждения обоснованы, какие нет. Но это расширение,
     не первая итерация.

  **Изменения:**
  - `core/src/trace.ts` — `parent_seq` в `TraceEvent`, `NewEvent`
  - `protocol/src/messages.ts` — `parent_seq` в zod-схемах report/checkpoint/sandbox
  - `server/src/app.ts` — пробросить parent_seq из MCP args в trace append
  - `web/src/api/types.ts` — `parent_seq` в TraceEvent type
  - `web/src/pages/trace-detail.tsx` — Tree view (toggle Timeline/Tree)

  **Когда делать:** при появлении сложных скриптов с ветвлениями (3+ уровней
  вложенности операций), или при работе с агентами которые поддерживают
  structured reasoning. Для линейных скриптов (hello, insight) — не нужно.

---

## Бэкапы SQLite

Нет бэкапов. Потеря VPS = потеря всех данных: traces, agents, users, OAuth tokens,
store collections, snapshots.

- [ ] **Ежедневные бэкапы SQLite на VPS**

  **Файлы базы:**
  - `data/store.sqlite` — основная БД (traces, agents, invocations, store, users)
  - `data/store-oauth.sqlite` — OAuth клиенты и токены

  **Стратегия:**

  1. **SQLite online backup** — использовать `.backup` команду или `VACUUM INTO`
     для создания консистентного бэкапа без остановки сервера. WAL mode
     позволяет читать пока сервер пишет.
     ```bash
     sqlite3 /opt/zobr-script/data/store.sqlite ".backup /opt/backups/zs/store-$(date +%F).sqlite"
     sqlite3 /opt/zobr-script/data/store-oauth.sqlite ".backup /opt/backups/zs/oauth-$(date +%F).sqlite"
     ```

  2. **Cron job** на VPS — ежедневно в 03:00:
     ```bash
     # /etc/cron.d/zs-backup
     0 3 * * * root /opt/zobr-script/scripts/backup.sh
     ```

  3. **Ротация** — хранить последние 7 дней локально:
     ```bash
     find /opt/backups/zs/ -name "*.sqlite" -mtime +7 -delete
     ```

  4. **Remote sync (опционально)** — rsync/rclone в S3 или другое удалённое
     хранилище для защиты от потери VPS целиком.

  **Скрипт `scripts/backup.sh`:**
  ```bash
  #!/bin/bash
  set -e
  BACKUP_DIR="/opt/backups/zs"
  mkdir -p "$BACKUP_DIR"
  DATE=$(date +%F)
  sqlite3 /opt/zobr-script/data/store.sqlite ".backup $BACKUP_DIR/store-$DATE.sqlite"
  sqlite3 /opt/zobr-script/data/store-oauth.sqlite ".backup $BACKUP_DIR/oauth-$DATE.sqlite"
  find "$BACKUP_DIR" -name "*.sqlite" -mtime +7 -delete
  echo "Backup completed: $DATE"
  ```

  **Мониторинг:** добавить healthcheck endpoint `/api/backup-status` или
  записывать последний бэкап в notes store и проверять через admin UI.

  **Когда делать:** перед первым реальным использованием системы с ценными
  данными. Для development/demo — не критично.

---

## Мобильная версия фронтенда

SPA спроектирована исключительно для desktop: sidebar, split view в Trace Detail,
Monaco Editor, DataTable с колонками, Command Palette. На мобильном устройстве
всё сжимается без адаптации — нет ни одного `@media` запроса, breakpoints,
responsive layout.

- [ ] **Проработка мобильной адаптации SPA**

  **Текущее состояние:**
  - Sidebar: фиксированная ширина ~200px, не сворачивается
  - Trace Detail: split view code/events — на narrow screen бесполезен
  - Monaco Editor: не работает на touch-устройствах
  - DataTable: колонки не скрываются, горизонтальный скролл
  - Command Palette (Cmd+K): нет на мобильных

  **Минимальный scope:**
  1. Sidebar → hamburger menu на экранах < 768px
  2. Trace Detail split → tabs (Code / Events) вместо side-by-side
  3. DataTable → скрытие неосновных колонок, responsive card view
  4. Monaco Editor → read-only mode на touch (editing на мобильном нереалистично)
  5. Breakpoints: `sm` (< 640), `md` (< 768), `lg` (< 1024)

  **Подход:**
  - Tailwind responsive utilities (`sm:`, `md:`, `lg:`) уже доступны
  - CSS custom properties для breakpoints в `index.css`
  - `useMediaQuery` hook для conditional rendering
  - Постепенная адаптация: sidebar → tables → trace detail → scripts

  **Effort:** ~20-30h (полная адаптация), ~8h (только sidebar + tables).

  **Когда делать:** при появлении мобильных пользователей. Для админов
  и агентов-разработчиков desktop — основной сценарий.

---

## MCP Guide: расширить паттерны

`packages/scaffold/guide/08-patterns.md` содержит 4 паттерна: hello, insight,
gated checkpoint, multi-stage. Этого недостаточно для самостоятельной работы
архитектора — нет примеров для распространённых сценариев.

- [ ] **Добавить 5-8 паттернов + debugging guide**

  **Недостающие паттерны:**
  1. **Error handling** — try/catch в cog, `criteria_unmet`, fallback через
     doubt + pivot, report ошибки, graceful degradation
  2. **Human-in-the-loop (HITL)** — `ask_user` для подтверждений, checkpoint
     с директивой `{ ask: "..." }`, ожидание ответа
  3. **act + gated side effects** — act с reversible flag, checkpoint перед
     необратимым действием, act_record с provenance
  4. **Deep run (composition)** — скрипт вызывает другой через `run()`,
     parent_invocation_id, depth, передача результата
  5. **Long-running with checkpoints** — периодические checkpoint для
     восстановления после eviction, TTL awareness
  6. **Retrieve + grounded analysis** — retrieve из внешнего источника,
     trust verified через provenance, ground vs retrieve
  7. **Store persistence** — collections CRUD, notes key-value,
     данные между запусками скрипта
  8. **Multi-agent collaboration** — два агента работают с одним скриптом
     (executor + reviewer), role gating

  **Debugging guide:**
  - Как читать trace events
  - Coverage метрика: что значат числа
  - Checkpoint directives: proceed/revise/halt
  - Типичные ошибки: shape mismatch, budget exhausted, unknown_fn

  **Performance playbook:**
  - @budget для тяжёлых скриптов
  - Checkpoint для восстановления
  - Cold storage и resume
  - Когда разбивать на несколько скриптов

  **Файлы:** `packages/scaffold/guide/08-patterns.md` (расширить),
  опционально `guide/11-debugging.md`, `guide/12-performance.md`

  **Effort:** 8h

  **Когда делать:** после появления реальных сценариев использования.
  Паттерны должны быть проверены практикой, а не написаны умозрительно.
  Каждый новый скрипт — кандидат на паттерн.
