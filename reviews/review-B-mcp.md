# Review B — MCP Protocol & Tools

## 5. 27 MCP tools — полнота

**Полнота ~95%.** Покрытие по категориям:

- Жизненный цикл (6): start, conclude, status, resume, abort, sandbox — complete
- Трейс (3): report, ask_record, act_record — complete
- Обнаружение (3): list, read, guide — complete
- CRUD (4): validate, create, update, delete — complete
- Хранилище (8): collections CRUD + notes CRUD — complete
- Регистрация (1): register — complete
- Внешние (1): retrieve — **stub** ("KB not yet available")
- Контроль (1): checkpoint — complete

### Пробелы:
1. **`zs_retrieve` — затычка.** Агент может вызвать, но KB не реализован. Discovery-операция мертва.
2. **Нет soft-reset / restart.** `zs_abort` убивает, `zs_resume` восстанавливает из cold. Нет "перезапустить с новыми inputs" без потери invocation context.
3. **Store API излишне раскиданный.** 8 tools на две параллельные иерархии (collections + notes). Можно консолидировать.

### Избыточность:
Явных дубликатов нет, но зернистость store подозрительна — два параллельных механизма усложняют API.

---

## 6. zs_guide — достаточность для архитектора

**65/100 для production-ready architect.** Базис хороший, но критически не хватает:

### Что есть и работает:
- overview, operations, trust, script-structure, server-module, store, lifecycle, composition, discipline, ambients — 10 из 11 топиков solid

### Что не хватает:
1. **Patterns (08) — только 2 примера.** Нет примеров с:
   - Глубокой вложенностью (run → run)
   - Обработкой ошибок (try/catch в cog)
   - HITL (ask_user в checkpoint gate)
   - act с reversible flag
   - Долгоживущим скриптом (checkpoint для eviction-safety)
2. **Testing guide** — как писать тесты для скриптов? Есть ли test-runtime?
3. **Performance / Budgets playbook** — когда @sandbox vs child-script? Примеры бюджетов.
4. **Миграция и версионирование** — как обновить script при active invocations?
5. **Debugging guide** — как читать трейс при ошибке?
6. **Security model @sandbox** — что если метод попытается выйти за sandbox?

**Достаточно для прототипирования, недостаточно для системного дизайна.**

---

## 7. zs_register — идемпотентность по имени

**ДА, это проблема.**

### Сценарии:
| Сценарий | Следствие | Критичность |
|----------|-----------|-------------|
| Случайное совпадение имён | Два клиента делят agent_id, invocations, роль | HIGH |
| Злоумышленное захватывание | Предсказуемые имена → захват роли architect | HIGH |
| Утечка activeInvocations | Client B видит invocations от Client A | HIGH |

### Текущие защиты:
- Нет namespace (глобальное пространство)
- Нет валидации имён
- Нет проверки источника запроса

### Рекомендуемые фиксы:
1. Требовать (name, owner) → agent_id от хеша
2. Session-based identity: agent_id per-session, имя для UI
3. Возвращать conflict при дублировании вместо идемпотентности

---

## 8. Instructions — достаточность

**Слишком скудно.**

Текущее: 2 строки EXECUTOR_INSTRUCTION + 1 строка START_PREAMBLE.

### Пропущено:
1. **Обработка ошибок** — что делать при transient vs semantic error?
2. **Роли и permissions** — агент не знает, может ли вызвать zs_create
3. **TTL/budgets** — invocation evict через 1h, агент не предупреждён
4. **Sem vs data** — операции возвращают handles, не данные
5. **Директивы checkpoint** — proceed/halt/ask — что делать с каждой?
6. **retrieve vs ground** — разница не объяснена

### Рекомендуемый текст (7 правил, ~100 слов):
```
You are a ZS agent. Call zs_guide() for detailed reference.

Key rules:
1. Operations return semantic handles (Sem), not data. Use handles as inputs.
2. Report truthfully: distinguish grounded (from retrieve) from asserted (model memory).
3. On error: if transient, retry once. If semantic (schema_mismatch), stop and ask.
4. If checkpoint returns { ask }, relay the question to the user and wait.
5. Invocations auto-evict after 1 hour. For long tasks, checkpoint often.
6. Your role is in zs_register response. architect can create scripts; executor cannot.
7. When in doubt — stop. Do not fabricate data or operations.
```

---

## Итог

| Вопрос | Оценка | Критичность |
|--------|--------|-------------|
| 5. Полнота tools | 95% | LOW — добавить soft-reset, consolidate store |
| 6. Guide | 65% | HIGH — нужны паттерны, debugging, perf playbook |
| 7. Register idempotency | Проблема | HIGH — namespace или session-based identity |
| 8. Instructions | Недостаточно | HIGH — расширить с 2 до 7 правил |
