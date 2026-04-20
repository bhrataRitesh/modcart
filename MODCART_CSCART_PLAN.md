# Modcart → CS-Cart Feature Parity Plan

> **Goal:** Bring Modcart to exact CS-Cart Multi-Vendor feature parity.
> **Created:** 2026-04-14
> **Estimated Phases:** 12 (current progress through Phase 6 of original plan)
> **Estimated Total Tasks:** ~130

---

## Current Modcart Audit vs CS-Cart

### ✅ Already Built (What We Have)
| CS-Cart Feature | Modcart Status | Location |
|---|---|---|
| Multi-vendor architecture | ✅ Complete | `VendorProfile` model, vendor routes |
| Vendor registration + KYC | ✅ Complete | `POST /vendor/register` |
| Admin review queue for vendors | ✅ Complete | Admin panel vendors tab |
| Vendor dashboard + stats | ✅ Complete | Vendor panel app |
| Product CRUD (admin + vendor) | ✅ Complete | `products.ts`, `admin.ts` |
| Product variants (SKU/Price/Stock) | ✅ Complete | `ProductVariant` model |
| Product options (Select/Radio/Text) | ✅ Complete | `ProductOption` model |
| Product features/attributes per category | ✅ Complete | `Feature`, `CategoryFeature` models |
| Category tree (parent/child) | ✅ Complete | `Category` model with self-relation |
| Product images + multi-size WebP | ✅ Complete | `StorageClient.uploadImage` |
| Unified checkout (multi-vendor cart) | ✅ Complete | `Cart` → `Order` → `VendorOrder` split |
| Order splitting by vendor | ✅ Complete | `VendorOrder` model |
| Order lifecycle (PENDING→DELIVERED) | ✅ Complete | `OrderStatus` enum |
| Stripe payments (PaymentIntent) | ✅ Complete | `payments.ts` |
| Stripe webhooks | ✅ Complete | `payments.ts` webhook handler |
| Stripe Connect vendor payouts | ✅ Complete | `vendor.ts` Stripe onboarding |
| Per-vendor commission rates | ✅ Complete | `VendorProfile.commissionRate` |
| Vendor plans (schema only) | ⚠️ Schema exists | `VendorPlan` model, no API |
| Permissions/User groups (schema only) | ⚠️ Schema exists | `Permission`, `UserGroup` models, no API |
| Coupon codes | ✅ Complete | `Coupon` model + `promotions.ts` |
| Flash sales | ✅ Complete | `FlashSale` model + UI |
| Product reviews (verified purchase) | ✅ Complete | `Review` model + rating distribution |
| Product Q&A | ✅ Complete | `ProductQA` model |
| Wishlist + price drop alerts | ✅ Complete | `WishlistItem` + notifications |
| Full-text search (facets, autocomplete) | ✅ Complete | `@modcart/search` (MeiliSearch) |
| Recommendations (also-bought, trending) | ✅ Complete | `recommendation.service.ts` |
| Customer-vendor chat (WebSocket) | ✅ Complete | `chat.ts` |
| In-app notification center | ✅ Complete | `notifications.ts` + WebSocket |
| Transactional emails (Resend) | ✅ Complete | `email.service.ts` |
| Password reset flow | ✅ Complete | `auth.ts` |
| Audit logging | ✅ Complete | `AuditLog` model |
| Admin analytics (revenue, funnel) | ✅ Complete | Admin panel stats tab |
| SEO (sitemap, robots, meta, JSON-LD) | ✅ Complete | Storefront `sitemap.ts`, `robots.ts` |
| Sentry error monitoring | ✅ Complete | API + all frontends |
| Redis caching | ✅ Complete | `cache.ts` |
| CI/CD (GitHub Actions) | ✅ Complete | `.github/` |
| Inventory tracking + stock events | ✅ Complete | `StockEvent` model |

### ❌ Missing (CS-Cart Features We Don't Have Yet)

| CS-Cart Feature | Priority | Complexity |
|---|---|---|
| **Returns & Refunds (RMA)** | 🔴 Critical | Large |
| **Shipping methods + real-time rates** | 🔴 Critical | Large |
| **Tax management (zones, rates, rules)** | 🔴 Critical | Medium |
| **Order tracking (shipment tracking #)** | 🔴 Critical | Small |
| **Invoice / Packing slip PDF generation** | 🔴 Critical | Medium |
| **Gift certificates / Gift cards** | 🟡 High | Medium |
| **Reward points / Loyalty program** | 🟡 High | Medium |
| **Blog / CMS pages** | 🟡 High | Medium |
| **Banner management system** | 🟡 High | Small |
| **Product comparison** | 🟡 High | Small |
| **Product import/export (CSV)** | 🟡 High | Medium |
| **Multi-currency support** | 🟡 High | Medium |
| **Multi-language (i18n)** | 🟡 High | Large |
| **Vendor product moderation queue** | 🟡 High | Small |
| **Vendor rating tiers (Bronze/Silver/Gold)** | 🟢 Medium | Small |
| **Abandoned cart recovery emails** | 🟢 Medium | Medium |
| **Order notes + internal communication** | 🟢 Medium | Small |
| **Customer address book management** | 🟢 Medium | Small |
| **Bulk product operations** | 🟢 Medium | Medium |
| **Email templates (customizable)** | 🟢 Medium | Medium |
| **301 redirects management** | 🟢 Medium | Small |
| **Admin configurable settings page** | 🟢 Medium | Medium |
| **Guest checkout improvements** | 🟢 Medium | Small |
| **Social login (Google, Facebook)** | 🟢 Medium | Small |
| **Vendor staff sub-accounts** | 🟢 Medium | Medium |
| **Multi-storefront support** | 🔵 Low | X-Large |

---

## Implementation Phases

> Each phase is self-contained and deployable.
> Tasks are ordered by dependency — later tasks depend on earlier ones.

---

### PHASE 7 — Admin RBAC & Vendor Plans *(from original plan)*
> **Goal:** Granular role-based access control and monetizable vendor tiers.
> **Duration:** ~3 days
> **Dependencies:** None

- [x] **7.1** — Seed default permissions (`manage_products`, `manage_orders`, `manage_categories`, `manage_users`, `manage_vendors`, `manage_settings`, `view_analytics`, `manage_promotions`)
  - File: `packages/api/src/scripts/seed-permissions.ts`
  - Creates default `Permission` records + "Super Admin" and "Content Moderator" groups

- [x] **7.2** — RBAC middleware (`requirePermission`)
  - File: `packages/api/src/middleware/rbac.ts`
  - Expand JWT payload to include `permissions: string[]`
  - Update `auth.ts` login route to fetch user groups/permissions
  - `requirePermission('manage_products')` checks decoded token

- [x] **7.3** — Admin CRUD for Permissions & Groups
  - File: `packages/api/src/routes/admin.ts`
  - `GET /admin/permissions` — list all
  - `POST /admin/groups` — create group with permission IDs
  - `PUT /admin/groups/:id` — update group
  - `POST /admin/groups/:id/users` — assign user to group
  - Admin Panel UI: new "Roles & Permissions" tab

- [x] **7.4** — Vendor Plans API
  - File: `packages/api/src/routes/admin.ts`
  - `GET /admin/vendor-plans` — list plans
  - `POST /admin/vendor-plans` — create plan
  - `PUT /admin/vendor-plans/:id` — update plan
  - `POST /admin/vendors/:id/assign-plan` — assign plan + override commission
  - Enforce `maxProducts` limit in `POST /products` vendor route

- [x] **7.5** — Vendor Plans UI
  - Files: `apps/admin-panel/src/main.tsx`, `apps/vendor-panel/src/main.tsx`
  - Admin: "Vendor Plans" management tab
  - Vendor: Show current plan, limits, upgrade CTA

- [x] **7.6** — Vendor Product Moderation Queue
  - Schema: Add `requiresApproval` field to `Product` or use status `PENDING_REVIEW`
  - API: `PUT /admin/products/:id/approve` / `PUT /admin/products/:id/reject`
  - Admin UI: "Pending Products" section with approve/reject buttons
  - Config: Per-vendor setting (trusted vendors skip moderation)

---

### PHASE 8 — Shipping & Tax Engine
> **Goal:** Real-world shipping methods and tax calculation.
> **Duration:** ~4 days
> **Dependencies:** Phase 7

- [x] **8.1** — Shipping Zone + Method schema
- [x] **8.2** — Shipping calculation service
- [x] **8.3** — Shipping API routes
- [x] **8.4** — Tax Zone + Rule schema
- [x] **8.5** — Tax calculation service
- [x] **8.6** — Integrate shipping + tax into checkout
- [x] **8.7** — Admin UI: Shipping & Tax configuration

---

### PHASE 9 — Returns, Refunds & Order Management
> **Goal:** Full order lifecycle with RMA, tracking, and invoices.
> **Duration:** ~4 days
> **Dependencies:** Phase 8

- [ ] **9.1** — Return/RMA schema
  ```prisma
  model ReturnRequest {
    id            String @id @default(cuid())
    orderId       String
    order         Order @relation(...)
    userId        String
    user          User @relation(...)
    vendorOrderId String?
    status        ReturnStatus @default(REQUESTED)
    reason        String
    resolution    ReturnResolution? // REFUND, EXCHANGE, STORE_CREDIT
    adminNotes    String?
    items         ReturnItem[]
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
  }

  model ReturnItem {
    id              String @id @default(cuid())
    returnRequestId String
    returnRequest   ReturnRequest @relation(...)
    orderItemId     String
    quantity        Int
    reason          String?
  }

  enum ReturnStatus {
    REQUESTED
    APPROVED
    REJECTED
    RECEIVED
    REFUNDED
    EXCHANGED
    CLOSED
  }

  enum ReturnResolution {
    REFUND
    EXCHANGE
    STORE_CREDIT
  }
  ```

- [ ] **9.2** — RMA API routes
  - `POST /orders/:id/return` — customer initiates return
  - `GET /admin/returns` — list all return requests
  - `PUT /admin/returns/:id` — approve/reject/process
  - `GET /vendor/returns` — vendor sees their own returns
  - Trigger Stripe refund on approval

- [ ] **9.3** — Shipment tracking schema + API
  ```prisma
  model Shipment {
    id              String @id @default(cuid())
    vendorOrderId   String
    vendorOrder     VendorOrder @relation(...)
    carrier         String // "fedex", "ups", etc
    trackingNumber  String
    trackingUrl     String?
    status          ShipmentStatus @default(LABEL_CREATED)
    estimatedDelivery DateTime?
    shippedAt       DateTime?
    deliveredAt     DateTime?
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
  }

  enum ShipmentStatus {
    LABEL_CREATED
    IN_TRANSIT
    OUT_FOR_DELIVERY
    DELIVERED
    EXCEPTION
  }
  ```
  - `POST /vendor/orders/:id/shipment` — vendor adds tracking
  - Auto-update order status when tracking is added
  - Email customer with tracking info
  - Webhook from carrier for status updates (optional)

- [ ] **9.4** — Invoice + Packing Slip PDF generation
  - File: `packages/api/src/services/invoice.service.ts`
  - Use `@react-pdf/renderer` or `pdfkit` to generate PDFs
  - `GET /orders/:id/invoice.pdf` — download invoice
  - `GET /vendor/orders/:id/packing-slip.pdf` — vendor packing slip
  - Include: order #, items, prices, tax breakdown, shipping, addresses
  - Auto-email invoice to customer on order payment

- [ ] **9.5** — Order notes + internal communication
  - Schema: Add `OrderNote` model (userId, orderId, content, isInternal)
  - API: `POST /orders/:id/notes`, `GET /orders/:id/notes`
  - Admin/Vendor UI: notes timeline on order detail page
  - `isInternal = true` → only visible to staff

- [ ] **9.6** — Enhanced Order Management UI
  - Admin Panel: Full order detail drawer/page
    - Order timeline (status changes, notes, shipments)
    - Process refund button
    - Print invoice/packing slip
  - Vendor Panel: Same but scoped to their `VendorOrder`
  - Customer: order tracking page with shipment status

---

### PHASE 10 — Marketing & Loyalty Engine
> **Goal:** Gift cards, reward points, advanced promotions, abandoned cart recovery.
> **Duration:** ~4 days
> **Dependencies:** Phase 9

- [ ] **10.1** — Gift Certificate schema + API
  ```prisma
  model GiftCertificate {
    id          String @id @default(cuid())
    code        String @unique
    amount      Float
    balance     Float  // remaining balance
    senderId    String?
    recipientEmail String
    recipientName  String?
    message     String?
    status      GiftCertStatus @default(ACTIVE)
    expiresAt   DateTime?
    createdAt   DateTime @default(now())
  }

  enum GiftCertStatus {
    ACTIVE
    REDEEMED
    EXPIRED
    DISABLED
  }
  ```
  - `POST /gift-certificates/purchase` — customer buys a gift card
  - `POST /gift-certificates/redeem` — apply to cart at checkout
  - `GET /gift-certificates/check/:code` — check balance
  - Email the recipient with the code + custom message

- [ ] **10.2** — Reward Points / Loyalty System
  ```prisma
  model RewardPointsLedger {
    id          String @id @default(cuid())
    userId      String
    user        User @relation(...)
    points      Int   // positive = earned, negative = spent
    reason      String // "ORDER_PURCHASE", "REDEMPTION", "BONUS", "EXPIRED"
    referenceId String? // orderId or promotion ID
    expiresAt   DateTime?
    createdAt   DateTime @default(now())
  }
  ```
  - `GET /rewards/balance` — user's point balance
  - `POST /rewards/redeem` — spend points at checkout
  - Auto-earn points on order completion (configurable rate: $1 = X points)
  - Admin settings: points-per-dollar, redemption rate, expiry days
  - Admin UI: configure reward rules + view ledger

- [ ] **10.3** — Advanced Promotions Engine
  - Schema: Extend `Coupon` or create `Promotion` model
  - **Catalog promotions:** Auto-apply discounts to categories/products
  - **Cart promotions:** Conditions + actions:
    - Conditions: min cart total, product in cart, user group, category, quantity
    - Actions: % off, $ off, free shipping, free product, bonus points
  - Priority system (which promo applies first)
  - Availability windows (date ranges)
  - Admin UI: promotion builder with condition/action UI

- [ ] **10.4** — Abandoned Cart Recovery
  - Cron job: find carts older than 1 hour with items, user has email
  - Send recovery email with cart contents + link back
  - Track: opened, clicked, converted
  - Configurable delay (1hr, 24hr, 72hr sequences)
  - File: `packages/api/src/jobs/abandoned-cart.ts`

- [ ] **10.5** — Product Comparison
  - API: `POST /compare/add`, `DELETE /compare/remove`, `GET /compare`
  - Storefront: compare button on product cards
  - Comparison page: side-by-side table of features, price, specs
  - Stored in localStorage (guest) or server-side (logged in)
  - Max 4 products at a time

---

### PHASE 11 — Content Management System
> **Goal:** Blog, pages, banners — like CS-Cart's CMS.
> **Duration:** ~3 days
> **Dependencies:** None (parallel-safe)

- [ ] **11.1** — Blog system schema + API
  ```prisma
  model BlogPost {
    id          String @id @default(cuid())
    title       String
    slug        String @unique
    content     String // HTML or Markdown
    excerpt     String?
    coverImage  String?
    authorId    String
    author      User @relation(...)
    status      ContentStatus @default(DRAFT)
    tags        String[]
    seoTitle    String?
    seoDesc     String?
    publishedAt DateTime?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
  }

  enum ContentStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
  }
  ```
  - `GET /blog` — list published posts (paginated)
  - `GET /blog/:slug` — single post
  - `POST /admin/blog` — create post
  - `PUT /admin/blog/:id` — update post
  - `DELETE /admin/blog/:id` — delete post
  - Admin UI: rich text editor (TipTap or similar)

- [ ] **11.2** — CMS Pages
  ```prisma
  model CmsPage {
    id          String @id @default(cuid())
    title       String
    slug        String @unique
    content     String
    status      ContentStatus @default(DRAFT)
    showInFooter Boolean @default(false)
    showInNav   Boolean @default(false)
    sortOrder   Int @default(0)
    seoTitle    String?
    seoDesc     String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
  }
  ```
  - Standard pages: About, Contact, Terms, Privacy, FAQ
  - API: CRUD under `/admin/pages`
  - Storefront: dynamic route `/pages/:slug`

- [ ] **11.3** — Banner Management
  ```prisma
  model Banner {
    id          String @id @default(cuid())
    name        String
    type        BannerType // IMAGE, HTML
    imageUrl    String?
    htmlContent String?
    linkUrl     String?
    position    String // "homepage_hero", "sidebar", "category_top"
    isActive    Boolean @default(true)
    startDate   DateTime?
    endDate     DateTime?
    sortOrder   Int @default(0)
    createdAt   DateTime @default(now())
  }

  enum BannerType {
    IMAGE
    HTML
  }
  ```
  - API: `GET /banners?position=homepage_hero`, CRUD under `/admin/banners`
  - Storefront: fetch banners by position, render in slots
  - Admin UI: banner manager with image upload + scheduling

- [ ] **11.4** — 301 Redirects Management
  ```prisma
  model Redirect {
    id       String @id @default(cuid())
    fromPath String @unique
    toPath   String
    isActive Boolean @default(true)
  }
  ```
  - Auto-create redirect when product/category slug changes
  - Admin UI: manage redirects list
  - Middleware: check redirect table on 404

---

### PHASE 12 — Import/Export & Bulk Operations
> **Goal:** CSV product import/export, bulk actions.
> **Duration:** ~3 days
> **Dependencies:** Phase 7

- [ ] **12.1** — Product Export (CSV)
  - `GET /admin/products/export` → stream CSV download
  - Columns: name, slug, price, sku, stockQty, categoryNames, vendorName, status, images
  - Filterable: by vendor, category, status

- [ ] **12.2** — Product Import (CSV)
  - `POST /admin/products/import` — upload CSV
  - Parse + validate rows with Zod
  - Support: create new, update existing (match by SKU)
  - Error report: return rows that failed with reasons
  - Admin UI: import wizard with preview step

- [ ] **12.3** — Vendor Data Import Preset
  - Vendor can upload CSV to their own panel
  - Restricted columns (no vendor reassignment, no admin fields)
  - File: `POST /vendor/products/import`

- [ ] **12.4** — Bulk Product Operations
  - `PUT /admin/products/bulk` with body `{ ids: [], action: "activate" | "deactivate" | "delete" | "change_category" }`
  - Admin UI: checkbox column in products table + bulk action bar
  - Vendor UI: same but scoped to own products

---

### PHASE 13 — Multi-Currency & Internationalization
> **Goal:** Multiple currencies and languages like CS-Cart.
> **Duration:** ~5 days
> **Dependencies:** Phase 8

- [ ] **13.1** — Currency system
  ```prisma
  model Currency {
    id        String @id @default(cuid())
    code      String @unique // "USD", "EUR", "INR"
    symbol    String // "$", "€", "₹"
    name      String
    rate      Float  // Exchange rate relative to base currency
    isBase    Boolean @default(false)
    isActive  Boolean @default(true)
    decimals  Int @default(2)
    updatedAt DateTime @updatedAt
  }
  ```
  - API: CRUD under `/admin/currencies`
  - Auto-update exchange rates via API (Open Exchange Rates / Fixer.io)
  - Price conversion middleware: detect currency from header/cookie/query
  - Store orders in base currency, display in user's currency
  - Cron: daily rate refresh

- [ ] **13.2** — Price display layer
  - Storefront: `useCurrency()` hook for price formatting
  - Currency switcher in header
  - All price responses include `{ amount, currency, formatted }`

- [ ] **13.3** — Multi-language (i18n) foundation
  - Use `next-intl` or `i18next` for storefront
  - Translation key system for all UI strings
  - API: `Accept-Language` header support
  - Admin: translatable fields on products, categories, pages

- [ ] **13.4** — Language management
  ```prisma
  model Language {
    id     String @id @default(cuid())
    code   String @unique // "en", "hi", "es"
    name   String
    isActive Boolean @default(true)
    isDefault Boolean @default(false)
  }

  model Translation {
    id         String @id @default(cuid())
    langCode   String
    entityType String // "Product", "Category", "CmsPage"
    entityId   String
    field      String // "name", "description"
    value      String
    @@unique([langCode, entityType, entityId, field])
  }
  ```

---

### PHASE 14 — Advanced Customer Experience
> **Goal:** Social login, address book, vendor ratings, guest checkout.
> **Duration:** ~3 days
> **Dependencies:** Phase 9

- [ ] **14.1** — Social Login (Google + Facebook)
  - Use `@fastify/oauth2` or passport-style approach
  - `GET /auth/google` → redirect to Google OAuth
  - `GET /auth/google/callback` → create/link account
  - Same for Facebook
  - Uses existing `OAuthAccount` model

- [ ] **14.2** — Customer address book management
  - `GET /addresses` — list user addresses
  - `POST /addresses` — add new
  - `PUT /addresses/:id` — update
  - `DELETE /addresses/:id` — remove
  - `PUT /addresses/:id/default` — set as default
  - Storefront: address picker at checkout, manage in account page

- [ ] **14.3** — Vendor Rating Tiers
  - Auto-calculate vendor score from: avg review rating, order count, return rate
  - Tiers: Bronze (0-50 orders), Silver (50-200), Gold (200+)
  - Schema: Add `tier` to `VendorProfile` or compute dynamically
  - Display badge on vendor storefront page + product cards
  - Cron: recalculate tiers daily

- [ ] **14.4** — Vendor Staff Sub-accounts
  - Schema: `VendorStaff` model linking `User` to `VendorProfile` with permissions
  - Vendor can invite staff via email
  - Staff gets restricted vendor panel access (e.g., manage products but not payouts)
  - Use existing `UserRole.VENDOR_STAFF` enum value

- [ ] **14.5** — Enhanced Guest Checkout
  - Allow checkout without account creation
  - Collect email for order updates
  - Post-purchase: "Create account to track future orders" CTA
  - `POST /orders` accepts `guestEmail` (already in schema)
  - Guest order lookup: `GET /orders/lookup?email=&orderNumber=`

---

### PHASE 15 — Email Templates & Notifications
> **Goal:** Customizable transactional emails like CS-Cart's template system.
> **Duration:** ~2 days
> **Dependencies:** None

- [ ] **15.1** — Email template system
  ```prisma
  model EmailTemplate {
    id        String @id @default(cuid())
    key       String @unique // "order_confirmation", "shipping_update", etc.
    subject   String
    body      String // HTML with {{variable}} placeholders
    isActive  Boolean @default(true)
    updatedAt DateTime @updatedAt
  }
  ```
  - Default templates seeded: order confirmation, shipping update, return approved, password reset, welcome, abandoned cart, vendor payout
  - `packages/api/src/services/email.service.ts` → fetch template, replace variables, send
  - Admin UI: edit email templates with live preview

- [ ] **15.2** — Notification preferences
  - Schema: `NotificationPreference` — user can opt out of specific notification types
  - API: `GET /notifications/preferences`, `PUT /notifications/preferences`
  - Types: order updates, promotions, price drops, low stock (vendor)
  - Account settings page in storefront

---

### PHASE 16 — Admin Settings & Configuration
> **Goal:** CS-Cart-style admin settings panel for marketplace configuration.
> **Duration:** ~2 days
> **Dependencies:** Phase 8

- [ ] **16.1** — Settings schema + API
  ```prisma
  model Setting {
    id       String @id @default(cuid())
    key      String @unique
    value    String // JSON stringified
    group    String // "general", "checkout", "shipping", "email", "appearance"
  }
  ```
  - Settings: marketplace name, logo, default currency, tax display mode, weight unit, checkout mode (guest allowed?), vendor auto-approve, etc.
  - `GET /admin/settings` — grouped settings
  - `PUT /admin/settings` — batch update
  - Used across the app via `getSettings()` utility

- [ ] **16.2** — Admin Settings UI
  - Tabbed interface: General, Checkout, Shipping, Taxes, Emails, Appearance
  - Each tab shows relevant settings with appropriate input types
  - Save button per section

---

## Summary & Priority Matrix

| Phase | Name | Tasks | Priority | Est. Days |
|-------|------|-------|----------|-----------|
| 7 | Admin RBAC & Vendor Plans | 6 | 🔴 Critical | 3 |
| 8 | Shipping & Tax Engine | 7 | 🔴 Critical | 4 |
| 9 | Returns, Refunds & Orders | 6 | 🔴 Critical | 4 |
| 10 | Marketing & Loyalty | 5 | 🟡 High | 4 |
| 11 | CMS (Blog, Pages, Banners) | 4 | 🟡 High | 3 |
| 12 | Import/Export & Bulk Ops | 4 | 🟡 High | 3 |
| 13 | Multi-Currency & i18n | 4 | 🟡 High | 5 |
| 14 | Advanced Customer Experience | 5 | 🟢 Medium | 3 |
| 15 | Email Templates | 2 | 🟢 Medium | 2 |
| 16 | Admin Settings | 2 | 🟢 Medium | 2 |
| **Total** | | **~45** | | **~33 days** |

---

## Recommended Execution Order

```
Phase 7 (RBAC)
    ↓
Phase 8 (Shipping + Tax)  ←→  Phase 11 (CMS) [parallel]
    ↓
Phase 9 (Returns + Orders)  ←→  Phase 15 (Email Templates) [parallel]
    ↓
Phase 10 (Marketing + Loyalty)
    ↓
Phase 12 (Import/Export)  ←→  Phase 14 (Customer XP) [parallel]
    ↓
Phase 13 (Multi-Currency + i18n)
    ↓
Phase 16 (Admin Settings)
```

> [!IMPORTANT]
> This plan covers **every major CS-Cart Multi-Vendor feature**. The only feature intentionally excluded is **Multi-Storefront** (running multiple stores from one backend) as it requires a fundamental architecture change and is only in CS-Cart Ultimate edition.
