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

- [ ] **Нет лимита глубины вложенности.**
  Instance хранит `depth` (0, 1, 2...), но ZsService.start() не проверяет
  максимум. Скрипт A → B → C → D → ... без ограничения. Doc 06 G21
  требует: «глубина ограничена рантаймом → halted_budget».
  **Следствия:** бесконечная рекурсия скриптов не блокируется сервером.
  **Решение:** проверка `depth >= maxDepth` в ZsService.start(), конфиг
  `ZS_MAX_RUN_DEPTH` (default 10), reject при превышении.

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

- [ ] **Нет fence-правила.**
  Спека подразумевает, что скрипт с `act(intent, { reversible: false })`
  ОБЯЗАН иметь checkpoint перед ним. Fence это не проверяет.

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

- [ ] **Нет fence-правила для unpaired commit.**
  Doc 09 §7: «предупреждение о commit без парного check до conclude».
  Fence проверяет duplicate labels для checkpoint/report, но НЕ проверяет,
  что каждый `commit` имеет парный `check`. Агент может написать
  `commit(...)`, забыть `check(...)`, и дойти до `conclude` без сверки —
  валидатор промолчит.

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
