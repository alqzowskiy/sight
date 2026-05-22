# Sight — следующий план (UX + tenant isolation + ML)

Всё что наболело по итогам пробного onboarding-а. Сгруппировано в 4 фазы.
Каждая фаза самостоятельная — можно остановиться после любой.

**Время:** 11-14 часов. Покрывает все жалобы из последних сообщений.

---

## 🔥 Group A — Tenant-aware branding & UX (4 часа · CRITICAL)

Это «продукт перестаёт пахнуть NovaPay» — главная зона полировки.

### A1. Company name в onboarding (45 мин)

Сейчас при signup tenant.name = `"username's Treasury"`. Юзер не может задать
имя компании — а это первое что лезет в шапку, Sight Compass alerts, AI chat
context, etc.

**Что:**
- Onboarding wizard — **Step 0** (новый, до выбора пути): «What's your company?»
  - Поле: company name (e.g., "Kazpay", "Onor Fintech")
  - Поле: industry (PSP / EMI / Fintech / Bank / Other)
  - Поле: home region (CIS / EU / MENA / SEA / US)
- POST `/api/v1/onboarding` принимает `companyName, industry, region`
- Обновляет `Tenant.name` + `Tenant.region`
- Если skip → дефолт `"My Treasury"`

### A2. Replace «NovaPay» / «NP» everywhere (45 мин)

Грепаю все упоминания «NovaPay» в UI и заменяю на `tenant.name` через context
или server-side props.

**Места:**
- Header breadcrumb «NovaPay / Dashboard» → `tenant.name / Dashboard`
- Globe overlay label «NovaPay treasury map» → `${tenant.name} treasury map`
- AccountDetailPanel «NovaPay USD · NYC» в title → from account.name as-is, no static
- Compass banner text → references current tenant
- Page metadata «Sight · NovaPay Dashboard» → `Sight · ${tenant.name}`
- AI chat system prompt — passes tenant.name to prompt
- README / pitch deck — отдельно (Y2)

### A3. Hide demo-only controls для не-демо тенантов (45 мин)

| Кнопка | Когда показывать |
|---|---|
| **Auto-tour** | Только когда `tenant.isDemo === true` (демо сценарий жёстко привязан к NovaPay accounts) |
| **Crisis** | Только когда `tenant.isDemo === true` (crisis-scenarios.ts ссылаются на NovaPay account ids) |
| **Reset** | Только когда `tenant.isDemo === true` |
| **Demo (kiosk)** | Уже удалено |
| Optimize, FX Hedge, Copilot, Search, New Transfer | Доступно всем |

Для не-демо тенантов остаётся: Search · Copilot · Optimize · FX Hedge · New Transfer · Settings · UserButton.

Это решит проблему «навбар перегружен».

### A4. Header layout reorg (1.5 часа)

**Текущая ситуация (для non-demo):** Search · Copilot · Optimize · FX Hedge · Crisis · Auto-tour · NewTransfer · Reset · NavSettings · UserButton — слишком много.

**Цель:** ≤ 5 видимых элементов справа от breadcrumb.

Решение:
- **Copilot** — переезжает в **floating button bottom-right** (как Intercom/Crisp). Всегда виден, всегда доступен. Освобождает место в шапке.
- **FX Hedge, Optimize, New Transfer** объединяются в **«Actions ▾»** dropdown справа от Search.
- В шапке для не-демо tenant'а остаётся: **Breadcrumb · Liquidity Health · Search · Actions ▾ · UserButton**. 5 элементов.
- Для демо tenant'а: тот же набор + **Crisis · Auto-tour** видны рядом (для демо-сценария).

---

## 🟡 Group B — Account creation polish (2 часа)

### B1. City — отдельное поле на Account (1 час)

Сейчас marker label парсит city из `account.name.split("·")[1]`. Это
эвристика которая ломается для юзер-созданных аккаунтов (показывает только
валюту без города, как на скриншоте Astana/Almaty).

**Что:**
- `prisma/schema.prisma` — добавить `Account.city String?`
- Миграция (db push)
- POST `/api/v1/accounts` принимает `city` в body
- Onboarding wizard сохраняет выбранный city как отдельное поле
- AccountSchema (Zod) + AccountDTO — добавить city
- Marker label = `${currency} · ${city}` где city берётся напрямую из account.city (fallback на name parsing для legacy NovaPay)

### B2. Расширить CITY_PRESETS (45 мин)

Сейчас в onboarding-wizard 19 городов. Юзеру нужна **KZ-сфокусированная**
выборка плюс глобальные узлы.

**Добавить:**
- KZ: Almaty, Astana (есть), Aktau, Atyrau, Shymkent
- Central Asia: Tashkent (UZ), Bishkek (KG)
- Europe: добавить Warsaw (PL), Prague (CZ), Vienna (AT), Stockholm (SE)
- MENA: Dubai (есть), Riyadh (SA), Cairo (EG)
- Asia: Mumbai (IN), Shanghai (CN), Seoul (KR)

Итого ~28 городов с ISO country codes и lat/lon.

### B3. Полное название страны на marker (15 мин)

Сейчас `country` хранится как ISO-2 (`KZ`, `US`). Маркер на globe показывает
только city без country, что может быть неоднозначно. Добавить country full name
mapping для tooltip / detail panel.

---

## 🟢 Group C — ML для новых tenants (3 часа)

### C1. Synthetic baseline history (2 часа)

При создании нового account через onboarding configure сейчас пишется
**один forecast point** (сегодняшний balance). Прогноз отсутствует, UI
показывает мёртвый график.

**Что делать:**
- При POST `/api/v1/accounts` генерируем **90 дней синтетической истории + 14 дней forecast**
- Алгоритм: starting balance ± slow drift (small daily noise σ ≈ 0.5% от balance + weekly seasonality)
- Forecast: P10/P90 = balance ± 3% spread (naive)
- ModelChoice = `"naive"` для всех таких точек

Это даст:
- Полноценный график в AccountDetailPanel
- HHI / Alerts работают
- Активность видна на globe

Честность: добавим badge **«Baseline forecast — ML training requires 30+ days»** на AccountCard.

### C2. «ML warming up» badge (30 мин)

На AccountCard и в Detail Panel для аккаунтов с `modelChoice === "naive"`
показывать маленький badge «Baseline» или «Warming up». Это signals что
forecast — это baseline, не trained ensemble.

### C3. Endpoint для ML status (30 мин)

`/api/v1/ml-status` — возвращает per-tenant:
- daysOfHistory
- modelsTrained: bool
- nextRetrainEstimate
- accuracyMetrics (если есть)

Для UI badges и attestation page.

---

## 🔵 Group D — Connection web на globe (3 часа · A4 from MASTER_PLAN)

Прерванная задача — лопасти связи между банками.

### D1. Compute connections from real transfers (1 час)

`lib/globe/connection-web.ts`:
- Группирует все `transfers` по `(fromAccountId, toAccountId)`
- Per pair: count + total volume + dominant channel
- Sort by volume desc, top 20

### D2. ConnectionWebOverlay component (1.5 часа)

`components/globe/connection-web-overlay.tsx`:
- Canvas/SVG слой над globe (как MoneyFlowOverlay)
- Line thickness ∝ log(volume)
- Line color = dominant channel (SEPA=blue, SWIFT=zinc-900, INTERNAL=zinc-400, VISA=indigo, MASTERCARD=orange)
- Hover на marker → подсвечиваются все его connections, остальные диммятся

### D3. Toggle на globe (30 мин)

Кнопка в top-right корнере globe: `[🔌 Connections]` toggle.

---

## ⚪ Group E — Money flow overlay tenant-aware (1 час)

**Проблема (из скриншота):** на globe летают decorative SWIFT/SEPA particles
для tenant'а с двумя KZ счетами. Particles берутся из `TYPICAL_FLOWS`
(hardcoded NovaPay accounts).

**Что:**
- `MoneyFlowOverlay` получает `markers: AccountMarker[]` как prop
- Фильтрует `TYPICAL_FLOWS` где BOTH from/to ID находятся в markers
- Для blank/cloned tenant'ов: пустой список → не спавнит particles
- Для original NovaPay (когда добавим /demo/dashboard): полный список → spawn

---

## 📊 Итого

| Group | Время | Что закрывает |
|---|---|---|
| A. Tenant branding | 4 ч | Header перегружен · NovaPay везде · demo-кнопки на чужих tenant'ах |
| B. Account creation | 2 ч | City на маркере · больше стран · KZT уже добавлен |
| C. ML для новых | 3 ч | «Мёртвый график» на user-created accounts · honest baseline |
| D. Connection web | 3 ч | Visual wow на globe |
| E. Money flow fix | 1 ч | Fake particles на чужих tenant'ах |
| **Total** | **13 ч** | |

---

## Рекомендованный порядок

1. **A3 + E** (1.5 ч) — самые быстрые UX wins, скрывают NovaPay-specific вещи
2. **A1 + A2** (1.5 ч) — company name + branding пропадает
3. **B1 + B2** (1.5 ч) — city на marker
4. **A4** (1.5 ч) — header reorg + floating Copilot
5. **C1 + C2** (2.5 ч) — ML для новых
6. **D** (3 ч) — connection web — финальный wow

После 1-5 это уже полноценный multi-tenant SaaS для KZ market.

---

## Что НЕ в этом плане

- CSV upload (A3 в MASTER_PLAN) — отдельная задача
- Voice interface (A5)
- Weekly briefing (B1)
- Stress test composer (A2 в MASTER_PLAN)
- Plaid / banking integrations (18+)

Эти откладываем до закрытия Groups A-E.
