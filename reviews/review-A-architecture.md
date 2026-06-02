# Review A — Architecture & Separation of Concerns

## 1. Package separation — layer violations

**Граф зависимостей ациклический, циклов нет.** Но есть нарушения:

1. **server → scaffold** (app.ts:15): cognitiveAmbient, serverAmbient, guideTopics — runtime-артефакты в scaffold-пакете. Логически это compile-time, но используется как runtime.

2. **server → validator** (loader.ts:3, app.ts:16): extractCogShapes, extractClassInfo — compile-time функции используются в runtime. Тащит TypeScript compiler на production.

3. **protocol/server boundary нечёткая**: ZsService — абстрактная машина, ZsApp.callTool — полная реализация. Нет явного контракта.

**Рекомендация:** промежуточный пакет @zobr/compiler для compile-time утилит, lazy-loaded сервером.

---

## 2. ZsApp.callTool — god-method

**113 строк, 20 case-веток.** Но реально ~8-10 уникальных паттернов:

- Simple dispatch через tool.handle → 5 tools
- Direct app-method call → 12 tools
- State-changing wrapper → 5 tools
- Special lifecycle → 3 tools

**Проблемы:**
- Store methods (8 шт.) имеют одинаковый паттерн (lockout check + validation + db call) — дублирование
- Auth логика смешана с dispatch
- Eviction логика встроена в case для start/resume

**Стоимость:** 3/10. Не критический god-method, обычный dispatch. Рефакторинг вариант 1 (extract auth + eviction) = 15% улучшение за 3-4 часа.

---

## 3. http.ts — перегруженность

**173 строки, три слоя:**
- MCP transport (~85 строк)
- OAuth integration (~12 строк)
- REST API routing (~5 строк)
- Config + composition (~33 строки)

**Вердикт: не перегружена (2/10).** Каждый слой ~30% файла. Разделение возможно при росте до 300+ строк, сейчас не нужно.

---

## 4. Файловая модель — масштабируемость

**Модель работает. Проблемы — edge cases, не архитектура:**

| Проблема | Серьёзность |
|----------|-------------|
| config.json заявлена в спеке, не реализована | 4/10 |
| Orphaned .srv.ts создаются через API, но не запускаются | 5/10 |
| Нет валидации структуры библиотеки при старте | 3/10 |
| Нет версионирования скриптов | 2/10 (by design) |
| srv-to-srv imports не поддерживаются | 3/10 (by design) |

**На масштабе 100+ скриптов** — проблем нет. Walk по filesystem быстрый, script_ref с `/` работает.

---

## Итог

| Вопрос | Оценка |
|--------|--------|
| 1. Packages | Ациклично, но validator в runtime — нарушение |
| 2. callTool | 3/10 серьёзность, рефакторинг полезен но не срочен |
| 3. http.ts | Не перегружена |
| 4. File model | Масштабируется, edge cases в валидации |

**Итоговая оценка архитектуры: 7/10.**
