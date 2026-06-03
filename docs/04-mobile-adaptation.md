# Задание дизайнеру: мобильная адаптация ZS Console

## Контекст

ZS Console — SPA для управления когнитивными скриптами. Текущий макет (`ui/`) спроектирован для desktop (1280px+). Нужна адаптация под мобильные устройства и планшеты.

**Опорный материал:** `ui/ZS Frontend.html` — рабочий прототип, `ui/app/` — компоненты, `ui/app/tokens.css` — дизайн-токены.

## Breakpoints

| Токен | Ширина | Контекст |
|-------|--------|----------|
| `sm` | < 640px | Телефон вертикально |
| `md` | 640–1024px | Телефон горизонтально, планшет |
| `lg` | > 1024px | Desktop (текущий макет без изменений) |

## Что адаптировать

### 1. Sidebar → Hamburger

**Desktop (lg):** sidebar фиксированный слева, ~200px, всегда видим.

**Mobile (sm/md):**
- Sidebar скрыт по умолчанию
- Hamburger-кнопка в header (слева)
- По нажатию — sidebar выезжает поверх контента (overlay + backdrop)
- Свайп влево или tap на backdrop — закрытие
- Навигация по пункту — sidebar автоматически закрывается

### 2. Header

**Desktop:** полная строка: breadcrumb + tweaks + user info.

**Mobile:**
- Hamburger (слева) + заголовок страницы (центр) + user avatar (справа)
- Tweaks panel — доступен через иконку настроек в header
- Breadcrumb — скрыть или упростить до иконки "назад"

### 3. DataTable

Используется на страницах: Dashboard, Traces, Scripts (table view), Agents, Runs, Store.

**Desktop:** все колонки видны, сортировка по клику на заголовок.

**Mobile:**
- Основные колонки видны (name/ref, status)
- Второстепенные (coverage, date, agent) — скрыты или в раскрывающейся строке
- Альтернатива: card layout вместо table (переключение на sm)
- Сортировка — через dropdown/select вместо колонок
- Пагинация — упростить (prev/next вместо номеров страниц)

### 4. Trace Detail (split view)

**Desktop:** split code/events — два панели рядом, перетаскиваемый разделитель.

**Mobile:**
- Tabs вместо split: "Код" / "События" / "Покрытие"
- Переключение tab — полноширинный контент
- Coverage summary — отдельный tab или collapsible внизу

### 5. Script Detail

**Desktop:** Monaco Editor на всю высоту, tabs (Когнитивная/Серверная/Contract/Runs).

**Mobile:**
- Editor в read-only mode (Monaco не работает на touch)
- Code отображается как подсвеченный текст (highlight, не editor)
- Tabs — горизонтальный scroll если не помещаются
- Diff view — vertical вместо side-by-side

### 6. Login / OAuth

**Desktop:** центрированная карточка 380px.

**Mobile:** уже адаптивна (max-width: 380px, padding). Проверить на 320px.

### 7. Help

**Desktop:** sidebar категорий + контент.

**Mobile:** категории как accordion или отдельный экран. Контент — полная ширина.

### 8. Tweaks Panel

**Desktop:** slide-in panel справа.

**Mobile:** fullscreen modal или bottom sheet.

## Дизайн-токены для mobile

Добавить в `tokens.css`:

```css
/* density: mobile (auto на sm) */
[data-density="mobile"], @media (max-width: 640px) {
  --row-h: 44px;      /* touch target min 44px */
  --pad: 16px;
  --gap: 12px;
  --fs-base: 15px;    /* чуть крупнее для читаемости */
  --fs-sm: 13px;
  --fs-xs: 12px;
}
```

Touch targets: минимум 44×44px для кнопок и интерактивных элементов (Apple HIG).

## Что НЕ трогать

- Цветовая палитра, темы (dark/light), accent colors — без изменений
- Иконки — те же SVG
- Общий стиль (скруглённые карточки, border стиль) — сохранить
- Desktop layout (lg) — без изменений

## Deliverables

1. Обновлённый `ui/ZS Frontend.html` с responsive поведением
2. Обновлённый `ui/app/tokens.css` с mobile density
3. Обновлённый `ui/app/layout.jsx` с hamburger/overlay sidebar
4. Новый `ui/app/responsive.css` или media queries в существующих файлах
5. Скриншоты / превью всех страниц на 375px и 768px
