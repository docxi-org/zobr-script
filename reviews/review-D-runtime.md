# Review D — Script Execution & Runtime

## 12. conclude<T>(result: T) с `as` кастами — type-safety

**Фикция type-safety. Runtime проверяет форму, не истину.**

- `as string` касты полностью игнорируются runtime — TypeScript только проверяет соответствие типу T
- Если `t = 123`, `t as string` проходит tsc, runtime получает `{ summary: 123 }`
- `checkShape` проверяет `typeof value === "string"` — поймает. Но `{ a: undefined }` вместо `{ a: string }` — не поймает

**Питфолы:**
| Сценарий | tsc | Runtime |
|----------|-----|---------|
| `t as string` где t=123 | pass | checkShape reject (number vs string) |
| `{ a: undefined }` vs `{ a: string }` | error | pass (key exists, value wrong) |
| Circular ref в JSON.stringify | error | crash |
| `result: "не JSON"` строка | type error | tryParseJson fallback |

**Вердикт:** `as` касты — компромисс между выразительностью и безопасностью. checkShape ловит грубые ошибки формы, но не семантику.

---

## 13. Hot/Cold snapshot/restore — data loss

**Form (Instance): полностью сохраняется.** JSON-сериализация trace, store, status, budgets.

**Worker state: рискованно если:**
- Класс не реализует `snapshotState()` → workerState = null
- State содержит Map, Set, Function, Promise → JSON.stringify fails
- Crash во время async save → partial snapshot

**Safe:**
- trace.events — всегда persist в БД
- Instance fields — полная сериализация
- Eviction → snapshot → destroy — атомарно по порядку

**Рекомендация:** тесты для edge-cases (circular refs, big structures), документировать ограничения для .srv авторов.

---

## 14. Shape validation — покрытие типов

**Покрыто:**
- Primitives (string, number, boolean)
- Literal unions ("low" | "medium" | "high")
- Homogeneous arrays (string[])
- Flat objects ({ key: Type })
- Optional fields

**НЕ покрыто (fallback на `unknown` = валидация отключена):**
- Structural unions (string | number)
- Discriminated unions ({ type: "A" } | { type: "B" })
- Generics (Container<T>)
- Recursive types (Tree = { children: Tree[] })
- Tuples ([string, number])
- Conditional types
- Template literals

**Вердикт:** достаточно для текущих скриптов (простые Result types). Сложные типы требуют JSON Schema или расширения Shape.

---

## 15. Budgets — global only

**Текущее:** `ZS_BUDGET_STEPS=1000`, `ZS_BUDGET_ITERATIONS=100` — env-переменные, глобальные.

**Нет per-script конфигурации.** Если скрипт требует 5000 steps — нужно менять env для всех.

**Две метрики — что не покрыто:**
- Нет timeout (wall-clock) — внешние зависимости не контролируются
- Нет контроля памяти — HandleStore растёт без ограничений
- Нет контроля вложенности — глубокие run() цепочки только через TTL
- Нет динамического пересчёта при resume

**Рекомендация:** per-script budgets через JSDoc или `script.json` metadata + StartReq override.

---

## Итог

| Вопрос | Критичность |
|--------|-------------|
| 12. conclude type-safety | HIGH — данные могут быть неверны |
| 13. Snapshot/restore | MEDIUM — дисциплина в .srv |
| 14. Shape validation | MEDIUM — сложные типы = unknown |
| 15. Budgets | MEDIUM — нет per-script config |
