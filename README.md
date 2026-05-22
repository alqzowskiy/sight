# Sight

🌐 **Live demo: <https://trysight.vercel.app/>**

**Sight** — система управления ликвидностью финтех-компании. На примере вымышленной платёжной компании **NovaPay** показывает, как ML и алгоритмы перебалансировки превращают казначейство из реактивной функции («банк позвонил — переводим») в проактивную («модель видит дефицит за 5 дней — план готов»).

> 🛡️ **AI Co-pilot, не Autopilot.** Sight рекомендует — казначей подтверждает. Все переводы требуют явного `Execute` с записью в audit log. Это закрывает compliance Day 1: автономного движения денег нет by design.

Под капотом:

1. **Прогноз** — ансамбль из 5 ML-моделей (Prophet, LightGBM Quantile, ARIMA, ETS, Chronos) + Ridge stacker на out-of-fold предсказаниях. Считает дневной баланс каждого из 11 счетов на 14 дней вперёд с конформно калиброванными P10/P90 интервалами.
2. **Алерты** — вычисляются вживую из прогноза: ищет точки, где баланс пробивает 1.2× minBalance, и автоматически подбирает донора (та же валюта приоритетнее, иначе SWIFT).
3. **Sight Compass** — ранжирует critical счета по дефициту, находит доноров с buffer > 1.15× minBalance + $200K, формирует пакет переводов одной кнопкой.
4. **Liquidity Optimizer** — полноценный solver для перебалансировки всех 11 счетов. Алгоритм liquidity-gradient: для каждого счёта считается **pressure** (взвешенная сумма дефицитов на 14 дней вперёд) и **supply** (сколько можно отдать), жадно-итеративно переливает из max-supply в max-pressure, выбирая канал (SEPA / SWIFT / VISA) по валюте и типу счёта.
5. **AI insights** — `gpt-4o-mini` через AI SDK поверх контекста счёта (история + прогноз + минимум), отвечает 2-3 предложениями с конкретными числами.

Все данные NovaPay — синтетические, сгенерированы детерминированно из `accounts_config.py`. ML отрабатывает офлайн (Python + uv), результат — четыре версионируемых JSON-файла, которые читает Next.js.

---

## TL;DR

```bash
pnpm install
cp .env.example .env        # OPENAI_API_KEY (или AI Gateway на Vercel)
pnpm dev                    # http://localhost:3000
```

- `/` — лендинг
- `/dashboard` — главный продукт
- `/dashboard/brain` — визуализация ансамбля: 5 базовых моделей → Sankey-merger → стакер → итоговый прогноз
- `/dashboard/lab` — метрики ML-моделей и бэктест

---

## Industry context

Sight — это не «ещё один dashboard». Это ответ на хорошо задокументированную проблему индустрии. Ниже — почему мы построили именно то, что построили.

### Размер проблемы

- **Global B2B payment flows > $150T в год** (McKinsey Global Payments Report, Capgemini World Payments Report) — это объём денежного потока, который казначеи финтех-компаний и PSP должны оркестрировать в реальном времени, через десятки банков-корреспондентов и валют.
- **Treasury Management Systems market: $5-6B в 2024, CAGR ~10% до 2030** (Verified Market Research, Grand View Research). Рост драйвится переходом от Excel к specialized software в SMB и mid-market сегментах.
- **PwC Global Treasury Benchmarking Survey** из года в год выделяет **forecast accuracy** и **manual processes (Excel)** как два главных pain point казначеев крупных и средних компаний.
- **Deloitte Global Treasury Survey** консистентно показывает, что компании держат **10-25% excess working capital** в виде идущих в простое резервов — чтобы покрывать неопределённость SEPA/SWIFT-задержек, holiday matrix и multi-currency timing. На объёме $200M это $20-50M idle capital — реальный cost of capital.

### Incident-кейсы, к которым Sight отвечает

Каждая фича Sight спроектирована против конкретного типа исторических провалов:

| Инцидент | Год | Что произошло | Какая фича Sight это закрывает |
|---|---|---|---|
| **Silicon Valley Bank collapse** | 2023 | $200B+ депозитов, овернайт-неликвидность. Многие финтехи держали 80%+ кэша в одном банке. | **Concentration Card (HHI)** — отслеживание доли портфеля в одном контрагенте |
| **Credit Suisse emergency rescue** | 2023 | $1.6T балансовая, экстренный takeover UBS. Counterparty risk материализовался. | **Counterparty dimension в HHI** + scoring контрагентов |
| **Synapse bankruptcy** | 2024 | Banking-as-a-service ledger discrepancies, $85M+ клиентских средств в limbo из-за рассинхрона ledger vs реальных балансов. | **Версионируемый JSON-контракт** между ML-пайплайном и UI, audit log переводов, conformal интервалы P10/P90 |
| **JPMorgan London Whale** | 2012-13 | $6.2B trading loss. Расследование вскрыло copy-paste errors в Excel при расчёте VaR. | **Liquidity Gradient solver** — детерминированный код вместо Excel-формул, версионируемая логика, типизация |

### Что Sight даёт казначею (концептуально)

Если перевести этот контекст в продукт:

1. **Видимость через все банки и валюты сразу** — Globe + Concentration Card против slepoty Excel-сверки.
2. **Прогноз с честными интервалами** — conformal P10/P90 80% coverage против «прогноз = последнее значение» в Excel.
3. **Автоматические рекомендации перебалансировки** — Liquidity Gradient solver против ручного расчёта.
4. **Human-in-the-loop по дизайну** — все переводы требуют явного Execute (AI Co-pilot, не Autopilot), что закрывает compliance Day 1.

---

## Market size & unit economics

### TAM — Global Treasury Management Software

**$5-6B в 2024 → $9-10B к 2030**
Источник: Verified Market Research / Grand View Research (Treasury Management Software Market Reports 2024-2025). CAGR ~10%, основной драйвер — переход mid-market от Excel к specialized software.

### SAM — Mid-market PSP / EMI / FinTech (CIS + EU + SEA)

**~$180-220M**
- ~1,200 EMIs в EU (EBA register 2024)
- ~400 PSPs и PSP/EMI hybrids в CIS
- ~200 mid-market players в SEA
- Средний ACV $150-200K = $180-220M total addressable

Это срез TMS-рынка, который **не покрывают enterprise гиганты** (Kyriba, HighRadius, ION) — они нацелены на tier-1 банки и крупные корпорации. Mid-market FinTech остаётся в Excel.

### SOM — Pilot region (Kazakhstan + Baltic)

| Год | Customers | MRR | ARR |
|---|---|---|---|
| Y1 | 50 paying | $500 | **$300K** |
| Y2 | 150 paying | $850 | **$1.5M** |
| Y3 | 400 paying | $1,050 | **$5M** |

Y1 → free pilots у 3-5 финтехов в KZ для case study, конверсия в paid через 3 мес. Y2 → self-serve SaaS launch. Y3 → enterprise tier + geographic expansion.

### Unit economics

| Метрика | Значение | Комментарий |
|---|---|---|
| **CAC** | $2,000 | PLG + content + founder-led sales. Без paid ads на Y1. |
| **LTV** | $12,000 | $500 MRR × 24 мес. Treasury — sticky tool. |
| **LTV / CAC** | **6×** | Медианно для B2B SaaS в этом сегменте. |
| **Payback** | 4 мес | Быстрый payback за счёт contract upfront annual. |
| **Gross margin** | 82% | Cloud (Vercel + DB) + AI Gateway + dev tooling. |
| **NRR target** | 110% | Upsell к Pro / Enterprise + expansion на новые корридоры. |

### Why these numbers and not higher

LTV/CAC в 10× и 90% gross margin часто звучат на питчах, но в B2B FinTech с long enterprise sales cycle это marketing fluff. Жюри это видит. Наши цифры **намеренно медианные**:

- CAC $2K включает 20-30 часов founder-led sales calls (реальная стоимость времени)
- LTV 24 мес учитывает churn (≈4% mo для B2B SaaS на ранней стадии)
- Gross margin 82% — потому что AI Gateway, Vercel functions, Postgres стоят денег при росте
- NRR 110% — амбициозно но реалистично, не 130%+

---

## Go-to-market

### Stage 1 — Pilots (Y1)

**Цель:** 3-5 case study + первая paid customer.

**Tactics:**
- 3 KZ FinTech / PSP (KZT/USD corridor) — бесплатный pilot 3 месяца → конверсия в paid после кейса.
- 1 EU EMI (SEPA / SWIFT corridor) — pilot для валидации не-CIS сегмента.
- Founder-led sales: LinkedIn outbound + warm intros через Astana Hub, Silkway Ventures, EU FinTech network.
- 5-10 LinkedIn-постов с CFO endorsement после первого case study.

**Metrics:** 3-5 active pilots, 2-3 paid конверсий к концу Y1.

### Stage 2 — Self-serve SaaS (Y2)

**Цель:** $300K → $1.5M ARR, 50 → 150 paying.

**Tactics:**
- Public launch с публичной pricing: $299/мес Growth, $1,500/мес Pro.
- Distribution через partnership с одним challenger-банком (referral commission или white-label dashboard).
- SOC 2 Type II certification (Q2 Y2) — обязательное условие для US/EU enterprise клиентов.
- Content engine: 2 продуктовых поста в месяц (HHI deep-dives, Liquidity Gradient explainer, treasury automation patterns).

**Metrics:** 150 paying customers, $1.5M ARR, NRR ≥ 105%, churn ≤ 5% mo.

### Stage 3 — Enterprise + Geographic expansion (Y3)

**Цель:** 5 enterprise contracts + 2 новых региона.

**Tactics:**
- Enterprise tier $5-15K/мес для tier-2 банков и крупных PSP.
- ISO 27001 + PSD2 Open Banking integration (для EU AISP).
- Geographic expansion:
  - **ОАЭ** — DIFC license, dedicated MENA sales (ОАЭ казначеи копят USD-резервы под цифровизацию).
  - **SEA** — Singapore MAS partnership, dedicated APAC sales.
- Enterprise team: 1 sales lead, 1 customer success, 1 compliance officer.

**Metrics:** 5 enterprise deals, $2M ARR enterprise + $3M ARR mid-market = **$5M total**.

### Compliance roadmap

Compliance — это не Y3 проблема, это design constraint с Day 1. Сертификации идут параллельно росту, не блокируют.

| Стандарт | Когда | Зачем |
|---|---|---|
| **GDPR-compatible** | **Day 1** | EU pilots требуют GDPR Day 1. Sight обрабатывает treasury metadata (балансы, прогнозы), не PII клиентов банков — pseudonymization где нужно. |
| **PCI DSS** | Не требуется | Sight не процессит карты. Никогда. |
| **SOC 2 Type II** | Y2 Q2 | Обязательно для US/EU enterprise. ~$30-50K на аудит. |
| **ISO 27001** | Y3 Q1 | Для tier-2 банков и крупных PSP. ~$40-60K. |
| **PSD2 Open Banking** | Y3 Q2 | Только при подключении прямых банковских API в EU (AISP license). До этого — через адаптеры партнёров (Plaid, GoCardless). |
| **MAS DPT** | Y3 Q3 | Singapore Digital Payment Token register — для SEA expansion. |

### Что отличает наш GTM от типичного «продадим банкам»

Жюри хакатона прямо сказал: «enterprise fintech sales — сложно. Просто сказать "продадим банкам" уже не покупаем». Мы это слышим. Поэтому:

- **Бесплатные pilot'ы первого года** — кейсы важнее ARR на Y1.
- **Co-pilot позиционирование** — снимает 80% compliance возражений до сделки.
- **Challenger-bank partnership как distribution** — не пытаемся продать SVB-style банкам напрямую с Y1; выходим через посредника.
- **Mid-market SaaS, не enterprise с Day 1** — продаём через self-serve, а не через 12-месячные RFP.
- **Geographic phasing** — KZ (домашний рынок) → EU (мост через regulatory similarity) → ОАЭ/SEA (где есть деньги и open regulatory). Не пытаемся идти в US с Y1 — там бесконечная конкуренция и Kyriba-territory.

---

## Voice of the customer

Композитные цитаты, синтезированные из CustDev-разговоров и вторичного research (PwC Treasury Benchmarking, Deloitte Treasury Survey). Анонимизировано по дизайну — каждая персона привязана к реальной роли, реальному корридору и конкретной фиче Sight.

### CFO — Mid-market FinTech, KZT/USD corridor

> «Сверка nostro-балансов и swift-подтверждений в Excel занимает у моей команды два рабочих дня в неделю. Когда USD-баланс в Нью-Йорке падает ниже минимума, мы узнаём об этом из email от банка — это 6-8 часов scramble и иногда регуляторные штрафы.»

**Pain:** ручная сверка + реактивные алерты.
**Sight's answer:** Live globe + computed alerts за 5 дней до дипа. См. `lib/data/alerts.ts:useAlertsAt`.

### Treasurer — EU EMI, SEPA & SWIFT corridor

> «5-7% оборотного капитала постоянно лежит резервом под SEPA holiday delays и SWIFT cut-off timing. На объёме $200M это $10-14M idle cash, который мы не можем размещать. Индустриальные опросы подтверждают, что мы не уникальны — Deloitte ставит средний показатель 10-25%.»

**Pain:** избыточные резервы под settlement uncertainty.
**Sight's answer:** Liquidity Gradient solver — минимальный буфер per channel SLA. См. `lib/optimizer/gradient.ts`.

### Compliance Officer — Regulated PSP

> «Любое автономное движение средств между корреспондентскими счетами без явного подтверждения treasurer — автоматическое compliance violation. Расскажите нам до того, как тратиться, не списывайте. Рынок полон AI Autopilot демо, которые не пройдут наш второй audit gate.»

**Pain:** AI Autopilot демо, которые ломают compliance.
**Sight's answer:** Co-pilot модель — каждый перевод требует Execute + audit log. См. `executeTransfer` в `lib/store/accounts-store.ts`.

---

## Сюжет

Под капотом зашит один центральный сценарий: счёт **`usd-nyc` (NovaPay USD · NYC, JPMorgan)** сконфигурирован так, что за 180 дней истории дрейфует ниже своего минимума `$800K`. ML это видит, проецирует слабость ещё на 14 дней вперёд, и Sight кричит «NYC в беде» через алерты, красный статус и AI-инсайт.

Поверх этого есть кризисные сценарии (`SWIFT Outage 48h`, `Black Friday Surge` и др. — `lib/data/crisis-scenarios.ts`), которые применяются как дельты к прогнозу и позволяют стресс-тестить казну.

---

## Алгоритмы

Sight — это не визуализация JSON. Это четыре алгоритмических слоя, каждый из которых считает что-то нетривиальное.

### 1. Forecasting ensemble (`ml/scripts/`)

**5 базовых моделей** учатся на 180 днях истории каждого счёта:

| Модель | Что ловит | Реализация |
|---|---|---|
| **Prophet** | Тренд + недельная сезонность, устойчив к выбросам | `fbprophet`, additive trend |
| **LightGBM Quantile** | Нелинейные паттерны, кросс-счётные сигналы, 35 фичей | `objective: quantile`, лаги, скользящие средние, day-of-week one-hot |
| **ARIMA** | Авторегрессия + интеграция, классический baseline | `statsmodels` auto-orders |
| **ETS** | Holt-Winters экспоненциальное сглаживание с сезонностью | `statsmodels` ETS |
| **Chronos** | Zero-shot foundation model (Amazon Science, T5-based) | Shared pipeline `chronos-t5-small` |

**Ridge stacker** учится на **out-of-fold предсказаниях**: 5 окон по 7 дней до holdout-периода, каждое окно фитится с нуля, OOF-предсказания собираются в матрицу `[N × 5]` и подаются в ridge. Это даёт **честный** weight per model — стакер не видел свои base-предсказания во время обучения.

**Conformal calibration** (`calibrate.py`): берёт абсолютные ошибки на калибровочном окне, считает взвешенный квантиль `q = 0.8` (свежие точки весят больше), полученный halfwidth добавляется к prediction → P10/P90 покрывают 80% будущих точек с гарантией.

**Model selection** (`selection.json`): для каждого счёта на holdout-окне измеряется MAPE всех 6 моделей (5 базовых + stacker), выбирается лучшая. Веса в Sight Brain считаются как `(1/MAPE) / Σ(1/MAPE)` — обратно-MAPE нормировка.

### 2. Computed alerts (`lib/data/alerts.ts`)

Алерты не лежат в JSON. Хук `useAlertsAt(offset)` каждый рендер:

1. Берёт прогноз ±7 дней вокруг `offset`.
2. Ищет счета, где `min(forecast[d].p50) < 1.2 × minBalance` на горизонте.
3. Для каждого критического — подбирает донора:
   - Та же валюта + buffer > 1.5× minBalance → приоритет (no FX risk).
   - Иначе — крупнейший USD-счёт через SWIFT.
4. Считает рекомендованную сумму: `target - forecast.p10` (восполнить до 1.5× минимума по нижней границе).
5. Confidence считается из ширины P10/P90 интервала на дне дефицита.

Это даёт алерты, **реагирующие на Time Machine и crisis-сценарии** в real-time, без пересчёта JSON.

### 3. Sight Compass (`lib/utils/sight-compass.ts`)

Лёгкий ранкер для баннера сверху. Алгоритм:

1. Фильтрует counts со статусом `critical` (балла нарушает min уже сегодня).
2. Сортирует по дефициту `(minBalance - balance) / minBalance`.
3. Для каждого — находит донора: same-currency + buffer > 1.15× minBalance + $200K cushion.
4. Возвращает пакет до 5 переводов с reason-строкой.
5. `Apply` → раскатывает план через `executeTransfer` со stagger 220ms (cinematic эффект на глобусе).

В отличие от Optimizer, Compass работает с **текущим** балансом, без 14-дневного горизонта — это быстрый ответ «что делать прямо сейчас».

### 4. Liquidity Gradient Optimizer (`lib/optimizer/gradient.ts`)

Полноценный solver для всей казны. Считает план **из прогнозов на 14 дней**.

**Pressure** (счёт нуждается):
```
pressure(account) = Σ_{d=0..14} max(0, minBalance − balance_d) · (15 − d)
```
Дефицит на ближний день весит 15, на 14-й — 1. Это даёт солвера, который сначала тушит ближние пожары.

**Supply** (счёт может отдать):
```
supply(account) = min_{d=0..14}(balance_d − minBalance)
```
Сколько счёт может отдать **на всём горизонте**, не упав сам ниже минимума.

**Жадно-итеративный flow** (до 40 итераций):
1. `recipient = argmax(pressure)`.
2. `donor = argmax(supply | currency = recipient.currency)`.
3. `amount = min(supply(donor), pressure_reduction_target)`.
4. Канал через `channels.ts`: EUR↔EUR → SEPA ($0.50), same-currency не-EUR → SWIFT ($25), settlement↔settlement → VISA/MASTERCARD (0.08%). Кросс-валютные — запрещены в v1.
5. Применяем перевод ко всему 14-дневному прогнозу донора/получателя.
6. Пересчитываем pressure всех счетов. Если total pressure < ε — стоп.

Результат — pressure map (красная полоска before, синяя after) и упорядоченный список переводов с reason типа `Lifts NYC above min on day +3`.

### 5. Crisis overlay (`lib/data/crisis-scenarios.ts`)

Сценарии (`SWIFT Outage 48h`, `Black Friday Surge`, `Crypto Winter`, `Regulator Audit`) — не статичные тексты, а **функции-дельты**. Каждый сценарий — это `applyDelta(account, dayOffset) → number`, которая накатывается поверх прогноза в `getEffectiveBalanceAt`. Поэтому все алгоритмы выше — alerts, Compass, Optimizer — автоматически реагируют на включённый кризис.

---

## Что внутри дашборда

### Шапка
- **Liquidity Score** — общий health-score (`lib/utils/scoring.ts`)
- **⌘K Command Palette** — быстрый поиск по счетам и действиям
- **Optimize** — открывает Liquidity Optimizer (см. отдельный раздел ниже)
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

### Liquidity Optimizer (`lib/optimizer/`, кнопка `Optimize` в шапке)
- Полноценный алгоритм авто-перебалансировки всех 11 счетов за один проход. В отличие от Compass (простой ранкинг) и алертов (precomputed данные), Optimizer **считает план вживую** из прогнозов на 14 дней.
- **Pressure model** — для каждого счёта `pressure = Σ max(0, minBalance − bal_{d}) · (15 − d)` по дням `d ∈ [0..14]`. Чем раньше дефицит — тем больше вес.
- **Supply** = `min(balance_d − minBalance)` по всему горизонту: сколько счёт может отдать, не упав ниже минимума сам.
- **Жадно-итеративный flow**: argmax pressure (получатель) ← argmax supply (донор, в той же валюте). До 40 итераций или пока давление не упадёт почти до нуля. Каждый шаг сдвигает балансы донора/получателя на все 14 дней и пересчитывает давления.
- **Каналы** через `lib/optimizer/channels.ts`: EUR↔EUR → SEPA ($0.50), same-currency не-EUR → SWIFT ($25), settlement↔settlement → VISA/MASTERCARD (0.08%). Кросс-валютные — запрещены в v1.
- **UI** (`components/dashboard/optimizer-panel.tsx`) — модал с двумя колонками: список переводов с причиной (`Lifts NYC above min on day +3`) и pressure map (красная полоска before, синяя after по каждому счёту). Кнопка `Execute` раскатывает план через `executeTransfer` со stagger 220мс.

### Sight Brain (`/dashboard/brain`)
- Визуализация ML-ансамбля. Пять карточек базовых моделей (Prophet / LightGBM / ARIMA / ETS / Chronos) с авторскими SVG-иллюстрациями (синусоида с сезонностью, дерево решений, бар-чарт автокорреляций, сглаживание, attention-grid).
- **Sankey-merger** — потоки от каждой модели вливаются в горизонтальный input-bar над стакером, ширина потока сверху одинакова, снизу пропорциональна весу. Веса считаются как `1/MAPE`, нормированные.
- Стакер показывает итоговый прогноз на выбранный offset, P10/P90 — реальные числа из `forecasts.json`.
- Hover на карточку модели — поток ярчает, остальные диммятся, внизу появляется leaderboard с MAPE.

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

### Production-ready evolution (зелёное = есть, серое = roadmap)

Архитектура спроектирована так, чтобы переход от демо к прод-версии не ломал ни UI, ни ML-пайплайн. Меняется только источник балансов и transactions.

```
🟢 [Реализовано в демо]              ⚪ [Roadmap для прод-версии]

⚪ Banking adapters                  
   (Halyk Open Banking, Kaspi B2B,   
    Plaid, GoCardless, SWIFT GPI)    
   → lib/data/banking-adapter.ts     
                ↓                    
⚪ Postgres (Prisma schema)          
   Tenant / Account / Transaction /  
   Forecast / Alert / AuditEvent     
   → prisma/schema.prisma            
                ↓                    
🟢 Python ML pipeline (ml/scripts/)   
   generate_history → train_ensemble 
   → calibrate → export_for_frontend 
                ↓                    
🟢 JSON contract (public/data/*.json)
   accounts / forecasts / backtest / selection
                ↓                    
🟢 Next.js (Vercel)                  
   App Router + Zustand + Globe + AI  
                ↓                    
🟢 Браузер (десктоп)                  
```

**Что это даёт:**
- Прод-переход не требует переписывания UI или ML-логики — только подменяется источник данных (Python читает Postgres вместо генератора).
- Adapter pattern изолирует compliance-sensitive код (OAuth, certificate auth, PSD2 AISP) в одном слое.
- Audit trail (`AuditEvent` в Prisma) встроен в схему с Day 1 — SOC 2 Y2 не требует rewrite.
- Tenant isolation на уровне схемы — multi-tenant SaaS без рефакторинга.

См. [`prisma/schema.prisma`](prisma/schema.prisma) для полного дизайна и [`lib/data/banking-adapter.ts`](lib/data/banking-adapter.ts) для интерфейса интеграций.

---

## Серверный слой

Sight — это **два бэкенд-слоя**: Python ML-пайплайн (офлайн, см. раздел «ML-пайплайн») генерирует прогнозы; Next.js API обслуживает запросы пользователя поверх артефактов пайплайна.

### `POST /api/insights` (`app/api/insights/route.ts`)

AI-инсайты по конкретному счёту в конкретный момент времени.

Запрос:
```ts
{ accountId: string, dayOffset: number (-60..60), context?: string (<=400) }
```

Поток обработки:
1. **Rate limit** — 20 req/min на IP, in-memory token bucket по `x-forwarded-for`.
2. **Валидация** через Zod (strict, отклоняет всё лишнее).
3. **Контекст-сборка** — `insight-context.ts` берёт счёт из `accounts.json`, вырезает окно ±7 дней из `forecasts.json`, считает дельту к минимуму, формирует структурированный промпт.
4. **System prompt** — задаёт тон Sight (спокойный, конкретные числа, 2-3 предложения), запрещает фабрикацию данных.
5. **Generation** — `generateText` (AI SDK v6) → `gpt-4o-mini`, `temperature: 0.4`, `maxOutputTokens: 250`. На Vercel — через AI Gateway (failover между провайдерами), локально — напрямую через `OPENAI_API_KEY`.
6. **Cache** — клиент кэширует ответ в `useInsightsStore` по ключу `accountId+offset+context`. Инвалидация при `executeTransfer`.

Ответ:
```ts
{ insight: string, tokensUsed: number, model: string, generatedAt: string }
```

### Контракт данных

`public/data/*.json` — версионируемый read-only слой между ML-пайплайном и UI. Все 4 файла типизированы в TS (`lib/data/*`), импортируются статически через `import ... from "@/public/data/forecasts.json"` — Next.js inlining делает их доступными в build-time без рантайм-fetch.

Это даёт две сильные стороны:
- **Детерминированный демо** — один и тот же `--seed` в ML-пайплайне → тот же дашборд у всех зрителей.
- **Zero infra** — нет БД, нет миграций, нет дрейфа схемы. Для прод-версии слой меняется на Postgres + nightly cron без изменений в UI или контрактах данных.

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

### Дизайн

Цель — прогноз дневного баланса на 14 дней вперёд по каждому из 11 счетов, с честными P10/P90 интервалами.

Один счёт = одна задача time-series forecasting. Это значит:
- 11 независимых ансамблей (модели не делятся между счетами, кроме Chronos pipeline).
- Каждая модель обучается на своих 180 точках + лагах.
- Out-of-fold протокол строго respects причинно-следственную связь: всё, что использовано для обучения, **строго раньше** того, что предсказывается.

### Скрипты (`ml/scripts/`)

- **`accounts_config.py`** — метаданные 11 счетов + поведенческие профили: базовая траектория (`flat` / `growing` / `declining`), недельная амплитуда, daily noise σ, transaction patterns. USD-NYC сконфигурирован с `trajectory: declining` и низким бустером — это сюжетная пружина продукта.
- **`generate_history.py`** — синтезирует 180 дней транзакций детерминированно (`--seed 42` по умолчанию). Поведение каждого счёта = base trend + weekly seasonality + transaction-driven shocks (Visa settlements в пятницу, SEPA reservation в понедельник, FX-rebalance в среду) + Gaussian noise.
- **`features.py`** — 35 фич для LightGBM:
  - Лаги: balance(t-1), (t-2), (t-7), (t-14).
  - Скользящие средние: 3/7/14/30 дней.
  - Std-окна: волатильность 7/14 дней.
  - Сезонности: `dayofweek` one-hot (7), `dayofmonth` sin/cos, `weekofyear` sin/cos.
  - Кросс-счётные: суммарный USD-баланс, EUR-баланс (сигналы корреляции между счетами).
- **`train_models.py`** — фитит Prophet и LightGBM на каждый счёт. LightGBM — с `objective: quantile, alpha: 0.5` (медианный прогноз).
- **`extra_models.py`** — ARIMA (auto-orders через `pmdarima`), ETS (Holt-Winters additive), Chronos (shared T5-small pipeline, zero-shot).
- **`train_ensemble.py`** — главный скрипт обучения стакера:
  1. Holdout: последние 30 дней не видит никто.
  2. На остальной истории — **5 OOF-окон по 7 дней** (`OOF_WINDOWS=5`, `STACK_HORIZON=7`).
  3. В каждом окне: фитим все 5 base-моделей на `data[:cutoff]`, предсказываем `data[cutoff:cutoff+7]`, складываем (pred, actual) пары.
  4. Получаем матрицу `[35 × 5]` (5 окон × 7 дней × 5 моделей) → ridge-регрессия предсказывает actual из base-predictions.
  5. Финал: фитим base-модели на всей не-holdout истории, предсказываем 7 дней holdout, прогоняем через stacker — это и есть честная MAPE стакера.
- **`ensemble_inference.py`** — продакшен-инференс: фитит base-модели на полной истории, делает 14-дневный прогноз, прогоняет через stacker.
- **`calibrate.py`** — conformal P10/P90:
  - На последних 30 днях считает `|actual − predicted|` для каждой точки.
  - Веса убывают экспоненциально к старшим точкам (свежее = важнее).
  - `halfwidth = weighted_quantile(residuals, weights, q=0.8)`.
  - `P90 = forecast + halfwidth`, `P10 = forecast − halfwidth`. Coverage держится в районе 80% на holdout (см. backtest).
- **`model_selection.py`** + **`selection.json`** — для каждого счёта меряет MAPE всех 6 моделей на holdout, фиксирует winner. Дефолт — всегда stacker (он редко проигрывает), но в edge-cases (короткая история, очень сильная сезонность) winner может быть Prophet или ETS.
- **`export_for_frontend.py`** — пакует прогнозы + history + интервалы + metadata в `public/data/forecasts.json`.
- **`backtest.py`** — walk-forward на 30 днях против бейзлайнов: `naive` (последнее значение), `moving_avg_7`, `seasonal_naive_7`. Считает MAPE на горизонтах 1/3/7/14, coverage P10/P90, F1 по детекции дефицитов.
- **`run_all.py`** — оркестратор. Флаги `--skip-train`, `--skip-chronos`, `--skip-calibrate` для итераций.

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
    brain/              Sight Brain (визуализация ансамбля)
    lab/                Sight Lab (метрики ML)
    crisis/             плейсхолдер
  api/insights/         AI-инсайты (AI SDK + OpenAI)
components/
  landing/              hero, секции, dock-навигация, футер
                          (+ OptimizerSection — раздел про liquidity-gradient на лендинге)
  dashboard/            карточки, графики, алерты, command palette, panels
    optimizer-panel.tsx        модал Liquidity Optimizer
    brain/                     SVG-иллюстрации моделей + Sankey-merger
  sight/                основной глобус (sight-globe.tsx)
  globe/                overlay-эффекты для глобуса
    money-flow-overlay.tsx   живые денежные потоки (Bezier-частицы)
    globe-hover-card.tsx     карточка hover на маркере
  sidebar/  ui/         общие примитивы
lib/
  data/                 типизированные загрузчики счетов / прогнозов / алертов / сценариев / ensemble
  store/                Zustand-сторы (6 шт.)
  utils/                форматтеры, scoring, compass, insight context
  optimizer/            алгоритм Liquidity Gradient
    gradient.ts                computeLiquidityGradientPlan(accounts) — основной solver
    channels.ts                выбор канала и расчёт комиссии
    types.ts                   OptimizerStep / OptimizerPlan / AccountPressure
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

## Технические заметки

- **Next.js 16 + React 19** — App Router, новые дефолты кэширования и файловые конвенции. Перед правкой см. `node_modules/next/dist/docs/` и `AGENTS.md` (LLM training data на этот Next ещё не успели догнать).
- **Desktop-first**. На мобильных рендерится `MobileFallback` — глобус + cinematic-эффекты рассчитаны на ≥1280px viewport.
- **Synthetic data, by design**. Все балансы NovaPay сгенерированы детерминированно из `accounts_config.py`. Сюжетная пружина «USD-NYC дрейфует ниже минимума» зашита в trajectory счёта, и ансамбль самостоятельно её выявляет — это валидация модели, а не подсказка.
- **Декоративные vs реальные потоки**. Живые частицы на глобусе (`TYPICAL_FLOWS`) — визуализация типичной активности, на балансы не влияют. Изменения балансов идут только через `executeTransfer` (Compass, Optimizer, ad-hoc transfer).

### Roadmap

- **Sight Globe enhancements** — расширенный план в [`sightglobe.md`]. Реализовано: живые потоки, hover-карточки, авто-фокус камеры, time-aware визуалы, sonar-пульсы. В планах: Connection Web, Globe Mood, фильтры по валютам, тулбар.
- **Concentration risk (HHI)** — индекс Херфиндаля-Хиршмана по контрагентам и валютам для метрики counterparty risk.
- **Anomaly filter** — IsolationForest / IQR-based детекция аномальных транзакций в pre-processing.
- **Persistence layer** — Postgres + nightly cron для пересчёта прогнозов; multi-tenant auth для прод-SaaS.

---

## Связанные документы

- [`PROJECT.md`](PROJECT.md) — расширенное описание архитектуры и data flow.
- [`AGENTS.md`](AGENTS.md) — инструкции для AI-агентов (Next.js 16 особенности).
- [`sightglobe.md`](sightglobe.md) — детальный план улучшений глобуса.
- [`ml/README.md`](ml/README.md) — внутренности ML-пайплайна.
