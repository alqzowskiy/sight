# Sight — полное описание проекта

## 1. Что это

**Sight** — это веб-продукт для **управления ликвидностью финтех-компании**. Конкретно — дашборд казначейства вымышленной платёжной компании **NovaPay** с одиннадцатью банковскими счетами в пяти валютах (EUR, USD, GBP, SGD, CHF) по миру.

Проект делает три вещи:

1. **Видит сейчас** — показывает мультивалютные позиции и потоки между банками на интерактивном глобусе в реальном времени.
2. **Видит наперёд** — прогнозирует дневной баланс каждого счёта на 14 дней вперёд ансамблем ML-моделей и подсвечивает счета, которые упадут ниже регуляторного минимума.
3. **Подсказывает действие** — поверх прогноза выдаёт алерты с уже рассчитанным рекомендованным переводом (откуда → куда, сумма, канал SWIFT/SEPA) и AI-инсайт текстом через OpenAI.

Это **демо-продукт / хакатон-кейс**: все данные о NovaPay синтетические, фронтенд — Next.js 16 + React 19, прогнозы готовятся офлайн Python-пайплайном и кладутся в репо как статический JSON. Полноценного бэкенда и базы нет.

---

## 2. Сценарий и сторителлинг

Под капотом зашит один центральный сюжет: счёт **`usd-nyc` (NovaPay USD · NYC, JPMorgan)** сконфигурирован так, что за 180 дней истории дрейфует ниже своего минимума `$800K`. ML это видит, проецирует слабость ещё на 14 дней вперёд и Sight кричит «NYC в беде» через алерты, статусы (`critical`) и AI-инсайт.

Поверх этого есть кризисные сценарии (`SWIFT Outage 48h`, `Black Friday Surge` и др. — `lib/data/crisis-scenarios.ts`), которые применяются как дельты к прогнозу и позволяют стресс-тестить казну.

---

## Doctrine and references

Sight спроектирован против конкретных, задокументированных провалов индустрии. Эта секция фиксирует источники и связь «индустриальный факт → фича Sight», чтобы будущие изменения не размывали продуктовый замысел.

### Размер и боли рынка

| Источник | Тезис | Что это значит для Sight |
|---|---|---|
| **McKinsey Global Payments Report** (annual) | Global B2B payment flows > $150T/год | TAM — это объём, который казначеи реально оркестрируют. Sight адресует mid-market срез ($150T × small % = огромный рынок) |
| **Capgemini World Payments Report** (annual) | Рост B2B real-time payments на двузначные проценты YoY | Скорость движения денег растёт быстрее, чем способность Excel-процессов её отслеживать |
| **Verified Market Research / Grand View** (2025) | TMS market $5-6B в 2024, CAGR ~10% до 2030 | Софт-сегмент растёт, основной драйвер — переход от Excel к specialized treasury software в SMB/mid-market |
| **PwC Global Treasury Benchmarking Survey** | Forecast accuracy и manual processes — top-2 pain point казначеев | Sight закрывает оба: ML-ансамбль с conformal интервалами + автоматизация перебалансировки |
| **Deloitte Global Treasury Survey** | Компании держат 10-25% excess working capital под settlement uncertainty | Liquidity Gradient solver минимизирует idle capital через жадно-итеративный flow |

### Incident-кейсы — почему именно эти фичи

Каждый ключевой компонент Sight можно проследить к историческому провалу:

#### Silicon Valley Bank — март 2023
- $200B+ депозитов, овернайт-неликвидность. Многие финтехи и стартапы держали 80%+ кэша в одном банке.
- **Связь с Sight:** `ConcentrationCard` (HHI по контрагентам) — отслеживает долю портфеля в одном банке. Шкала US DOJ: HHI > 2500 = высокая концентрация = красный флаг. См. `lib/utils/concentration.ts`.

#### Credit Suisse — март 2023
- $1.6T балансовая, экстренный UBS takeover. Counterparty risk материализовался для контрагентов CS по всему миру.
- **Связь с Sight:** dimension `bank` в HHI, плюс roadmap-фича «counterparty graph» для отслеживания вторичных зависимостей.

#### Synapse bankruptcy — апрель 2024
- Banking-as-a-service ledger discrepancies, $85M+ клиентских средств в limbo. Корневая причина — рассинхрон ledger и реальных балансов на корреспондентских счетах.
- **Связь с Sight:** версионируемый JSON-контракт между ML-пайплайном и UI (`public/data/*.json`), audit log переводов (`useAccountsStore.transfers`), conformal интервалы P10/P90 как explicit статистическая граница (а не «прогноз = последнее значение»).

#### JPMorgan London Whale — 2012-2013
- $6.2B trading loss. Расследование вскрыло copy-paste errors в Excel при расчёте VaR — модель риска делилась на сумму вместо среднего, и эта ошибка прошла без ревью.
- **Связь с Sight:** Liquidity Gradient solver (`lib/optimizer/gradient.ts`) — детерминированный, типизированный код вместо Excel-формул. Pressure × supply считается через `min(balance_d − minBalance)`, всё покрывается тестами. Excel как замена — не вариант.

### Что Sight НЕ делает (и почему)

Чтобы понимать границы продукта, важно зафиксировать что Sight не пытается делать:

- **Не процессит платежи.** Sight рекомендует переводы, человек подтверждает через `executeTransfer`. Это снимает PCI DSS, AML и большинство compliance вопросов с продукта.
- **Не подключается к банкам напрямую в v1.** В демо данные синтетические; в прод-версии — через адаптеры (Plaid, Halyk Open Banking, Kaspi B2B, GoCardless). Это снимает регулятивный риск AISP/PISP лицензий с раннего MVP.
- **Не делает FX-хеджирование.** Есть отдельный счёт `fx-hedging` как индикатор, но full FX risk management — это отдельный продукт (Kantox, Currencycloud territory).
- **Не replaces казначея.** AI Co-pilot, не Autopilot. Все рекомендации требуют human-in-the-loop. Это закрывает 80% compliance возражений до того, как их зададут.

### Compliance posture (companion to §11)

- **GDPR-compatible с Day 1** — Sight процессит treasury metadata (балансы, prediction), не персональные данные клиентов банков. Pseudonymization где нужно.
- **PCI DSS не требуется** — мы не процессим карты.
- **SOC 2 Type II — Y2 цель** для US/EU enterprise клиентов.
- **ISO 27001 — Y3 цель** для tier-1 банков.
- **PSD2 Open Banking** — только при экспансии в EU и подключении прямых банковских API (AISP license).

---

## CustDev insights

Композитные персоны, синтезированные из CustDev-разговоров и вторичного research. Каждая пара pain → feature фиксирована в коде — если CustDev меняется, фичи переезжают вместе с ним. Используется для приоритезации roadmap и формулировок в питче.

### Persona 1 — CFO of mid-market FinTech (KZT/USD corridor)

| Aspect | Detail |
|---|---|
| Role | CFO |
| Company shape | Mid-market FinTech, ~$50-150M annual processing volume |
| Corridor | KZT/USD, 2 банка-корреспондента в US (JPMorgan, BNY Mellon) |
| Tool stack today | Excel + 8 банковских порталов + email-уведомления |
| Top pain | Ручная сверка nostro-балансов и SWIFT-подтверждений (2 дня/неделю) |
| Reactive moment | Узнают о пробое minBalance из email банка → 6-8 часов scramble |
| **Mapped Sight feature** | Live globe (visibility), `useAlertsAt` (proactive alerts на 7 дней вперёд), AI insight panel (объяснение в plain English) |

Quote: «Сверка nostro-балансов в Excel — 2 дня/неделю. Когда USD-NYC падает, мы узнаём из email банка.»

### Persona 2 — Treasurer of EU EMI (SEPA & SWIFT corridor)

| Aspect | Detail |
|---|---|
| Role | Treasurer / Head of Treasury |
| Company shape | EU-licensed EMI, ~$200M float, mid-market PSP-tier клиенты |
| Corridor | SEPA Instant + SWIFT для не-EUR, multi-currency reserves |
| Tool stack today | TreasuryView или ION Treasury (entry-level), плюс Excel-overlays |
| Top pain | 5-7% оборотного капитала идёт в буфер под SEPA holiday + SWIFT cut-off |
| Industry benchmark | Deloitte Treasury Survey: 10-25% — нормальный диапазон |
| **Mapped Sight feature** | `lib/optimizer/gradient.ts` — Liquidity Gradient solver минимизирует буфер per channel SLA. Channel selection в `lib/optimizer/channels.ts` (EUR↔EUR → SEPA $0.50, иначе SWIFT $25) |

Quote: «5-7% капитала в буфере. На $200M это $10-14M idle cash.»

### Persona 3 — Compliance Officer of regulated PSP

| Aspect | Detail |
|---|---|
| Role | Head of Compliance / MLRO |
| Company shape | Licensed PSP, объём не главное, регулятор — главное |
| Pain | AI demos с autonomous money movement = automatic compliance fail |
| Hard requirement | Human-in-the-loop на любое движение средств между корр-счетами |
| Audit expectation | GDPR Day 1, SOC 2 Y2, audit log на каждый перевод с подписью |
| **Mapped Sight feature** | `executeTransfer` в `accounts-store.ts` требует явного вызова из UI (`Execute` button в AlertCard, OptimizerPanel, NewTransferModal). Audit log = массив transfers в store. Insight cache инвалидируется при перевода. **AI Co-pilot, не Autopilot** — это не маркетинговый слоган, это design constraint. |

Quote: «AI demos с autonomous money movement не пройдут наш audit gate.»

### Как это используется в продукте

- **Приоритезация:** любая новая фича должна снимать pain хотя бы одной из трёх персон, иначе она не попадает в roadmap.
- **Питч:** в pitch deck отдельный slide «Voice of the customer» с этими цитатами и mapping.
- **README + landing:** анонимизированные версии этих же quotes в [`README.md`](README.md) и `components/landing/VoicesSection.tsx`.
- **Compliance posture:** Persona 3 диктует, почему мы делаем Co-pilot а не Autopilot.

---

## Commercial roadmap

### Y1 — Validation через pilots ($0 → $300K ARR)

| Месяц | Activity | Deliverable |
|---|---|---|
| M1-M3 | Founder-led outbound в KZ FinTech | 3-5 active pilots |
| M4-M6 | Pilot execution, case study collection | 2-3 paid конверсии |
| M7-M9 | EU EMI pilot (1 customer) | SEPA corridor validation |
| M10-M12 | Pricing experiments, expansion в Baltic | $300K ARR |

**Ресурсы:** 2-3 founders, без paid acquisition. Cost: salaries + Vercel + AI Gateway ≈ $40-60K total Y1.

### Y2 — Self-serve SaaS launch ($300K → $1.5M ARR)

| Квартал | Activity | Deliverable |
|---|---|---|
| Q1 | Public launch, pricing page, self-serve onboarding | Signup funnel live |
| Q2 | SOC 2 Type II audit | Certification |
| Q3 | Challenger-bank partnership (referral or white-label) | Distribution channel |
| Q4 | Content engine, product-led growth | 150 paying, $1.5M ARR |

**Ресурсы:** +1 senior eng (data pipeline), +1 customer success, +1 designer. Burn ≈ $50K/мес.

### Y3 — Enterprise + Expansion ($1.5M → $5M ARR)

| Квартал | Activity | Deliverable |
|---|---|---|
| Q1 | Enterprise tier launch ($5-15K/мес), ISO 27001 | First enterprise deal |
| Q2 | PSD2 AISP integration для EU | EU enterprise expansion |
| Q3 | ОАЭ (DIFC) launch | 1-2 MENA pilots |
| Q4 | SEA (Singapore MAS partnership) | 1-2 APAC pilots |

**Ресурсы:** +1 enterprise sales, +1 customer success, +1 compliance officer. Burn ≈ $80-100K/мес.

### Что НЕ делаем

Чтобы roadmap был выполним, явно фиксируем чего НЕ делаем:

- **Не идём в US с Y1.** Там Kyriba, HighRadius, Trovata. Battle of titans, без локального presence и compliance не выживем.
- **Не строим собственный bank.** Sight — это software-layer поверх существующих банков. Не привлекаем banking license.
- **Не делаем FX-хеджирование как продукт.** Indicator есть в дашборде (`fx-hedging` account), но full FX risk management — отдельный продукт (Kantox, Currencycloud territory).
- **Не интегрируемся с tier-1 банками напрямую с Y1.** Через адаптеры партнёров (Plaid, Halyk Open Banking, GoCardless) — это снимает регулятивную нагрузку с раннего MVP.
- **Не делаем on-prem deployment.** Cloud-only, SaaS-only. On-prem убивает SOC 2 и замедляет release cycle.

---

## 3. Стек

**Frontend**
- **Next.js 16** (App Router) + **React 19** — заметь, это уже не тот Next, который ты помнишь: API, конвенции и дефолты кэширования отличаются (см. `AGENTS.md`).
- **TypeScript 5** strict.
- **Tailwind CSS v4** + `tw-animate-css`.
- **Zustand 5** — клиентское состояние, 6 отдельных сторов.
- **Motion** (наследник Framer Motion) — анимации.
- **Recharts** — графики прогнозов и бэктеста.
- **Cobe** + `d3-geo` + `topojson-client` + `world-atlas` — 3D-глобус с маркерами и арками переводов.
- **lucide-react**, **sonner** (toasts), **cmdk** (command palette), **geist** (шрифты).

**AI**
- **AI SDK v6** (`ai` + `@ai-sdk/openai`) — обращение к `gpt-4o-mini`. На Vercel идёт через **AI Gateway** (если есть `AI_GATEWAY_API_KEY`), иначе напрямую по `OPENAI_API_KEY`.

**ML (офлайн)**
- Python 3.10–3.13, управляется через `uv` (`ml/pyproject.toml`, `ml/uv.lock`).
- **Prophet** (Bayesian TS), **LightGBM** (квантильный градиентный бустинг с 35 фичами), **ARIMA** (statsmodels), **ETS** (Holt-Winters), **Chronos** (zero-shot foundation transformer от Amazon Science).
- **Ridge stacker** (sklearn) — мета-модель, которая комбинирует все 5 базовых.
- **Conformal calibration** — корректирует P10/P90 интервалы под целевое покрытие.

**Deploy**
- Vercel. `ml/`, `.env*`, `*.pdf` исключены через `.vercelignore` — в деплой едет только сгенерированный JSON.
- Менеджер пакетов — **pnpm** (есть `pnpm-workspace.yaml` и `pnpm-lock.yaml`).

---

## 4. Архитектура (high-level)

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
                          ▼  (статический импорт через `import ... from "@/public/data/*.json"`)
┌──────────────────────────────────────────────────────────────────┐
│  Next.js (Vercel)                                                  │
│                                                                    │
│  app/         — App Router маршруты                                │
│  components/  — UI (landing, dashboard, sight глобус)              │
│  lib/data     — типизированные загрузчики JSON                     │
│  lib/store    — Zustand-сторы                                      │
│  lib/utils    — форматтеры, scoring, compass, insight context      │
│                                                                    │
│  POST /api/insights  → OpenAI (gpt-4o-mini) через AI SDK           │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼
                      Браузер (десктоп)
```

Ключевая идея: **runtime Python не вызывается никогда**. ML отрабатывает офлайн, фронтенд просто читает три статических JSON-файла (`accounts.json`, `forecasts.json`, `backtest_results.json`, `selection.json`).

---

## 5. Данные

Все данные в `public/data/` — это контракт между ML и фронтом.

### `accounts.json` (committed, ручной)
Метаданные 11 счетов: id, имя, банк, валюта, страна, координаты (lat/lon), минимальный баланс, тип (`operational` / `settlement` / `reserve`).

Пример (`usd-nyc`):
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
- `deficit_detection` — precision/recall/F1 по обнаружению будущих дефицитов.
- `actual_vs_predicted_h7` — пары факт/прогноз для графиков в Lab.
- `ensemble_holdout_mape` — сравнение моделей на holdout.

### `selection.json` (генерируется ML)
Выбор лучшей модели и MAPE всех 6 моделей (5 базовых + stacker) на каждый счёт. Используется в Sight Lab для UI и в `lib/data/ensemble.ts` для расчёта обратных-MAPE весов.

---

## 6. ML-пайплайн (`ml/`)

### Скрипты (`ml/scripts/`)
- **`accounts_config.py`** — метаданные счетов + поведенческие профили (траектории, недельные амплитуды, шум). USD-NYC настроен на дрейф вниз.
- **`generate_history.py`** — синтезирует 180 дней транзакций NovaPay (зерно по умолчанию `--seed 42`, детерминизм).
- **`train_models.py`** — фитит Prophet и LightGBM на каждый счёт.
- **`extra_models.py`** — ARIMA, ETS, Chronos (Chronos pipeline шарится между счетами).
- **`features.py`** — 35 инженерных фич для LightGBM: лаги, скользящие средние, недельные/месячные сезонности, кросс-счётные сигналы.
- **`train_ensemble.py`** — обучает Ridge stacker на out-of-fold предсказаниях (30-дневный holdout, 7-дневный eval horizon), выбирает лучшую модель per account, пишет `models/{id}_stacker.pkl` и `selection.json`.
- **`ensemble_inference.py`** — инференс ансамбля для прогноза.
- **`calibrate.py`** — конформная калибровка P10/P90.
- **`export_for_frontend.py`** — пакует всё в `public/data/forecasts.json` (90 дней истории + 14 дней прогноза, с SHAP-фичами для LightGBM).
- **`backtest.py`** — walk-forward бэктест последних 30 дней против бейзлайнов, считает deficit detection F1, пишет `backtest_results.json`.
- **`run_all.py`** — оркестратор: `generate → train_ensemble → export → backtest → calibrate`. Принимает `--skip-*` флаги для итераций.

### Запуск
```bash
cd ml
uv sync                        # или: python -m venv .venv && pip install -e .
python scripts/run_all.py      # 2–5 мин на ноуте
```

Промежуточные `ml/data/*.parquet` и `ml/models/*.pkl` гитигнорятся; в репо коммитятся только итоговые JSON в `public/data/`.

---

## 7. Frontend — структура

### Маршруты (`app/`)
- **`/`** (`app/page.tsx`) — лендинг. Собирается из секций в `components/landing/`: Hero, Essence, HowItWorks, Models, Metrics, AiSection, Stack, Footer; навигация через `DockNav`.
- **`/dashboard`** (`app/dashboard/page.tsx`) — главный продукт, `<DashboardLayout />`. Под собственным `app/dashboard/layout.tsx` с сайдбаром и Toaster.
- **`/dashboard/lab`** — Sight Lab: бэктест, MAPE по горизонтам, сравнение моделей, actual vs predicted графики (`components/dashboard/lab/lab-view.tsx`).
- **`/dashboard/crisis`** — заглушка-плейсхолдер; реальный Crisis Mode открывается прямо с дашборда кнопкой `Siren` в шапке (компонент `CrisisPanel`).

### Дашборд (`components/dashboard/dashboard-layout.tsx`)
Сетка `[56px header / 1fr / 96px footer]`. В центральной строке трёхколоночный grid:

```
┌──── header: NovaPay · Dashboard · Liquidity Score · ⌘K · New Transfer · Crisis · Demo · Reset ────┐
├──── CompassBanner (Sight Compass — авто-предложение перебалансировок) ───────────────────────────┤
│  Accounts list  │   Sight Globe (Cobe)   │   Alerts Panel                                         │
│  (AccountCard)  │  + markers + arcs       │   (AlertCard)                                          │
├──── TimeMachine (slider от -60 до +60 дней) ─────────────────────────────────────────────────────┤
```

Поверх — модалки: `AccountDetailPanel`, `CrisisPanel`, `CommandPalette`, `ShortcutsOverlay`, `NewTransferModal`, `MobileFallback` (на мобиле показывается фолбэк — продукт десктопный).

### Ключевые компоненты
- **`SightGlobe`** (`components/sight/sight-globe.tsx`) — 3D-глобус на Cobe с маркерами счетов (`healthy`/`warning`/`critical`) и анимированными арками переводов.
- **`TimeMachine`** — слайдер времени; общий сторе `useTimeStore`. Все балансы и статусы пересчитываются «на момент `offset`» через `getEffectiveBalanceAt` / `getEffectiveStatusAt` в `lib/utils/forecast.ts`, поверх накатываются crisis-дельты.
- **`AlertsPanel` + `AlertCard`** — алерты строятся ВЫЧИСЛЯЕМО, не из JSON: `lib/data/alerts.ts:useAlertsAt(offset)` пробегает прогноз на 7 дней вперёд, ищет счета, у которых баланс < 1.2× minBalance, и подбирает донора (тот же currency предпочтительнее, иначе SWIFT) — это рекомендованный перевод.
- **`CompassBanner`** + `lib/utils/sight-compass.ts` — Sight Compass: ранжирует `critical` счета по дефициту, ищет доноров с buffer > 1.15× minBalance + $200K и предлагает пакет переводов.
- **`CrisisPanel`** — выбор сценариев (SWIFT outage, Black Friday и т.д.) из `lib/data/crisis-scenarios.ts`. Каждый сценарий — это `delta(ctx) → number`, применяется к балансу в `getEffectiveBalanceAt`.
- **`CommandPalette`** (cmdk, ⌘K) — быстрый поиск по счетам и действиям.
- **`AccountDetailPanel`** — выезжающая панель с графиком прогноза (`AccountForecastChart`), AI-инсайтом (`AiInsightPanel`), SHAP-фичами и кнопкой исполнить рекомендованный перевод.
- **`LiquidityScore`** — общий health-score в шапке, считается в `lib/utils/scoring.ts`.
- **`DemoMode`** — авто-проигрывание сценария «деградация → алерт → исполнение».
- **`NumberTicker`**, **`motion-primitives`** — реюзабельная анимация чисел.
- **`SplashScreen`** + `MobileFallback` — onboarding и десктоп-гейт.

### Stores (`lib/store/`)
6 независимых Zustand-сторов:
- **`accounts-store.ts`** — счета и переводы. Имеет `executeTransfer`, `addAndExecuteTransfer` (ad-hoc), `dismissAlert`, `reset`. Исполнение перевода мутирует балансы и инвалидирует кэш AI-инсайтов через `useInsightsStore`.
- **`time-store.ts`** — `currentOffset` слайдера времени, `reset()`.
- **`crisis-store.ts`** — активные кризисные сценарии и состояние модалки.
- **`demo-store.ts`** — флаги демо-режима.
- **`insights-store.ts`** — кэш AI-инсайтов по ключу `accountId+offset+context`, отслеживание `inflight` запросов.
- **`ui-store.ts`** — `commandPaletteOpen`, `detailPanelOpen`, `selectedAccountId`, `hoveredAccountId`, `pendingInsightAccountId`.

### Data layer (`lib/data/`)
Тонкие типизированные обёртки вокруг статических JSON:
- **`accounts.ts`** — мапит `accounts.json` → `Account[]`, считает текущий статус.
- **`forecasts.ts`** — индекс по дате, `getForecastPointRaw(id, offset)`.
- **`alerts.ts`** — динамический генератор алертов с подбором доноров.
- **`ensemble.ts`** — мета-модели + обратные-MAPE веса для UI Sight Lab.
- **`crisis-scenarios.ts`** — справочник сценариев с функциями-дельтами.

### Utils (`lib/utils/`)
- **`forecast.ts`** — основное API: `getEffectiveBalanceAt`, `getEffectiveStatusAt`, `getDateForOffset`. Накладывает crisis-дельты и live-mutations поверх ML-прогноза.
- **`scoring.ts`** — Liquidity Score.
- **`sight-compass.ts`** — алгоритм перебалансировки.
- **`insight-context.ts`** — собирает доп.контекст (live balance vs forecast, активные сценарии, последние переводы) для AI-инсайта.
- **`format.ts`** — мульти-валютный `formatCompact` ($1.2M / €450K / S$8.4K).
- **`brand.ts`** — фирменные цвета.

---

## 8. AI-инсайты (`app/api/insights/route.ts`)

Единственный stateless endpoint в проекте.

**`POST /api/insights`**

Принимает:
```ts
{ accountId: string, dayOffset: number (-60..60), context?: string (<=400) }
```

Что делает:
1. Rate limit — 20 req/min на IP (в памяти процесса, по `x-forwarded-for`).
2. Валидация через Zod.
3. Берёт метаданные счёта из `accounts.json` и окно из `forecasts.json` (±7 дней вокруг `dayOffset`).
4. Собирает промпт: «Account, currency, minBalance, recent history + forecast (с P10/P90), additional context» и системный промпт «Sight, тон спокойный, 2-3 предложения, конкретные числа».
5. Зовёт `gpt-4o-mini` через AI SDK (`generateText`, `temperature: 0.4`, `maxOutputTokens: 250`).
6. Возвращает `{ insight, tokensUsed, model, generatedAt }`.

Ключи: `OPENAI_API_KEY` или `AI_GATEWAY_API_KEY` (Vercel AI Gateway автоматически).

Авторизации/сессий нет.

---

## 9. Data flow при взаимодействии пользователя

Пример: пользователь двигает Time Machine на +5 дней.

1. `TimeMachine` → `useTimeStore.setOffset(5)`.
2. `DashboardLayout` через `useMemo` пересобирает `markers` и `arcs`:
   - `markers` мапит счета через `getEffectiveBalanceAt(account, 5, account.balance)`, который читает `forecasts.json[id]` для day=+5 и накатывает crisis-дельты из `useCrisisStore`.
   - Статус (`healthy`/`warning`/`critical`) считается тут же по соотношению к `minBalance`.
3. `SightGlobe` ререндерится: маркеры меняют цвет.
4. `AccountCard` — каждая карточка слева тоже зовёт `getEffectiveBalanceAt` и анимирует число через `NumberTicker`.
5. `AlertsPanel` через `useAlertsAt(5)` пересчитывает алерты: ищет проблемные счета на горизонте +7 от текущего offset.
6. `CompassBanner` запускает `computeCompassTransfers(accounts, 5)` — если есть `critical`, показывает баннер «Compass рекомендует N переводов».
7. Если открыта `AccountDetailPanel` и пользователь жмёт «Объясни» → `POST /api/insights` с `dayOffset: 5` → OpenAI отвечает текстом → результат кешируется в `useInsightsStore`.

При исполнении рекомендованного перевода:
1. `useAccountsStore.executeTransfer(transfer)` мутирует балансы (recipient +=, donor -=).
2. Арка на глобусе помечается `recommended: true` на 2 секунды (`FRESH_ARC_MS`).
3. `useInsightsStore.clear(accountId)` инвалидирует кэш — следующий запрос инсайта учтёт уже исполненный перевод (`buildInsightContext` положит его в `context`).

---

## 10. Запуск локально

Нужно: **Node 20+** и **pnpm**.

```bash
pnpm install
cp .env.example .env        # положить OPENAI_API_KEY (или оставить пусто — инсайты вернут 503)
pnpm dev                    # http://localhost:3000
```

Маршруты:
- `/` — лендинг.
- `/dashboard` — продукт.
- `/dashboard/lab` — метрики моделей.

Скрипты:
```bash
pnpm dev      # next dev
pnpm build    # next build
pnpm start    # next start (production server)
pnpm lint     # eslint
```

Перегенерация прогнозов (опционально, JSON уже в репо):
```bash
cd ml && python scripts/run_all.py
```

---

## 11. Деплой

Vercel, дефолтные настройки Next.js. `vercel.json` минимальный. В деплой не едут:
- `ml/` — пайплайн (есть в `.vercelignore`).
- `.env*` — секреты.
- `*.pdf`, `FinTech.pdf` — артефакты.

Все environment-переменные ставятся через Vercel UI / `vercel env`:
- `OPENAI_API_KEY` — опционально, если не используется AI Gateway.
- `AI_GATEWAY_API_KEY` — автоматически проставляется на Vercel.

---

## 12. Важные оговорки

- **Next.js 16 + React 19** — это не тот Next, который у тебя в обучающей выборке. Перед правкой смотри `node_modules/next/dist/docs/` и `AGENTS.md`. Дефолты кэширования, серверные компоненты, файловые конвенции — всё может отличаться.
- **Без бэкенда и БД**. Всё, что выглядит как «реалтайм», — клиентский Zustand поверх статических JSON. Sight нельзя задеплоить как полноценный SaaS без переделки слоя данных.
- **Десктопный продукт**. На мобилках показывается `MobileFallback`.
- **Все данные NovaPay — синтетические**. Сюжет «USD-NYC в беде» сшит руками в `accounts_config.py` через траектории и потом подхвачен ML — это фича демо, а не настоящий риск.
- **Sight Brain** (см. `sightbrain.md`) — задуманная, но НЕ реализованная фича: визуализация ансамбля как «мозга» с анимированным потоком данных между моделями. План остаётся в репо как roadmap.
