# ZS v0.2 — TODO

## Slice 15 — Монолитный guide + встроенная выдача при регистрации

Цель: агент получает полный guide одним вызовом `zs_register`, без необходимости
делать 4–6 дополнительных `zs_guide({topic})`. Guide зависит от роли (executor / architect).

### 15.1 Написать guide-executor.md ✅
- [x] Собрать из текущих 11 топиков единый текст для executor'а
- [x] Порядок: что такое ZS → цикл → операции (полный справочник) → trust model → дисциплина
- [x] Убрать cross-references ("see topic X"), дублирование, architect-only секции

### 15.2 Написать guide-architect.md ✅
- [x] Только дельта (architect reference), без дублирования executor-части
- [x] Секции: структура скрипта, серверный модуль, store, lifecycle, композиция, паттерны
- [x] В рантайме architect получает конкатенацию: executor + architect

### 15.3 zs_register — возвращать guide в ответе ✅
- [x] При регистрации определить роль → загрузить соответствующий guide
- [x] Добавить поле `guide: string` в ответ zs_register
- [x] Убрать `hint: "Call zs_guide()..."` — guide уже внутри

### 15.4 zs_guide — упростить до повторной выдачи ✅
- [x] Убрать параметр `topic`
- [x] `zs_guide()` → возвращает полный guide для текущей роли агента
- [x] Назначение: повторное чтение, или перечитывание после смены роли

### 15.5 Удалить старые guide-файлы ✅
- [x] Удалить 11 файлов из `packages/scaffold/guide/`
- [x] Удалить логику загрузки по топикам (guideTopics, GUIDE_META) — заменена на guideExecutor/guideArchitectExtra
- [x] Обновить экспорты из scaffold

### 15.6 Тесты и проверка ✅
- [x] Обновить существующие тесты guide (3 старых → 2 новых, 241/241 pass)
- [x] Проверить tsc typecheck (protocol, scaffold, server — clean)
- [x] zs_register → guide приходит (тест)
- [x] zs_guide() → возвращает полный текст (тест)

---

## Slice 16 — Улучшения agent experience (по результатам аудита workflow)

Источник: ручной прогон workflow агента Вася (executor) — выявлены
4 проблемы в UX агента при исполнении скриптов.

### 16.1 MCP tools для commit/check ✅
- [x] `zs_commit` — записывает event commit в трейс, возвращает commit_seq
- [x] `zs_check` — записывает event check в трейс, принимает commit_seq + results
- [x] Zod-схемы в protocol: `zCommitReq`, `zCommitRes`, `zCheckReq`, `zCheckRes`
- [x] Методы commit/check в ZsService
- [x] Tools в mcp-tools.ts с descriptions
- [x] Обновить guide: commit/check — теперь через MCP tools
- [x] Тесты: 241/241 pass, tsc clean

### 16.2 zs_start — флаг skip_code ✅
- [x] Добавить `skip_code?: boolean` в `zStartReq`
- [x] Если `skip_code: true` — не возвращать cog/srv код
- [x] По умолчанию `false` (обратная совместимость)
- [x] Обновить description zs_start

### 16.3 zs_report — уточнить description ✅
- [x] Description: "Fire-and-forget telemetry into the trace. Call after
  substantive operations (survey, synthesize, doubt) to build a complete trace."

### 16.4 @sandbox — явный список и подсказки ✅
- [x] `zs_start` уже возвращает `serverFunctions` агенту
- [x] Description `zs_sandbox` обновлён
- [x] Guide (executor) обновлён: явная инструкция по @sandbox + serverFunctions
