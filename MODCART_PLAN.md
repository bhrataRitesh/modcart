# Modcart — Master Development Plan

> Last updated: 2026-04-04
> Current phase: Phase 5
> Current task: 5.1
> Overall progress: 29 / 48 tasks complete

## How to use this file
- Update "Current task" every time you start a new task
- Mark tasks with [x] when complete, [~] when in progress, [ ] when not started
- Add errors to the ERROR LOG section immediately when they occur
- Add notes under any task that needed special handling

## Legend
- [ ] Not started
- [~] In progress
- [x] Complete
- [!] Blocked (reason in notes)

---

## PHASE 1 — Security & Integrity
> Goal: Make the codebase safe before adding any features.
> Status: COMPLETE

- [x] 1.1 — Delete FORCE_UPDATE debug route (server.ts:63) [Small]
- [x] 1.2 — Create Zod validation schemas for all routes [Medium]
- [x] 1.3 — Implement RBAC middleware with role + ownership guards [Medium]
- [x] 1.4 — Centralize env config with Zod validation at startup [Small]
- [x] 1.5 — Add rate limiting (@fastify/rate-limit) [Small]
- [x] 1.6 — Fix all ~34 TypeScript `any` usages, enable strict mode [Medium]

## PHASE 2 — Core Commerce Loop
> Goal: Real money, real orders, real emails.
> Status: COMPLETE

- [x] 2.1 — Replace Stripe mock with real PaymentIntent + Elements flow [Large]
- [x] 2.2 — Stripe webhook handler (succeeded, failed, refunded) [Medium]
- [x] 2.3 — Order status lifecycle (PENDING → PAID → SHIPPED → DELIVERED) [Medium]
- [x] 2.4 — MinIO cleanup on image/product delete + nightly orphan job [Medium]
- [x] 2.5 — Transactional email system (Resend + React Email templates) [Medium]
- [x] 2.6 — Password reset flow (forgot + reset routes + email) [Medium]
- [x] 3.1 — Public vendor registration + KYC flow + admin review queue [Large]

## PHASE 3 — Vendor Growth
> Goal: Self-serve vendor ecosystem.
> Status: IN PROGRESS

- [x] 3.1 — Public vendor registration + KYC flow + admin review queue [Large]
- [x] 3.2 — Product variants UI (size/color/SKU — schema exists at schema.prisma:210) [Large]
- [x] 3.3 — Per-vendor commission rates (replace flat 10%) [Small]
- [x] 3.4 — Stripe Connect for real vendor payouts [Large]
- [x] 3.5 — Inventory management + low-stock alerts + StockEvent log [Medium]
- [x] 3.6 — Public vendor storefront page (/vendors/[slug]) [Medium]

## PHASE 4 — Platform Intelligence
> Goal: Data, observability, notifications.
> Status: NOT STARTED

- [x] 4.1 — Admin audit log (AuditLog model + middleware + UI) [Medium]
- [x] 4.2 — Advanced admin analytics dashboard (revenue, cohorts, funnel) [Large]
- [x] 4.3 — Vendor analytics dashboard (per-vendor charts) [Medium]
- [x] 4.4 — SEO: generateMetadata, sitemap.xml, robots.txt, JSON-LD [Small]
- [x] 4.5 — In-app notification center (bell icon + WebSocket delivery) [Medium]
- [x] 4.6 — Sentry error monitoring (API + all frontends) [Small]
- [x] 4.7 — Performance monitoring (Web-Vitals integration + reporting) [Small]

## PHASE 5 — World-Class Storefront
> Goal: Features that match Shopify / Amazon / Etsy.
> Status: NOT STARTED

- [ ] 5.1 — Advanced search (facets, autocomplete, fuzzy, synonyms, personalization) [Large]
- [ ] 5.2 — Recommendation engine (also-bought, similar, trending, recently viewed) [Large]
- [ ] 5.3 — Wishlist + price drop alerts + social urgency signals [Medium]
- [ ] 5.4 — Promotions & discount system (coupons, flash sales, countdown timers) [Large]
- [ ] 5.5 — Advanced product pages (Q&A, verified reviews, helpfulness votes, lightbox) [Medium]
- [ ] 5.6 — Multi-currency + i18n foundation (next-intl, RTL for Arabic) [Medium]

## PHASE 6 — Performance & Scale
> Goal: Production-hardened, tested, deployable.
> Status: NOT STARTED

- [ ] 6.1 — Component modularization (break all 1000+ line files into /components) [Medium]
- [ ] 6.2 — API performance (Redis cache, cursor pagination, DB indexes, compression) [Medium]
- [ ] 6.3 — Media optimization (sharp resizing, 3 sizes, blur placeholder, CDN headers) [Medium]
- [ ] 6.4 — CI/CD pipeline (GitHub Actions: lint → test → build → deploy) [Medium]
- [ ] 6.5 — Testing foundation (vitest unit + Playwright E2E, 80% API coverage) [Large]

---

## ERROR LOG

> Add every error here immediately when it occurs. Never delete entries — mark them resolved instead.
> Format: [DATE] [TASK] [STATUS] Description

| # | Date | Task | Status | Error | Resolution |
|---|------|------|--------|-------|------------|
| — | —    | —    | —      | No errors yet | — |

---

## DECISIONS & NOTES

> Record any architectural decisions, workarounds, or deviations from the plan here.

| Date | Task | Decision | Reason |
|------|------|----------|--------|
| —    | —    | —        | —      |

---

## COMPLETED TASKS LOG

> Moved here from the checklist above when marked [x]. Keeps the checklist clean.

- [x] 1.1 — Delete FORCE_UPDATE debug route (server.ts:63) [Small]
- [x] 1.2 — Create Zod validation schemas for all routes [Medium]
- [x] 1.3 — Implement RBAC middleware with role + ownership guards [Medium]
- [x] 1.4 — Centralize env config with Zod validation at startup [Small]
- [x] 1.5 — Add rate limiting (@fastify/rate-limit) [Small]
- [x] 1.6 — Fix all ~34 TypeScript `any` usages, enable strict mode [Medium]
- [x] 2.1 — Replace Stripe mock with real PaymentIntent + Elements flow [Large]
- [x] 2.2 — Stripe webhook handler (succeeded, failed, refunded) [Medium]
- [x] 2.3 — Order status lifecycle (PENDING → PAID → SHIPPED → DELIVERED) [Medium]
- [x] 2.4 — MinIO cleanup on image/product delete + nightly orphan job [Medium]
- [x] 2.5 — Transactional email system (Resend + React Email templates) [Medium]
- [x] 2.6 — Password reset flow (forgot + reset routes + email) [Medium]
- [x] 3.1 — Public vendor registration + KYC flow + admin review queue [Large]
- [x] 3.2 — Product variants UI (size/color/SKU — schema exists at schema.prisma:210) [Large]
- [x] 3.3 — Per-vendor commission rates (replace flat 10%) [Small]
- [x] 3.4 — Stripe Connect for real vendor payouts [Large]
- [x] 3.5 — Inventory management + low-stock alerts + StockEvent log [Medium]
- [x] 3.6 — Public vendor storefront page (/vendors/[slug]) [Medium]
- [x] 4.1 — Admin audit log (AuditLog model + middleware + UI) [Medium]
- [x] 4.3 — Vendor analytics dashboard (per-vendor charts) [Medium]
- [x] 4.2 — Advanced admin analytics dashboard (revenue, cohorts, funnel) [Large]
- [x] 4.4 — SEO: generateMetadata, sitemap.xml, robots.txt, JSON-LD [Small]
- [x] 4.5 — In-app notification center (bell icon + WebSocket delivery) [Medium]
- [x] 4.6 — Sentry error monitoring (API + all frontends) [Small]
- [x] 4.7 — Performance monitoring (Web-Vitals integration + reporting) [Small]
