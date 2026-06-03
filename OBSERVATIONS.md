# ZS v0.2 — Наблюдения по архитектуре и замыслу

Дата: 2026-06-03. Автор: Pobisk (Claude Code).
Не баги и не tech debt — концептуальные наблюдения после полной реализации и двух ревью.

---

## 1. Линейность скриптов vs нелинейность рассуждения

Скрипт — линейная декларация: survey → doubt → synthesize → checkpoint → conclude.
Агент исполняет последовательно. Но реальное рассуждение нелинейно: на шаге 4
агент может понять, что шаг 2 был неверным. Нет механизма backtracking.

**Сейчас:** единственный выход — abort + restart. Старый trace сохраняется
для диагностики, но работа потеряна.

**Чего не хватает:**
- `revise(step)` — вернуться к шагу, пересмотреть с новыми данными
- `rollback_to(checkpoint_label)` — откатить состояние до checkpoint
- Ветвление: if doubt нашёл критическое — alternative path

**Когда станет проблемой:** на скриптах с 10+ шагами, где стоимость restart
высокая (retrieve из внешних источников, act с побочными эффектами).

**Возможный подход:** checkpoint как точка сохранения, rollback восстанавливает
Instance state до checkpoint. Шаги после checkpoint отменяются в трейсе
(маркируются как `reverted`). Агент продолжает от checkpoint с новыми данными.

---

## 2. Coverage — метрика без порога

Coverage (verified / (verified + asserted)) показывается в UI, но не используется
для решений. 43% или 5% — разницы для системы нет.

**Сейчас:** coverage — информационная метрика на dashboard. Визуальная: зелёная
дуга на donut chart. Нет:
- Порога "coverage < X% = warning" на уровне скрипта
- Gating: "не принимать conclude если coverage ниже порога"
- Рекомендации агенту: "coverage низкая, добавь checkpoint или retrieve"

**Вопрос:** должна ли coverage быть gating mechanism, или это навсегда advisory?
Gating опасен — агент начнёт "накручивать" coverage бессмысленными checkpoint'ами.
Advisory с порогом предупреждения — безопаснее.

**Возможный подход:** `@coverage min=0.4` в JSDoc скрипта (как @budget).
При conclude: если coverage ниже — warning в трейсе, не reject. UI подсвечивает
красным. Скрипт-архитектор решает нужен ли порог.

---

## 3. Retrieve с provenance — honest label, не verified fact

retrieve с provenance записывается как `trust: "verified"`. Но provenance —
строка от агента. Агент может написать `provenance: "company_db"` не обращаясь
ни к какой базе. Сервер не проверяет что provenance реален.

**Фактически:** retrieve с provenance = "asserted-with-citation". Агент утверждает
что данные из источника и называет источник. Это лучше чем голый assert (есть
цитирование), но не настоящий verified (нет серверной проверки).

**Настоящий verified retrieve** возможен только если:
- Сервер сам ходит в источник (отвергнуто — усложняет систему)
- Или provenance подтверждается cryptographic proof (подпись от источника)
- Или агент вызывает server function (@sandbox) которая делает fetch

**Третий вариант реалистичен:** скрипт может иметь srv-метод
`fetchFromDB(query: string)` — sandbox function, результат verified. Тогда
retrieve в cog = `const data = fetchFromDB("revenue Q3")` → verified event.
Это уже работает через существующий sandbox механизм.

**Рекомендация:** документировать что retrieve + provenance = "cited assertion",
а для true verified retrieval использовать sandbox server functions. Или ввести
третий trust class: `cited` — между asserted и verified.

---

## 4. Store API — есть, но не проверен end-to-end

8 store tools (collections + notes), SQLite backend, worker own connection.
Всё реализовано и протестировано unit-тестами. Но нет ни одного сценария где
данные действительно переиспользуются между запусками.

**Сейчас:** insight.srv.ts сохраняет данные в notes при checkpoint. Но никто
их потом не читает. Нет скрипта который:
1. Читает данные от предыдущего запуска
2. Принимает решение на основе исторических данных
3. Дополняет коллекцию инкрементально

**Что это значит:** store может работать, а может иметь edge cases в production
(concurrent access, WAL при restart, data migration при schema change). Без
реального use case — неизвестно.

**Рекомендация:** при написании первого production скрипта — намеренно
использовать store. Например: скрипт анализа, который при повторном запуске
сравнивает текущие результаты с предыдущими.

---

## 5. Следующий шаг: реальный скрипт

Все демо-скрипты (hello, insight) — иллюстрации. Ни один не решает реальную
задачу. Написание одного production скрипта выявит:

- Работает ли retrieve + checkpoint + store end-to-end
- Достаточно ли 4 паттернов в guide для архитектора
- Как агент ведёт себя с EXECUTOR_INSTRUCTION (7 правил)
- Как coverage выглядит на реальных данных
- Где скрипт хочет backtracking а не может

**Кандидаты:**
- Анализ PR / code review с retrieve из GitHub API
- Мониторинг: сбор метрик → сравнение с предыдущим → alert
- Планирование: декомпозиция задачи с checkpoint-гейтами
