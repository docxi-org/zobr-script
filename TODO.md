# ZS v0.2 — TODO

## Slice 15 — Монолитный guide + встроенная выдача при регистрации

Цель: агент получает полный guide одним вызовом `zs_register`, без необходимости
делать 4–6 дополнительных `zs_guide({topic})`. Guide зависит от роли (executor / architect).

### 15.1 Написать guide-executor.md
- [ ] Собрать из текущих 11 топиков единый текст для executor'а
- [ ] Порядок: что такое ZS → цикл → операции (полный справочник) → trust model → дисциплина
- [ ] Убрать cross-references ("see topic X"), дублирование, architect-only секции
- [ ] Целевой объём: ~3000 токенов

### 15.2 Написать guide-architect.md
- [ ] Включает всё из executor guide + секции:
  - Структура скрипта (cog + srv, контракт, conclude)
  - Серверный модуль (ZsScript, Db, Collection, Notes, Directive)
  - Store (collections, notes, store.d.ts)
  - Lifecycle (hot/cold, TTL, eviction, resume)
  - Композиция (run, @sandbox, define-inline)
  - Паттерны (примеры с аннотациями)
- [ ] Целевой объём: ~5000 токенов

### 15.3 zs_register — возвращать guide в ответе
- [ ] При регистрации определить роль → загрузить соответствующий guide
- [ ] Добавить поле `guide: string` в ответ zs_register
- [ ] Убрать `hint: "Call zs_guide()..."` — guide уже внутри

### 15.4 zs_guide — упростить до повторной выдачи
- [ ] Убрать параметр `topic`
- [ ] `zs_guide()` → возвращает полный guide для текущей роли агента
- [ ] Назначение: повторное чтение, или перечитывание после смены роли

### 15.5 Удалить старые guide-файлы
- [ ] Удалить 11 файлов из `packages/scaffold/guide/`
- [ ] Удалить логику загрузки по топикам (guideLoader / guideIndex)
- [ ] Обновить экспорты из scaffold

### 15.6 Тесты и проверка
- [ ] Обновить существующие тесты guide
- [ ] Проверить tsc typecheck
- [ ] E2E: zs_register → убедиться что guide приходит
- [ ] E2E: zs_guide() → убедиться что возвращает полный текст
