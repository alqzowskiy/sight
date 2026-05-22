# Sight — мастер-план

Единый план: что сделано, что критично доделать, что добавить в продукт.

**Контекст автора:** 16 лет. Не можем использовать сервисы 18+ (Plaid, Stripe billing,
Twilio, реальные банковские API, KYC-сервисы). Только то что доступно без проверки
возраста: Vercel, Neon, OpenAI, Clerk (free tier), GitHub, open-source библиотеки.

**Фокус:** усиление **самого продукта** — алгоритмы, UI, AI, визуализация — а не
интеграции которые требуют взрослой регистрации.

---

## ✅ Что уже сделано (для контекста)

| Этап | Результат |
|---|---|
| **P0** HHI + Industry refs + CustDev + Co-pilot | Concentration card, banking references, 3 personas |
| **P1** TAM/SAM/SOM + GTM + Prisma stub + Anomaly | Market sizing, 3-stage GTM, 579 anomalies via IsolationForest |
| **P2** Tests + SHAP feature importance | 33 vitest, SHAP в Brain |
| **Phase 1** Real Backend | Neon Postgres, 6 API routes, audit log |
| **Phase 2** Counterparty Cascade | Bank picker, cinematic cascade, risk-weighted HHI |
| **Phase 3** Conversational AI | /api/v1/chat + 3 tools (simulate/concentration/counterparty) |
| **Phase 4** Auto-tour | 60-секундный deterministic demo |
| **Phase 5** Attestation page | Live system snapshot at /attestation |
| **Phase 6** Live state | Polling, Activity panel, audit log visible |
| **Header polish** | 5 кнопок вместо 10 |
| **Markdown в чате** | react-markdown с bold/code/lists |
| **Off-topic guardrail** | Soft scope, не жёсткий refusal |
| **Real thinking** | Из user intent, не fake cycling |
| **Neon Postgres prod** | DATABASE_URL подключён, 1144 forecasts seeded |

---

## 🔥 Что КРИТИЧНО доделать (16-17 часов)

Без этого — продукт остаётся «одно демо», на хакатоне не побеждает.

### M1. Production deploy на Vercel + Neon — **2 ч**

**Зачем:** жюри получают URL и заходят. Без живого URL — pitch проваливается.

**Шаги:**
1. Переименовать env vars в Vercel: `trysight_DATABASE_URL` → `DATABASE_URL`
2. Push → Vercel auto-deploy на main
3. `npx prisma migrate deploy` против Neon production branch
4. `pnpm db:seed` на prod branch
5. Smoke test production URL

**Доступно:** ✅ Vercel + Neon без возрастных ограничений

---

### M2. Auth via Clerk (slim) — **3 ч**

**Зачем:** «можно зарегистрироваться» — это первое что жюри попробует.

**Шаги:**
1. Clerk install через Vercel Marketplace (5 мин)
2. `middleware.ts` с `clerkMiddleware`
3. `/sign-in` и `/sign-up` страницы — однострочники
4. `<UserButton />` вместо «NP» avatar
5. Hero CTA: гостям → `/sign-up`, залогиненным → `/dashboard`

**Доступно:** ✅ Clerk free tier, регистрация с 13 лет

---

### M3. Multi-tenant lazy-create — **2 ч**

**Зачем:** каждый user видит **свой** tenant, не NovaPay.

**Шаги:**
1. `externalId` в `TenantUser` модель (Clerk user id), миграция
2. Переписать `resolveTenantId()` — pull from session, lazy create
3. Demo tenant `novapay` помечен `isDemo: true`, доступен на `/demo/dashboard` без auth
4. Все 6 `/api/v1/*` уже фильтруют — автоматически работают

---

### M4. Onboarding wizard (slim) — **2 ч**

**Зачем:** новый user попадает на пустой dashboard — frustration. Дать выбор.

**Шаги:**
1. `/onboarding` с 2 кнопками:
   - **🚀 Clone NovaPay demo** — клонирует 11 accounts + forecasts в tenant пользователя
   - **📋 Start blank** — пустой dashboard с empty state
2. `/dashboard` редиректит на `/onboarding` если `accounts.length === 0`
3. `POST /api/v1/onboarding/clone-demo` backend

---

### M5. Pitch deck — **3 ч**

13 слайдов в Markdown → конвертится в PDF через pandoc. Структура в `HACKATHON_LESSONS.md` раздел 8.

---

### M6. README polish + final commit — **1 ч**

Live demo URL, badge, screenshot, всё работает.

---

### M7. Mobile fallback на /brain и /lab — **2 ч**

Жюри могут открыть на телефоне. Сейчас mobile fallback только на main dashboard.

---

### M8. Error polish — **1.5 ч**

Graceful 503, retry banner, empty states, OPENAI_API_KEY missing handling.

---

### M9. Demo backup video — **1 ч**

90-секундный screen capture как fallback если live упадёт.

---

**M1-M9 итого: 17.5 ч** (помещается в 24-часовой хакатон с запасом).

---

## 🚀 Продуктовые фичи (что добавить чтобы продукт реально wow'нул)

Всё это **без внешних 18+ сервисов** — только наша математика, AI через OpenAI,
file processing, browser API. Можно сделать дома.

### Priority A — Реальная польза, не polish

#### A1. FX hedge optimizer — **3 ч**

**Зачем:** Отдельный продукт-surface для CFO с non-USD позициями. Реальная боль
(Kantox делает на этом $50M). Без него — мы только liquidity, с ним — full treasury.

**Что:**
- Расчёт оптимального hedge ratio для каждой не-USD позиции
- Формула: optimal_hedge = (correlation × σ_exposure / σ_hedge) × position_size
- UI: новый раздел в `/dashboard` или модал из header
- Показывает: текущий exposure, рекомендованный hedge, ожидаемый cost
- Tool в Copilot: `optimizeFxHedge(accountId)`

**Файлы:**
- `lib/utils/fx-hedge.ts` — pure math
- `components/dashboard/fx-hedge-panel.tsx` — UI
- `app/api/v1/chat/route.ts` — добавить tool

---

#### A2. Stress test composer — **2 ч**

**Зачем:** Сейчас scenarios активируются по одному. С композицией — compound impact.
«Что если SWIFT outage + Black Friday + JPMorgan default одновременно?»

**Что:**
- Crisis panel позволяет активировать несколько scenarios одновременно
- Архитектура уже поддерживает — delta-функции суммируются
- UI: чекбоксы вместо single-toggle для статичных scenarios
- Compound impact в footer: «Combined impact: -$X.YM frozen, HHI 4520»
- AI insight для composed scenario: «3 simultaneous stressors. Survivors: ...»

**Файлы:**
- `components/dashboard/crisis-panel.tsx` — multi-select UI
- `lib/utils/forecast.ts` — уже суммирует deltas, проверить

---

#### A3. CSV/Excel upload of bank statements — **3 ч**

**Зачем:** **ЭТО КИЛЛЕР ДЛЯ 16-ЛЕТНЕГО**. Любой ребёнок может попробовать с своими
данными без подключения к банку. Просто загрузил выписку — Sight его обрабатывает.

**Что:**
- `/dashboard/import` страница: drag-drop CSV или Excel
- Парсинг через `papaparse` (CSV) или `xlsx` (Excel)
- Auto-detection columns: date, amount, description, balance
- Mapping wizard: user сопоставляет колонки нашей схеме
- Импорт в `Transaction` table → автоматически считаются alerts, HHI, anomalies
- Поддерживает форматы: Kaspi PDF→CSV, Halyk выписка, Sberbank, Bank of America и др.

**Файлы:**
- `app/dashboard/import/page.tsx`
- `lib/import/csv-parser.ts`
- `lib/import/format-detector.ts` — heuristics по headers
- `app/api/v1/import/route.ts`

**Доступно:** ✅ pure file processing, никаких внешних сервисов

---

#### A4. Connection web на глобусе — **3 ч**

**Зачем:** Sight Globe — wow-фича, но сейчас связи между банками не визуализируются.
Connection web — линии между банками показывающие историческую частоту переводов.

**Что:**
- При hover на marker → подсвечиваются все banks с которыми был обмен
- Толщина линии = частота переводов
- Цвет линии = доминирующий channel (SEPA=blue, SWIFT=black, INTERNAL=grey)
- Toggle в правом верхнем углу глобуса

**Файлы:**
- `components/globe/connection-web-overlay.tsx`
- Использует уже существующий `transaction-flows.ts`

---

#### A5. Voice interface в Copilot — **3 ч**

**Зачем:** WOW-фактор для демо. На питче: «Hey Sight, what if JPMorgan defaults?»
→ AI начинает говорить ответ.

**Что:**
- Web Speech API (browser-only, free, no signup)
- Кнопка 🎤 рядом с input в chat
- Speech recognition → text → отправка в /api/v1/chat
- Speech synthesis для ответов (опционально)
- Поддержка EN/RU/KZ

**Файлы:**
- `components/dashboard/voice-input.tsx`
- Использует `webkitSpeechRecognition` / `speechSynthesis`

**Доступно:** ✅ Browser-only, никаких внешних API

---

### Priority B — Polish & expansion

#### B1. AI weekly briefing — **2 ч**

**Зачем:** «User opens app on Monday morning, sees AI-generated summary».
Реальная фича для retention.

**Что:**
- Кнопка «📊 Weekly briefing» в header
- AI генерирует 3-параграфный отчёт:
  1. Что произошло за неделю (transfers, anomalies)
  2. Что прогнозируется на следующую (alerts, scenarios)
  3. Рекомендации
- Использует существующий /api/v1/chat с system prompt типа «generate weekly briefing»
- Опционально: PDF export

---

#### B2. Multilingual Copilot — **1 ч**

**Зачем:** Local KZ market. Презентация на русском.

**Что:**
- Detect язык user message
- System prompt инструктирует отвечать на том же языке
- Поддерживает: EN, RU, KZ
- Test: спросить по-русски → AI отвечает по-русски

**Файлы:**
- `app/api/v1/chat/route.ts` — обновить system prompt

---

#### B3. Public read-only share link — **1 ч**

**Зачем:** Viral growth. CFO шарит дашборд коллегам по token-link.

**Что:**
- В Settings → «Share dashboard» → генерируется token URL
- `/share/[token]` → read-only view дашборда
- Token хранится в `Tenant.shareToken`
- Без auth, expires через 30 дней

---

#### B4. Custom KPI widgets — **4 ч**

**Зачем:** Power-user feature. Each treasury team хочет свои метрики.

**Что:**
- Settings → «Configure dashboard»
- User выбирает widgets из библиотеки: HHI by X, top counterparty, days till next dip, etc.
- Drag-to-reorder
- Сохраняется в Tenant settings

---

#### B5. Account groups / portfolios — **2 ч**

**Зачем:** Group related accounts (e.g., «US operations», «EU reserves»).

**Что:**
- Tag-based grouping в settings
- HHI counts по groups, не только banks
- Filter dashboard by group

---

#### B6. Forecast quality metrics в Lab — **2 ч**

**Зачем:** Lab page имеет MAPE table но нет visualization. Расширить.

**Что:**
- Calibration curve (actual vs predicted scatter)
- Coverage chart (P10/P90 hit rate over time)
- Per-account model winner heatmap

---

#### B7. Time-series annotations — **2 ч**

**Зачем:** User mark events on charts («Q1 close», «product launch»).

**Что:**
- Click on chart → add annotation
- Stored in `TenantAnnotation` table
- Visible across all charts in dashboard

---

#### B8. Goals & targets — **2 ч**

**Зачем:** «User sets target balance for each account, Sight tracks progress».

**Что:**
- Per-account: target balance + target date
- Progress bar в AccountCard
- Alert when forecast won't hit target

---

### Priority C — Compliance & data

#### C1. PDF export audit log — **1.5 ч**

**Зачем:** Compliance officer demo killer.

**Что:**
- Кнопка в Activity panel: «Export audit log as PDF»
- Через `react-pdf` или server-side `puppeteer`
- Sight-branded report с подписью

---

#### C2. CSV export transactions — **0.5 ч**

**Что:** Tools menu → «Export all transactions» → CSV download.

---

#### C3. Backup/restore JSON — **1 ч**

**Зачем:** Data ownership / portability.

**Что:**
- Settings → «Export all data» → ZIP с accounts + transfers + audit
- «Import» — обратная операция

---

### Priority D — UX wow

#### D1. Sankey flow между accounts — **3 ч**

**Зачем:** Visualize money flow patterns. Topology of treasury.

**Что:**
- В Lab page → новый tab «Money flow»
- D3 Sankey diagram: accounts as nodes, transfers as flows
- Hover на link → detail

---

#### D2. Dark mode — **2 ч**

**Зачем:** Trader's natural environment.

**Что:**
- Tailwind dark: classes
- Toggle в settings
- Сохранение в cookie

---

#### D3. Forecast confidence dashboard — **2 ч**

**Зачем:** Show WHY confidence is high/low.

**Что:**
- Per-account: variance breakdown
- Which model contributes most
- «Confidence is 73% because LightGBM/Prophet disagree on day +5»

---

## 📊 Что в каком приоритете

| Приоритет | Что | Часы |
|---|---|---|
| 🔥 **MUST** (Mn) | Deploy + Auth + Multi-tenant + Onboarding + Pitch deck + Mobile + Errors + Demo video + README | 17.5 |
| ⭐ **A** (high impact) | FX hedge, Stress composer, CSV upload, Connection web, Voice | 14 |
| 🟡 **B** (polish) | Weekly briefing, Multilingual, Share link, Custom widgets, Groups, Lab metrics, Annotations, Goals | 16 |
| 🟢 **C** (compliance) | PDF audit, CSV transactions, Backup | 3 |
| 🟦 **D** (UX wow) | Sankey, Dark mode, Confidence dashboard | 7 |
| | **Total** | **57.5 ч** |

24-часовой хакатон уложится в **M (17.5h) + 2-3 from A** (например A2 stress composer 2h + A3 CSV upload 3h = 5h = **22.5ч total**, помещается).

---

## 🎯 Рекомендованная последовательность

**Часы 1-8 — MUST foundation:**
1. M1 Production deploy (2h)
2. M2 Clerk auth (3h)
3. M3 Multi-tenant lazy-create (2h)
4. M7 Mobile fallback (1h частично)

**Часы 9-13 — Onboarding & demo:**
5. M4 Onboarding wizard (2h)
6. A3 CSV upload (3h) ← убойная фича для возраст-блокированных user'ов

**Часы 14-18 — Product wow:**
7. A2 Stress test composer (2h)
8. A4 Connection web (3h)

**Часы 19-22 — Polish:**
9. M8 Error polish (1.5h)
10. M9 Demo backup video (1h)
11. M7 Mobile fallback finalize (1h)
12. M6 README polish (1h)

**Часы 23-24 — Pitch:**
13. M5 Pitch deck (3h… ужать в 2h если время)
14. Final smoke test + buffer

**Итого: 23h продуктивной работы + 1h буфер = 24ч.**

---

## ❌ Что НЕ делаем (намеренно отложено)

| Идея | Почему |
|---|---|
| Plaid sandbox | 18+ requirement |
| Real Halyk/Kaspi API | KYC, нельзя без compliance |
| Stripe billing | 18+ requirement |
| Twilio SMS | 18+ |
| KYC providers | 18+ |
| Real bank statement OAuth (Yodlee, MX) | 18+ |
| Custom domains per tenant | Y2 |
| White-label | Y2 |
| OpenAPI spec / Swagger UI | Низкий ROI для презентации |
| Multi-user collaboration (real-time) | Y2 |
| Team management (Clerk Orgs) | Y2 |
| Per-tenant ML retraining | Y2 |

Эти идеи в roadmap (в `SAAS_PLAN.md` или mentioned в README), но для хакатона не делаем.

---

## 🏆 Success criteria к концу хакатона

**Hard requirements (без них — провал):**
- [ ] Production URL https://trysight.vercel.app живой
- [ ] Можно sign-up по email или Google
- [ ] После sign-up — wizard с выбором (demo clone / blank)
- [ ] Demo clone работает за <5 секунд
- [ ] Dashboard, brain, lab, attestation — все доступны
- [ ] Counterparty cascade демонстрируется в auto-tour
- [ ] AI chat отвечает (если есть OPENAI_API_KEY)
- [ ] CSV import работает на хотя бы одном bank statement формате
- [ ] Mobile fallback — все 3 dashboard pages корректны
- [ ] README pretty, pitch deck готов

**Nice to have (если время есть):**
- [ ] Stress test composer
- [ ] Connection web
- [ ] FX hedge optimizer
- [ ] Voice interface
- [ ] Weekly briefing
- [ ] PDF audit export

---

## 📁 Связанные документы

- [`README.md`](README.md) — описание продукта
- [`HACKATHON_LESSONS.md`](HACKATHON_LESSONS.md) — стратегия + pitch slide структура
- [`PROJECT.md`](PROJECT.md) — архитектура
- [`TECH_TODO.md`](TECH_TODO.md) — детальный P0-P3 чек-лист
- [`BACKEND_PLAN.md`](BACKEND_PLAN.md) — реализованные Phase 1-5
- [`SAAS_PLAN.md`](SAAS_PLAN.md) — полный multi-tenant план (M2-M4 это slim version)
