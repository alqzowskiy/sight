# Sight — SaaS evolution plan

Превращение Sight из single-tenant демо (один захардкоженный `novapay`) в
настоящий multi-tenant SaaS: каждый пользователь регистрируется, создаёт
свою «финтех-компанию», добавляет банковские счета и видит свой
персональный дашборд.

**Время:** 12-16 часов в 6 фаз. Каждая фаза самостоятельна — можно
остановиться после Phase 7 (минимальный auth) и уже иметь рабочую
регистрацию.

**Что уже сделано к этой точке:**
- БД на Neon Postgres с `Tenant` и `TenantUser` моделями в схеме (готово к multi-tenant)
- API routes под `/api/v1/*` с `resolveTenantId()` (сейчас hardcoded на `novapay`)
- `accountMetas` импортируется из `accounts.json` — нужно перевести на DB-driven

---

## Стратегические решения

### Auth provider — Clerk

**Почему Clerk, а не NextAuth/Auth.js/Supabase:**
- Native Vercel Marketplace integration — 1 click install, env vars auto-injected
- Pre-built UI components (sign-in, sign-up, user-button) — нет нужды дизайнить формы
- Multi-tenant из коробки через **Organizations** — каждая компания = org
- Free tier: **10,000 MAU + unlimited orgs**, это покрывает любые потребности хакатона/MVP
- Webhook на signup → автоматически создаём `Tenant` в нашей БД

Альтернативы:
- **NextAuth/Auth.js** — бесплатно, но 2-3x больше работы (нужно делать UI, OAuth providers, сессии)
- **Supabase Auth** — хорошо, но дублирует наш Postgres
- **Custom JWT** — overkill для хакатона

### Tenancy модель

- Один user может принадлежать нескольким `Tenant`s (типа GitHub user в нескольких orgs)
- В UI — tenant switcher вверху (как в Vercel/Linear)
- Активный tenant хранится в session/cookie
- ВСЕ API queries добавляют `WHERE tenantId = ?`

### Per-tenant data strategy

Новый user, который только что зарегистрировался, не имеет ML-прогнозов
(нужны исторические данные). Три варианта подачи:

| Опция | Что показываем | Реалистичность |
|---|---|---|
| **A. Try demo data** | Импортируем NovaPay данные в их tenant — мгновенный wow | Лучше для onboarding |
| **B. Blank slate** | Пустой дашборд, добавляй счета сам | Честно, но «зачем мне эта пустыня» |
| **C. Naive baseline** | Показываем счета, прогноз = «last value» с placeholder | Компромисс |

Делаем **A + B как выбор пользователя**: после signup экран «Hi, want to
explore with demo data or start with your own?»

### ML для новых tenants

- Tenants с <30 днями данных: показываем naive baseline forecast (last value flat) + badge «ML model warming up»
- Когда накопится 30+ дней: ночной cron запускает обучение per-tenant (Y2 фича, в этом плане только заготовка)

---

## Phase 7 — Auth via Clerk (2-3 часа)

**Цель:** работающие sign-up и sign-in. После этой фазы — user может зарегистрироваться, но видит всё ещё `novapay` данные.

### Phase 7.1 — Clerk install (15 мин)

```bash
# Через Vercel Marketplace (рекомендую) — env vars auto-injected
vercel integrations install clerk
# Или вручную:
pnpm add @clerk/nextjs
# В .env:
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
# CLERK_SECRET_KEY=sk_...
```

Заходишь на dashboard.clerk.com → создаёшь app → копируешь keys.

### Phase 7.2 — Provider + middleware (30 мин)

**Файлы:**
- `app/layout.tsx` — оборачиваем root в `<ClerkProvider>`
- `middleware.ts` — `clerkMiddleware()` защищает все routes кроме `/`, `/api/auth/*`, `/sign-in`, `/sign-up`

```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});
```

### Phase 7.3 — Sign-in / Sign-up страницы (30 мин)

**Файлы:**
- `app/sign-in/[[...sign-in]]/page.tsx` — `<SignIn />` компонент Clerk
- `app/sign-up/[[...sign-up]]/page.tsx` — `<SignUp />` компонент

Оба — однострочники, Clerk рендерит pre-built UI.

### Phase 7.4 — User button в header (15 мин)

Заменить захардкоженный «NP» avatar в `dashboard-layout.tsx` на `<UserButton />` Clerk — показывает avatar реального user'а с dropdown menu (Profile, Sign out).

### Phase 7.5 — Landing redirect (15 мин)

На лендинге `/` — кнопка «Open the live demo» в Hero меняется:
- Не залогинен → ведёт на `/sign-up`
- Залогинен → ведёт на `/dashboard`

Используем `auth().userId` (server-side) или `useUser()` (client).

**Deliverables Phase 7:**
- ✅ Можно sign up / sign in
- ✅ Middleware защищает `/dashboard`, `/dashboard/lab`, `/dashboard/brain`, `/api/v1/*`
- ✅ User button в header
- ✅ Landing редиректит правильно

**После Phase 7:** auth работает, но все юзеры видят NovaPay данные (tenant ещё захардкожен).

---

## Phase 8 — Multi-tenant isolation (2 часа)

**Цель:** каждый user имеет свой tenant. API queries фильтруют по tenantId из session.

### Phase 8.1 — Clerk webhook → создание Tenant (45 мин)

При signup Clerk шлёт webhook `user.created`. Мы:
1. Принимаем webhook на `app/api/webhooks/clerk/route.ts`
2. Верифицируем signature через `svix`
3. Создаём `Tenant` в нашей БД с `slug = clerk_user_id` (или org_id если используем Clerk Organizations)
4. Создаём `TenantUser` запись (email, role=CFO)

Альтернатива (проще): lazy-create — при первом запросе к `/api/v1/*` создаём tenant если нет. Меньше webhook drama.

**Выбираю lazy-create** для хакатона.

### Phase 8.2 — extractTenant из session (30 мин)

**Файл:** `lib/db/client.ts` — переписать `resolveTenantId()`:

```ts
import { auth } from "@clerk/nextjs/server";

export async function resolveTenantId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // Lazy-create tenant on first request
  let tenant = await db.tenant.findFirst({
    where: { users: { some: { externalId: userId } } },
  });
  if (!tenant) {
    tenant = await createTenantForUser(userId);
  }
  return tenant.id;
}
```

Нужно расширить `TenantUser` модель полем `externalId` (Clerk user id). Добавляем миграцию.

### Phase 8.3 — Seed NovaPay как «demo tenant» (15 мин)

Сейчас seed создаёт tenant `novapay`. Меняем — пометить его как `isDemo: true` и не привязывать к user'ам. Это будет «public demo tenant», который любой может посмотреть через спец URL `/demo/dashboard`.

### Phase 8.4 — Защитить все API (15 мин)

Все 6 endpoints под `/api/v1/*` уже используют `resolveTenantId()` — после Phase 8.2 они автоматически фильтруют по правильному tenant. Нужно проверить что нет hardcoded запросов без `tenantId` фильтра.

### Phase 8.5 — Tenant switcher (опционально, 30 мин)

Если user в нескольких tenants — dropdown в header. Сохраняет `activeTenantId` в cookie.

**Deliverables Phase 8:**
- ✅ После signup user попадает в свой пустой tenant
- ✅ API queries возвращают только данные текущего tenant
- ✅ Demo tenant `novapay` доступен на спец URL для маркетинга
- ✅ Tenant switcher если user в >1 org

---

## Phase 9 — Onboarding wizard (3-4 часа)

**Цель:** после signup user проходит wizard и оказывается в готовом дашборде со своими счетами.

### Phase 9.1 — Onboarding гейтер (30 мин)

`/dashboard` проверяет: если у tenant'а 0 accounts → редирект на `/onboarding`. Иначе обычный дашборд.

### Phase 9.2 — Wizard UI (2 ч)

**Файл:** `app/onboarding/page.tsx` — multi-step wizard.

**Шаги:**

#### Step 1 — Company info
- Name (e.g., "Kazpay")
- Region (CIS / EU / US / SEA / MENA)
- Base currency (USD / EUR / GBP / KZT)
- Industry: PSP / EMI / FinTech / Bank / Other

#### Step 2 — Demo data choice (THE CRITICAL STEP)
Два карточки на выбор:
- **🚀 Try with NovaPay demo data** — clone our 11 accounts + 90d history + forecasts into your tenant. Instant wow.
- **📋 Start blank** — add your own accounts one by one. Honest start.

Если выбрал demo: клонирует NovaPay accounts (через `db.account.createMany` с подменой tenantId), копирует forecasts. ~2 секунды.

Если blank: переходит к Step 3.

#### Step 3 — Add first account (только если blank)
Форма:
- Account name (e.g., "USD operating · NYC")
- Bank (free text)
- Currency (dropdown 5 options)
- Country (ISO 3166 dropdown)
- Initial balance
- Min balance (regulatory floor)
- Account type (Operational / Settlement / Reserve / FX Hedge)
- Location (lat/long — auto-fill по country/city OR map picker)

Кнопки: «Add another» / «Done, take me to dashboard»

#### Step 4 — Finish
Toast «Welcome to Sight». Редирект на `/dashboard`.

### Phase 9.3 — POST /api/v1/onboarding (1 ч)

Backend endpoint принимает wizard data и:
1. Обновляет `Tenant` с name, region, baseCurrency, industry
2. Если demo: клонирует NovaPay accounts/forecasts
3. Если blank + accounts: создаёт `Account` записи

**Deliverables Phase 9:**
- ✅ После первого захода в дашборд — wizard
- ✅ Можно либо клонировать demo, либо начать с нуля
- ✅ После wizard'а — дашборд работает (даже пустой)

---

## Phase 10 — Account CRUD via API (2 часа)

**Цель:** user может добавлять/редактировать/удалять счета прямо из дашборда.

Сейчас Zustand store имеет `addAccount`/`removeAccount`/`updateAccountMeta`, но они только в памяти. Нужно проксировать через API.

### Phase 10.1 — POST /api/v1/accounts (30 мин)
Создание нового счёта. Zod schema = AccountInput. Возвращает созданный account.

### Phase 10.2 — PATCH /api/v1/accounts/[id] (30 мин)
Обновить name, bank, minBalance, etc. НЕ позволяет менять `tenantId`.

### Phase 10.3 — DELETE /api/v1/accounts/[id] (15 мин)
Soft delete: `isActive = false`. Forecasts остаются (audit trail).

### Phase 10.4 — Settings panel + AccountManager UI (45 мин)
Расширить существующий `settings-panel.tsx`:
- Список счетов с edit/delete действиями
- Кнопка «Add account» → модал
- Сохранение через API

### Phase 10.5 — Wire Zustand to API (15 мин)
`accounts-store.ts`: `addAccount` теперь POST'ит → обновляет store из response. То же для update/remove.

**Deliverables Phase 10:**
- ✅ Add account модал работает с реальным БД
- ✅ Edit/delete тоже
- ✅ Refresh страницы — изменения сохраняются

---

## Phase 11 — Per-tenant ML strategy (2-3 часа)

**Цель:** для новых tenants без истории — наивный прогноз с warning badge. Для tenants с 30+ днями — обучение.

### Phase 11.1 — Forecast availability check (30 мин)

При запросе `/api/v1/forecasts/[accountId]`:
- Если у account < 30 дней истории → возвращаем naive forecast (last value + interval)
- Иначе → существующий ML pipeline

Naive: 14 точек со значением = последний balance, P10/P90 = ±5% от balance.

### Phase 11.2 — «Model warming up» UI (30 мин)

В `account-detail-panel.tsx` и `dashboard/lab`:
- Если account новый — badge «ML warming up · need 30+ days»
- Заменить ensemble visualization на статичное объяснение

### Phase 11.3 — Sandbox: synthesize fake history button (1 ч)

В Settings panel: кнопка **«⚡ Generate 90 days of demo history»** — для tenant'а
синтезирует историю балансов (тот же подход что в `ml/scripts/generate_history.py`,
но клиентский TS вариант для одного аккаунта).

Это позволяет blank-slate users сразу попробовать ML без 30-дневного ожидания.

### Phase 11.4 — Per-tenant Python pipeline (1 ч, опционально)

Vercel Cron на `/api/cron/retrain-tenant?tenantId=X` который запускает Python через Vercel Sandbox или экспортируется в облако. Для хакатона можно пропустить.

**Deliverables Phase 11:**
- ✅ Новые tenants видят прогнозы (naive baseline) и warning badge
- ✅ «Generate demo history» кнопка — мгновенно дает ML-like UI

---

## Phase 12 — Team & settings (1-2 часа, опционально)

**Цель:** user может приглашать коллег в свой tenant.

### Phase 12.1 — Clerk Organizations switch (30 мин)
Если используем Clerk Organizations, всё это бесплатно — Clerk сам делает invitation flow.

### Phase 12.2 — TenantUser sync (30 мин)
Webhook `organizationMembership.created` → создаём `TenantUser` в нашей БД с правильной role.

### Phase 12.3 — Settings → Team page (30 мин)
Показать членов команды, их role, кнопку «Invite». Invite link генерится Clerk'ом.

**Deliverables Phase 12:**
- ✅ Owner может пригласить коллег
- ✅ Разные роли (CFO, Treasurer, Analyst, Compliance) с разными правами

---

## Полный график

| Phase | Часы | Что появляется |
|---|---|---|
| 7. Auth via Clerk | 2-3 | Sign up/in работают, middleware защищает routes |
| 8. Multi-tenant isolation | 2 | Каждый user видит только свой tenant |
| 9. Onboarding wizard | 3-4 | Demo clone или blank slate выбор + первые accounts |
| 10. Account CRUD | 2 | Add/edit/delete счета из дашборда |
| 11. Per-tenant ML | 2-3 | Naive forecast для новых tenants + «warm up» badge |
| 12. Team (опц) | 1-2 | Invite teammates через Clerk |
| **Total** | **12-16 ч** | Полноценный multi-tenant SaaS |

---

## Минимальный путь (если время тает)

**Если есть только 6-7 часов:**
- Phase 7 (Auth) — 3ч
- Phase 8.1-8.4 (Multi-tenant без switcher) — 1.5ч
- Phase 9.1-9.2 без Step 3 (только Demo clone) — 2ч

После этого: user регистрируется → клонирует NovaPay demo → видит свой
готовый дашборд. Простая history, но работает.

**Если есть полные 14+ часов:**
- Все 6 фаз
- + полировка onboarding UX (анимации, illustrations)
- + landing редизайн с pricing

---

## Что меняется в коде (структура)

```
new files:
  middleware.ts                          # Clerk middleware
  app/sign-in/[[...sign-in]]/page.tsx    # Clerk SignIn
  app/sign-up/[[...sign-up]]/page.tsx    # Clerk SignUp
  app/onboarding/page.tsx                # Wizard
  app/api/webhooks/clerk/route.ts        # (optional) webhook handler
  app/api/v1/onboarding/route.ts         # Wizard backend
  app/api/v1/accounts/[id]/route.ts      # PATCH/DELETE
  components/onboarding/*                # Wizard UI
  lib/onboarding/clone-demo.ts           # Clones NovaPay data into new tenant
  lib/onboarding/naive-forecast.ts       # Last-value baseline

modified files:
  prisma/schema.prisma                   # +externalId on TenantUser, +isDemo on Tenant
  lib/db/client.ts                       # resolveTenantId reads Clerk session
  app/layout.tsx                         # ClerkProvider wrapper
  components/dashboard/dashboard-layout.tsx  # UserButton, onboarding gate
  lib/store/accounts-store.ts            # API-driven addAccount
  app/page.tsx                           # auth-aware Hero CTAs
```

---

## Что НЕ в этом плане

Намеренно отложено на Y2+:
- Billing / Stripe integration (Clerk Billing есть, но для хакатона избыточно)
- Real banking integrations (Plaid/Halyk) — это `lib/data/banking-adapter.ts` roadmap
- Custom domains per tenant
- Email notifications
- Advanced role permissions (только базовые CFO/Treasurer/Analyst)
- White-label / Vercel for Platforms

---

## С чего начать

Рекомендую: **Phase 7 (Clerk install + sign-up)** — это самое visible
изменение, после которого можно сразу демо.

После 7 + 8.1-8.4 (5 часов суммарно) у тебя уже **рабочий multi-user SaaS**
с лимитом «один tenant на user через lazy-create».

Phases 9-12 потом расширяют опыт, но базовый sign-up работает уже после 7+8.
