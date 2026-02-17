# Файлы, отвечающие за дизайн сайта

## 🎨 Общая тема и глобальные стили

| Файл | Отвечает за |
|-------|--------------|
| `apps/web/app/layout.tsx` | Глобальный лейаут, тема (цвета, шрифты, ThemeRegistry) |
| `apps/web/components/ThemeRegistry.tsx` | MUI ThemeProvider, глобальные настройки темы (акцентный цвет `#3B82F6`) |

---

## 🏗️ Структура страницы

| Файл | Отвечает за |
|-------|--------------|
| `apps/web/app/page.tsx` | Главная страница, импорт и рендеринг компонента Calculator |
| `apps/web/components/Calculator.tsx` | Основной лейаут страницы (2 колонки на Desktop, 1 на Mobile), Paper компоненты с тенями, отступы, ширина контейнера |

---

## 📋 Компоненты формы (ввод данных)

| Файл | Отвечает за |
|-------|--------------|
| `apps/web/components/FormInputs.tsx` | **Визуал формы**: поля (TextField, Select), кнопки (Рассчитать, Сбросить), цвета ошибок, helper text, размер и отступы полей, интерактивные состояния (disabled при загрузке) |
| `apps/web/components/CalculatorTabs.tsx` | **Вкладки сверху**: стиль переключения между калькуляторами 1/2/3, активный цвет подчёркивания |

---

## 📊 Блок результата

| Файл | Отвечает за |
|-------|--------------|
| `apps/web/components/ResultBlock.tsx` | Визуал блока результата: отступы, тени Paper, кнопка "Копировать", шрифт для вывода (monospace для текста) |

---

## 🎨 Цветовая схема

Где настраиваются цвета:

**`apps/web/components/ThemeRegistry.tsx`**:
```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: "#3B82F6",  // Акцентный цвет (синий)
    },
    // ... остальные цвета по умолчанию
  },
});
```

---

## 📐 Размеры и отступы

| Компонент | Файл | Что влияет |
|-----------|---------|-----------|
| Контейнер страницы | `apps/web/app/page.tsx` (через ThemeRegistry) | Максимальная ширина `lg` |
| Бумажные карточки | `apps/web/components/Calculator.tsx` | Тень `elevation={2}`, отступы `p: 3` |
| Интервал между элементами | `apps/web/components/Calculator.tsx` | `spacing={3}` (24px) |
| Отступы формы | `apps/web/components/FormInputs.tsx` | `gap: 3` между полями |
| Минимальная высота карточки | `apps/web/components/Calculator.tsx` | `minHeight: 300` |

---

## 🔘 Кнопки и интерактивные элементы

| Где | Стиль |
|-----|--------|
| Кнопка "Рассчитать" | `apps/web/components/FormInputs.tsx` - `variant="contained"`, акцентный цвет |
| Кнопка "Сбросить" | `apps/web/components/FormInputs.tsx` - `variant="outlined"` |
| Кнопка "Копировать" | `apps/web/components/ResultBlock.tsx` - в блоке результата |

---

## 📱 Адаптивность (Mobile/Desktop)

| Файл | Логика |
|-------|---------|
| `apps/web/components/Calculator.tsx` | Grid с `size={{ xs: 12, md: 6 }}`<br>- Mobile: 1 колонка (`xs: 12`)<br>- Desktop: 2 колонки (`md: 6`) |

---

## ⚙️ Типы ввода

| Элемент | Компонент MUI | Файл |
|---------|----------------|-------|
| Выпадающий список | `Select` | `apps/web/components/FormInputs.tsx` |
| Текстовое поле (число) | `TextField` с `type="number"` | `apps/web/components/FormInputs.tsx` |
| Ошибки валидации | `FormHelperText` (красный цвет) | `apps/web/components/FormInputs.tsx` |

---

## 🎨 Изменение дизайна - Краткий гайд

### Изменить основной цвет
```typescript
// apps/web/components/ThemeRegistry.tsx
primary: {
  main: "#YOUR_COLOR",
}
```

### Изменить отступы
```typescript
// apps/web/components/Calculator.tsx
spacing={3}  // изменить число
```

### Изменить размер карточек
```typescript
// apps/web/components/Calculator.tsx
sx={{ p: 3, minHeight: 300 }}  // изменить p (padding) и minHeight
```

### Изменить шрифт результата
```typescript
// apps/web/components/ResultBlock.tsx
Typography с sx={{ fontFamily: 'monospace', whiteSpace: 'pre-line' }}
```

---

## 📦 Библиотека UI

Все визуальные компоненты построены на **MUI v7.3.8** (Material UI)
- Документация: https://mui.com/material-ui/
- Используемые компоненты: Paper, Typography, Box, Grid, Button, TextField, Select, Snackbar, Alert
