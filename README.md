# Sight

🌐 **Live demo: <https://trysight.vercel.app/>**

**Sight** — это веб-продукт для **управления ликвидностью финтех-компании**. Дашборд казначейства вымышленной платёжной компании **NovaPay**: 11 банковских счетов в 5 валютах (EUR, USD, GBP, SGD, CHF), интерактивный 3D-глобус с живыми денежными потоками, ML-прогноз каждого счёта на 14 дней вперёд и AI-инсайты через OpenAI.

Проект делает три вещи:

1. **Видит сейчас** — мультивалютные позиции и потоки между банками на анимированном глобусе в реальном времени.
2. **Видит наперёд** — ансамбль из 5 ML-моделей прогнозирует дневной баланс каждого счёта и подсвечивает те, что упадут ниже регуляторного минимума.
3. **Подсказывает действие** — поверх прогноза выдаёт алерты с уже рассчитанным рекомендованным переводом (откуда → куда, сумма, канал SWIFT/SEPA) и AI-инсайт от `gpt-4o-mini`.

Это **демо-продукт / хакатон-кейс**: все данные о NovaPay синтетические, фронтенд — Next.js 16 + React 19, прогнозы готовятся офлайн Python-пайплайном и кладутся в репо как статический JSON. Полноценного бэкенда и базы нет.

---

## TL;DR

```bash
pnpm install
cp .env.example .env        # OPENAI_API_KEY (или AI Gateway на Vercel)
pnpm dev                    # http://localhost:3000
```

- `/` — лендинг
- `/dashboard` — главный продукт
- `/dashboard/lab` — метрики ML-моделей и бэктест

---

## Сюжет

Под капотом зашит один центральный сценарий: счёт **`usd-nyc` (NovaPay USD · NYC, JPMorgan)** сконфигурирован так, что за 180 дней истории дрейфует ниже своего минимума `$800K`. ML это видит, проецирует слабость ещё на 14 дней вперёд, и Sight кричит «NYC в беде» через алерты, красный статус и AI-инсайт.

Поверх этого есть кризисные сценарии (`SWIFT Outage 48h`, `Black Friday Surge` и др. — `lib/data/crisis-scenarios.ts`), которые применяются как дельты к прогнозу и позволяют стресс-тестить казну.

---

## Что внутри дашборда

### Шапка
- **Liquidity Score** — общий health-score (`lib/utils/scoring.ts`)
- **⌘K Command Palette** — быстрый поиск по счетам и действиям
- **New Transfer** — модалка ad-hoc-перевода
- **Crisis** — переключатель кризисных сценариев
- **Demo** — авто-проигрывание сценария «деградация → алерт → исполнение»
- **Reset** — сброс всего к стартовому состоянию

### Левая колонка
- Список из 11 счетов (`AccountCard`) с балансом, минимумом, статусом и анимированным числом (`NumberTicker`).
- Hover по карточке мягко вращает глобус к счёту.
- Клик — открывает выезжающую панель с деталями.

### Центр — интерактивный глобус (`SightGlobe`)
3D-глобус на canvas (`d3-geo` + орфографическая проекция) с целым набором живых анимаций:

- **Живые денежные потоки**: каждые 2–4 секунды на глобусе появляется частица, летящая по Bezier-арке от одного счёта к другому. Канал определяет цвет и скорость:
  - SEPA Instant — синий, 1000 мс
  - SEPA Standard — голубой, 1200 мс
  - VISA / MASTERCARD — серый, 1400 мс
  - SWIFT — чёрный, 1800 мс (самый медленный — небольшой обучающий момент)
  - INTERNAL — пунктирный серый, 800 мс
  - Над частицей — лейбл `$120K · SEPA`, при прибытии маркер пульсирует.
- **Hover insight cards**: задерживаешь курсор на маркере → появляется карточка с балансом, статусом, мин. лимитом и поток-итогами за сессию.
- **Camera Auto-Focus**: новый critical-алерт → глобус плавно вращается к проблемному счёту + красный sonar-пульс. Исполнение перевода через Compass → синий пульс на получателе.
- **Time-aware visual states**: при сдвиге Time Machine в прошлое/будущее появляется бейдж `Forecast +5d` / `History -7d`, арки переводов слегка затухают.
- **Drag · Scroll · 0 to reset** — глобус управляется мышью, при простое медленно вращается. Клик по маркеру открывает панель деталей (как клик по карточке слева).

### Правая колонка — алерты
- **Alerts Panel** строит алерты **вычисляемо**, не из JSON. `lib/data/alerts.ts:useAlertsAt(offset)` пробегает прогноз на 7 дней вперёд, ищет счета, у которых баланс < 1.2× minBalance, и подбирает донора (тот же currency предпочтительнее, иначе SWIFT) — это и есть рекомендованный перевод.
- Каждая карточка показывает дату алерта, confidence, кнопку **Execute Plan** и **Get AI Insight**.

### Нижний бар — Time Machine
- Слайдер от -60 до +60 дней. Все балансы, статусы и алерты пересчитываются «на момент `offset`» через `getEffectiveBalanceAt` / `getEffectiveStatusAt` в `lib/utils/forecast.ts`. Поверх накатываются crisis-дельты.

### Sight Compass (баннер сверху)
- `lib/utils/sight-compass.ts` ранжирует `critical` счета по дефициту, ищет доноров с buffer > 1.15× minBalance + $200K и предлагает пакет переводов. Кнопка `Apply` исполняет весь план за раз — глобус ловит cinematics: множественные арки, accent-blue свечение, sonar.

### Sight Lab (`/dashboard/lab`)
- Метрики ML: MAPE на горизонтах 1/3/7/14, coverage P10/P90, F1 по обнаружению дефицитов, actual-vs-predicted графики.
- Сравнение 6 моделей по счетам (5 базовых + stacker).

---

## Стек

### Frontend
- **Next.js 16** (App Router) + **React 19** — заметь, это уже не тот Next, который ты помнишь: API, файловые конвенции и дефолты кэширования отличаются. Перед правкой — `node_modules/next/dist/docs/` и `AGENTS.md`.
- **TypeScript 5** strict.
- **Tailwind CSS v4** + `tw-animate-css`.
- **Zustand 5** — клиентское состояние, 6 независимых сторов.
- **Motion** (наследник Framer Motion) — анимации.
- **Recharts** — графики прогнозов и бэктеста.
- **d3-geo** + **topojson-client** + **world-atlas** — глобус и арки переводов на canvas.
- **lucide-react** (иконки), **sonner** (toasts), **cmdk** (command palette), **geist** (шрифты).

### AI
- **AI SDK v6** (`ai` + `@ai-sdk/openai`) — обращение к `gpt-4o-mini`. На Vercel идёт через **AI Gateway** (если есть `AI_GATEWAY_API_KEY`), иначе напрямую по `OPENAI_API_KEY`.

### ML (офлайн)
- Python 3.10–3.13, управляется через `uv` (`ml/pyproject.toml`, `ml/uv.lock`).
- **Prophet** (Bayesian TS), **LightGBM** (квантильный градиентный бустинг с 35 фичами), **ARIMA** (statsmodels), **ETS** (Holt-Winters), **Chronos** (zero-shot foundation transformer от Amazon Science).
- **Ridge stacker** (sklearn) — мета-модель, которая комбинирует все 5 базовых.
- **Conformal calibration** — корректирует P10/P90 интервалы под целевое покрытие.

### Deploy
- **Vercel**, дефолтные настройки. `ml/`, `.env*`, `*.pdf` исключены через `.vercelignore` — в деплой едет только сгенерированный JSON.
- Менеджер пакетов — **pnpm** (`pnpm-workspace.yaml`, `pnpm-lock.yaml`).

---

## Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│  ml/  (offline, локально / в CI)                                  │
│                                                                    │
│  generate_history → train_ensemble → export_for_frontend           │
│                                    → backtest                      │
│                                    → calibrate                     │
│                                                                    │
│  Output → public/data/*.json   (коммитится в репо)                 │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼  (статический импорт `from "@/public/data/*.json"`)
┌──────────────────────────────────────────────────────────────────┐
│  Next.js (Vercel)                                                  │
│                                                                    │
│  app/         — App Router маршруты                                │
│  components/  — UI (landing, dashboard, sight глобус, globe FX)    │
│  lib/data     — типизированные загрузчики JSON                     │
│  lib/store    — Zustand-сторы                                      │
│  lib/utils    — форматтеры, scoring, compass, insight context      │
│  lib/globe    — проекционная математика для overlay-эффектов       │
│                                                                    │
│  POST /api/insights  → OpenAI (gpt-4o-mini) через AI SDK           │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
                      Браузер (десктоп)
```

**Ключевая идея**: runtime Python не вызывается никогда. ML отрабатывает офлайн, фронт читает 4 статических JSON-файла.

---

## Бэкенд

Полноценного бэкенда нет — только один stateless endpoint.

### `POST /api/insights` (`app/api/insights/route.ts`)

Принимает:
```ts
{ accountId: string, dayOffset: number (-60..60), context?: string (<=400) }
```

Что делает:
1. **Rate limit** — 20 req/min на IP (в памяти процесса, по `x-forwarded-for`).
2. **Валидация** через Zod.
3. Берёт метаданные счёта из `accounts.json` и окно из `forecasts.json` (±7 дней вокруг `dayOffset`).
4. Собирает промпт: «Account, currency, minBalance, recent history + forecast (с P10/P90), additional context» и системный промпт «Sight, тон спокойный, 2-3 предложения, конкретные числа».
5. Зовёт `gpt-4o-mini` через AI SDK (`generateText`, `temperature: 0.4`, `maxOutputTokens: 250`).
6. Возвращает `{ insight, tokensUsed, model, generatedAt }`.

Базы данных, авторизации и сессий нет. Все данные счетов и прогнозов — статические JSON в `public/data/`.

---

## Данные

Контракт между ML и фронтом — четыре JSON-файла в `public/data/`.

### `accounts.json` (committed, ручной)
Метаданные 11 счетов: `id`, `name`, `bank`, `currency`, `country`, `location` (lat/lon), `minBalance`, `type` (`operational` / `settlement` / `reserve`).

Пример:
```json
{
  "id": "usd-nyc",
  "name": "NovaPay USD · NYC",
  "bank": "JPMorgan",
  "currency": "USD",
  "country": "US",
  "location": [40.71, -74.0],
  "minBalance": 800000,
  "type": "operational"
}
```

### `forecasts.json` (генерируется ML)
90 дней истории + 14 дней прогноза на каждый счёт. По каждой точке: `date`, `balance` (предсказание ансамбля), `p10` / `p90` (калиброванный интервал), `isHistorical`.

Шапка: `generated_at`, `model_version` (`sight-v3-ensemble`), список `ensemble_members`, `history_days`, `forecast_days` и `model_per_account` — какая модель в итоге выбрана на каждый счёт (по умолчанию везде `stacker`).

### `backtest_results.json` (генерируется ML)
Walk-forward бэктест:
- `horizons` — MAPE Sight против бейзлайнов (naive, moving avg, seasonal naive) на горизонтах 1/3/7/14 дней.
- `per_account` — MAPE и coverage P10/P90 по каждому счёту.
- `deficit_detection` — precision / recall / F1 по обнаружению будущих дефицитов.
- `actual_vs_predicted_h7` — пары факт/прогноз для графиков в Lab.
- `ensemble_holdout_mape` — сравнение моделей на holdout.

### `selection.json` (генерируется ML)
Выбор лучшей модели и MAPE всех 6 моделей (5 базовых + stacker) на каждый счёт. Используется в Sight Lab для UI и в `lib/data/ensemble.ts` для расчёта обратных-MAPE весов.

---

## ML-пайплайн

### Скрипты (`ml/scripts/`)
- **`accounts_config.py`** — метаданные счетов + поведенческие профили (траектории, недельные амплитуды, шум). USD-NYC настроен на дрейф вниз.
- **`generate_history.py`** — синтезирует 180 дней транзакций NovaPay (детерминизм по `--seed`).
- **`features.py`** — 35 инженерных фич для LightGBM: лаги, скользящие средние, недельные/месячные сезонности, кросс-счётные сигналы.
- **`train_models.py`** — фитит Prophet и LightGBM на каждый счёт.
- **`extra_models.py`** — ARIMA, ETS, Chronos (pipeline шарится между счетами).
- **`train_ensemble.py`** — обучает Ridge stacker на out-of-fold предсказаниях (30-дневный holdout, 7-дневный eval horizon), выбирает лучшую модель per account.
- **`ensemble_inference.py`** — инференс ансамбля для прогноза.
- **`calibrate.py`** — конформная калибровка P10/P90.
- **`export_for_frontend.py`** — пакует всё в `public/data/forecasts.json`.
- **`backtest.py`** — walk-forward бэктест последних 30 дней против бейзлайнов.
- **`run_all.py`** — оркестратор: `generate → train_ensemble → export → backtest → calibrate`. Принимает `--skip-*` для итераций.

### Запуск
```bash
cd ml
uv sync                        # или: python -m venv .venv && pip install -e .
python scripts/run_all.py      # 2–5 мин на ноуте
```

Промежуточные `ml/data/*.parquet` и `ml/models/*.pkl` гитигнорятся; в репо коммитятся только итоговые JSON.

Подробности — в [`ml/README.md`](ml/README.md).

---

## Структура

```
app/
  page.tsx              лендинг (собирается из components/landing/*)
  dashboard/
    layout.tsx          сайдбар + Toaster
    page.tsx            <DashboardLayout />
    lab/                Sight Lab (метрики ML)
    crisis/             плейсхолдер
  api/insights/         AI-инсайты (AI SDK + OpenAI)
components/
  landing/              hero, секции, dock-навигация, футер
  dashboard/            карточки, графики, алерты, command palette, panels
  sight/                основной глобус (sight-globe.tsx)
  globe/                overlay-эффекты для глобуса
    money-flow-overlay.tsx   живые денежные потоки (Bezier-частицы)
    globe-hover-card.tsx     карточка hover на маркере
  sidebar/  ui/         общие примитивы
lib/
  data/                 типизированные загрузчики счетов / прогнозов / алертов / сценариев
  store/                Zustand-сторы (6 шт.)
  utils/                форматтеры, scoring, compass, insight context
  globe/                проекционная математика + transaction-flows
public/data/            accounts.json, forecasts.json, backtest_results.json, selection.json
ml/                     Python-пайплайн (см. ml/README.md)
types/                  общие TS-типы
```

### Stores (`lib/store/`)
6 независимых Zustand-сторов:
- **`accounts-store.ts`** — счета, переводы, `executeTransfer`, `addAndExecuteTransfer`, `dismissAlert`, `reset`.
- **`time-store.ts`** — `currentOffset` слайдера времени.
- **`crisis-store.ts`** — активные кризисные сценарии.
- **`demo-store.ts`** — флаги демо-режима.
- **`insights-store.ts`** — кэш AI-инсайтов по ключу `accountId+offset+context`.
- **`ui-store.ts`** — `commandPaletteOpen`, `detailPanelOpen`, `selectedAccountId`, `hoveredAccountId`.

### Data layer (`lib/data/`)
- **`accounts.ts`** — мапит `accounts.json` → `Account[]`, считает текущий статус.
- **`forecasts.ts`** — индекс по дате, `getForecastPointRaw(id, offset)`.
- **`alerts.ts`** — динамический генератор алертов.
- **`ensemble.ts`** — мета-модели + обратные-MAPE веса для UI Sight Lab.
- **`crisis-scenarios.ts`** — справочник сценариев с функциями-дельтами.
- **`transaction-flows.ts`** — `TYPICAL_FLOWS` (веса, каналы, диапазоны сумм) для живых потоков на глобусе.

### Utils (`lib/utils/`)
- **`forecast.ts`** — основное API: `getEffectiveBalanceAt`, `getEffectiveStatusAt`, `getDateForOffset`.
- **`scoring.ts`** — Liquidity Score.
- **`sight-compass.ts`** — алгоритм перебалансировки.
- **`insight-context.ts`** — собирает контекст для AI-инсайта.
- **`format.ts`** — мульти-валютный `formatCompact` ($1.2M / €450K / S$8.4K).

### Globe internals (`lib/globe/`)
- **`projection.ts`** — `buildProjector`, `isVisible`, Bezier-математика для overlay-эффектов.

---

## Data flow на примере

Пользователь двигает Time Machine на +5 дней:

1. `TimeMachine` → `useTimeStore.setOffset(5)`.
2. `DashboardLayout` через `useMemo` пересобирает `markers` и `arcs`:
   - `markers` мапит счета через `getEffectiveBalanceAt(account, 5, account.balance)`, который читает `forecasts.json[id]` для day=+5 и накатывает crisis-дельты из `useCrisisStore`.
3. `SightGlobe` ререндерится: маркеры меняют цвет, бейдж `Forecast +5d` появляется, живые потоки фейдят до 60% opacity.
4. `AccountCard` — каждая карточка слева тоже зовёт `getEffectiveBalanceAt` и анимирует число.
5. `AlertsPanel` через `useAlertsAt(5)` пересчитывает алерты.
6. `CompassBanner` запускает `computeCompassTransfers(accounts, 5)`.
7. Если открыта `AccountDetailPanel` и пользователь жмёт «Объясни» → `POST /api/insights` с `dayOffset: 5` → OpenAI отвечает текстом → результат кешируется в `useInsightsStore`.

При исполнении рекомендованного перевода:

1. `useAccountsStore.executeTransfer(transfer)` мутирует балансы (recipient +=, donor -=).
2. Глобус ловит синий sonar-пульс на получателе + помечает арку как `recommended` на 2 секунды.
3. `useInsightsStore.clear(accountId)` инвалидирует кэш — следующий запрос инсайта учтёт уже исполненный перевод.

---

## Запуск

Нужно: **Node 20+** и **pnpm**.

```bash
pnpm install
cp .env.example .env        # положить OPENAI_API_KEY (или оставить пусто — инсайты вернут 503)
pnpm dev                    # http://localhost:3000
```

### Переменные окружения

- `OPENAI_API_KEY` — нужен для `/api/insights`. Получить: <https://platform.openai.com/api-keys>.
- `AI_GATEWAY_API_KEY` — выставляется автоматически при деплое на Vercel, позволяет ходить через Vercel AI Gateway вместо ключа провайдера.

### Скрипты

```bash
pnpm dev      # next dev (Turbopack)
pnpm build    # next build
pnpm start    # next start (production server)
pnpm lint     # eslint
```

Перегенерация прогнозов (опционально, JSON уже в репо):

```bash
cd ml && python scripts/run_all.py
```

---

## Деплой

Vercel, дефолтные настройки Next.js. `vercel.json` минимальный. В деплой не едут:
- `ml/` — пайплайн (`.vercelignore`).
- `.env*` — секреты.
- `*.pdf`, `newplan.md` — артефакты.

Все environment-переменные ставятся через Vercel UI / `vercel env`:
- `OPENAI_API_KEY` — опционально, если не используется AI Gateway.
- `AI_GATEWAY_API_KEY` — автоматически проставляется на Vercel.

---

## Важные оговорки

- **Next.js 16 + React 19** — это не тот Next, который у тебя в обучающей выборке. Перед правкой смотри `node_modules/next/dist/docs/` и `AGENTS.md`. Дефолты кэширования, серверные компоненты, файловые конвенции — всё может отличаться.
- **Без бэкенда и БД**. Всё, что выглядит как «реалтайм», — клиентский Zustand поверх статических JSON. Sight нельзя задеплоить как полноценный SaaS без переделки слоя данных.
- **Десктопный продукт**. На мобилках показывается `MobileFallback`.
- **Все данные NovaPay — синтетические**. Сюжет «USD-NYC в беде» сшит руками в `accounts_config.py` через траектории и потом подхвачен ML — это фича демо, а не настоящий риск.
- **Живые потоки на глобусе декоративны**: они отражают реалистичные паттерны (`TYPICAL_FLOWS` с весами), но не меняют балансов и не учитываются в прогнозе. Реальные переводы — только через `executeTransfer` / Sight Compass.
- **План глобуса** (`sightglobe.md`) — расширенный roadmap с 10 enhancement-ами. Реализованы пункты 1, 2, 4, 5, 10 (живые потоки, hover-карточки, авто-фокус камеры, time-aware визуалы, sonar-пульсы). Connection Web, Globe Mood, фильтры по валютам, тулбар — в roadmap.

---

## Связанные документы

- [`PROJECT.md`](PROJECT.md) — расширенное описание архитектуры и data flow.
- [`AGENTS.md`](AGENTS.md) — инструкции для AI-агентов (Next.js 16 особенности).
- [`sightglobe.md`](sightglobe.md) — детальный план улучшений глобуса.
- [`ml/README.md`](ml/README.md) — внутренности ML-пайплайна.
