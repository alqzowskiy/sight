# Sight

Дашборд и лендинг для управления ликвидностью финтех-компании. Показывает мультивалютные позиции, 14-дневные прогнозы баланса, кризисные сценарии и AI-инсайты для вымышленной платёжной компании NovaPay.

Прогнозы готовятся офлайн Python-пайплайном (`ml/`): ансамбль моделей обучается на каждый счёт и экспортирует статический JSON, который Next.js читает в рантайме.

## Стек

- **Next.js 16** (App Router) на React 19
- **Tailwind CSS v4** + `tw-animate-css`
- **Zustand** для клиентского состояния, **Recharts** для графиков, **Cobe** для глобуса
- **Motion** (наследник Framer Motion) для анимаций
- **AI SDK v6** с OpenAI / Vercel AI Gateway для `/api/insights`
- **Python ML-пайплайн**: ансамбль Prophet / ARIMA / ETS / LightGBM, экспорт в JSON

## Бэкенд

Полноценного бэкенда нет — только один stateless endpoint:

- **`POST /api/insights`** — принимает `accountId` и `dayOffset`, валидирует через Zod, рейт-лимитит (20 запросов/мин на IP), читает прогнозы из `public/data/forecasts.json` и зовёт `gpt-4o-mini` через AI SDK, чтобы сгенерировать короткий инсайт по счёту.

Базы данных, авторизации и сессий нет. Все данные счетов и прогнозов — статические JSON в `public/data/`, собранные офлайн ML-пайплайном `ml/`.

## Запуск

Нужен Node 20+ и pnpm.

```bash
pnpm install
cp .env.example .env        # добавь OPENAI_API_KEY (или используй AI Gateway на Vercel)
pnpm dev
```

Открой <http://localhost:3000> — лендинг, <http://localhost:3000/dashboard> — продукт.

### Переменные окружения

- `OPENAI_API_KEY` — нужен для `/api/insights`. Получить: <https://platform.openai.com/api-keys>.
- `AI_GATEWAY_API_KEY` — выставляется автоматически при деплое на Vercel, позволяет ходить через Vercel AI Gateway вместо ключа провайдера.

## Структура

```
app/
  page.tsx              лендинг (собирается из components/landing/*)
  dashboard/            дашборд казначейства, кризисная лаборатория, лаборатория моделей
  api/insights/         AI-инсайты (AI SDK + OpenAI)
components/
  landing/              hero, секции, dock-навигация, футер
  dashboard/            карточки счетов, графики прогнозов, алерты, command palette
  sight/                глобус и бренд-марка
  sidebar/ ui/          общие примитивы
lib/
  data/                 типизированные загрузчики счетов / прогнозов / алертов / сценариев
  store/                Zustand-сторы (accounts, demo, time machine, insights, ui)
  utils/                общие хелперы
public/data/            accounts.json, forecasts.json, backtest_results.json, world-110m.json
ml/                     Python-пайплайн (см. ml/README.md)
types/                  общие TS-типы
```

## ML-пайплайн

Фронтенд читает три статических файла: `public/data/accounts.json` (закоммиченные метаданные) плюс `forecasts.json` и `backtest_results.json` (генерируются пайплайном). В рантайме Python не вызывается.

Перегенерировать всё:

```bash
cd ml
uv sync                 # или: python -m venv .venv && pip install -e .
python scripts/run_all.py
```

Скрипт синтезирует 180 дней транзакций NovaPay, обучает модели по счетам, экспортирует 14-дневный прогноз и прогоняет walk-forward бэктест. Подробности — в [`ml/README.md`](ml/README.md).

## Скрипты

```bash
pnpm dev      # next dev
pnpm build    # next build
pnpm start    # next start
pnpm lint     # eslint
```

## Деплой

Проект деплоится на Vercel как есть. `ml/`, `.env*` и `*.pdf` исключены через `.vercelignore` — пайплайн крутится локально, в деплой едет только сгенерированный JSON.

## Заметки

- Проект на Next.js 16 и React 19. API, файловые конвенции и дефолты кэширования отличаются от старых версий — смотри `node_modules/next/dist/docs/` и `AGENTS.md`.
- Дашборд рассчитан на десктоп; на мобильных показывается фолбэк.
