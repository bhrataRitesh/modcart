# OpenCart-Node — Comprehensive Build Plan
> An open-source, feature-complete CS-Cart alternative built in Node.js + TypeScript  
> License: MIT | Repo structure: GitHub monorepo | Target: Self-hostable multi-vendor eCommerce platform

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Database Schema](#4-database-schema)
5. [Feature Modules](#5-feature-modules)
   - 5.1 Authentication & Users
   - 5.2 Product Catalog
   - 5.3 Cart & Checkout
   - 5.4 Order Management
   - 5.5 Multi-Vendor System
   - 5.6 Commission & Payout Engine
   - 5.7 Payment Gateway Integration
   - 5.8 Shipping & Tax
   - 5.9 Promotions & Coupons
   - 5.10 Reviews & Ratings
   - 5.11 Multi-Storefront
   - 5.12 Theme Engine
   - 5.13 SEO
   - 5.14 Admin Panel
   - 5.15 Vendor Panel
   - 5.16 Analytics & Reports
   - 5.17 Notifications (Email / SMS / Push)
   - 5.18 Plugin / Add-on System
   - 5.19 REST + GraphQL API
   - 5.20 Realtime (WebSocket)
6. [API Design](#6-api-design)
7. [Development Phases](#7-development-phases)
8. [Infrastructure & DevOps](#8-infrastructure--devops)
9. [Security Requirements](#9-security-requirements)
10. [Open Source Guidelines](#10-open-source-guidelines)

---

## 1. Project Overview

OpenCart-Node is a pixel-for-pixel feature equivalent of CS-Cart Multi-Vendor, rewritten from the ground up in modern Node.js/TypeScript. It is:

- **Multi-vendor marketplace**: Multiple sellers share one storefront; admin takes configurable commissions.
- **Self-hostable**: Single `docker-compose up` gets a full dev environment running.
- **Headless-ready**: All business logic exposed via REST and GraphQL APIs; frontends are swappable.
- **Plugin-first**: Every feature is built on an internal hook/event system so third-party add-ons can extend anything without forking core.
- **Open source**: MIT license, contributions welcome, no vendor lock-in.

### Core principles for the AI building this
- TypeScript strict mode everywhere — no `any` types.
- Every service is framework-agnostic at the business logic layer (`packages/core`). Fastify is just the HTTP adapter.
- Database access only through Prisma — no raw SQL in application code except explicit `$queryRaw` for reporting queries.
- All side effects (emails, webhooks, file processing) go through BullMQ queues — never inline in request handlers.
- Feature flags via environment variables — nothing is hardcoded.

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Runtime | Node.js | v20 LTS |
| Language | TypeScript | v5.x, strict mode |
| Backend framework | Fastify | v4 with `@fastify/cors`, `@fastify/jwt`, `@fastify/multipart` |
| GraphQL | Mercurius (Fastify plugin) | Schema-first with codegen |
| ORM | Prisma | v5, PostgreSQL adapter |
| Primary database | PostgreSQL | v15 |
| Cache & sessions | Redis | v7, via `ioredis` |
| Search | Elasticsearch | v8, via `@elastic/elasticsearch` |
| Job queue | BullMQ | v4, Redis-backed |
| Realtime | Socket.io | v4, attached to Fastify server |
| Customer storefront | Next.js | v14, App Router, SSR |
| Vendor panel | React + Vite | v18, TanStack Router |
| Admin panel | React + Vite | v18, TanStack Router |
| UI components | shadcn/ui + Tailwind CSS | Shared design system |
| File storage | S3-compatible | AWS S3 or self-hosted MinIO |
| Email | Nodemailer + MJML templates | SMTP or SES |
| SMS | Twilio SDK | Optional, feature-flagged |
| Payments | Stripe Connect + PayPal Commerce | Split payouts to vendors |
| Containerisation | Docker + docker-compose | One-command local setup |
| CI/CD | GitHub Actions | Lint, test, build, deploy |
| Package manager | pnpm workspaces | Monorepo management |

---

## 3. Monorepo Structure

```
opencart-node/
├── apps/
│   ├── storefront/              # Next.js 14 customer-facing store
│   │   ├── app/                 # App Router pages
│   │   ├── components/
│   │   └── next.config.ts
│   ├── vendor-panel/            # React SPA for vendor accounts
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   └── vite.config.ts
│   └── admin-panel/             # React SPA for platform admins
│       ├── src/
│       └── vite.config.ts
│
├── packages/
│   ├── api/                     # Fastify HTTP + WebSocket server
│   │   ├── src/
│   │   │   ├── plugins/         # Fastify plugins (auth, cors, rate-limit)
│   │   │   ├── routes/          # REST route handlers
│   │   │   ├── graphql/         # Mercurius schema + resolvers
│   │   │   └── server.ts        # Entry point
│   │   └── package.json
│   │
│   ├── core/                    # Pure business logic — no HTTP, no DB
│   │   ├── src/
│   │   │   ├── catalog/         # Product, category, variant logic
│   │   │   ├── cart/            # Cart calculation, rule engine
│   │   │   ├── orders/          # Order state machine
│   │   │   ├── vendors/         # Vendor onboarding, store logic
│   │   │   ├── commissions/     # Commission calculation
│   │   │   ├── promotions/      # Coupon, discount rule engine
│   │   │   ├── shipping/        # Carrier rate calculation
│   │   │   ├── tax/             # Tax rule engine
│   │   │   └── hooks.ts         # Internal hook/event bus
│   │   └── package.json
│   │
│   ├── db/                      # Prisma schema, migrations, seed
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   └── client.ts        # Singleton Prisma client
│   │   └── package.json
│   │
│   ├── queue/                   # BullMQ job definitions and processors
│   │   ├── src/
│   │   │   ├── jobs/            # email, webhook, report, image-resize
│   │   │   └── workers/
│   │   └── package.json
│   │
│   ├── search/                  # Elasticsearch index management + query builders
│   │   └── src/
│   │       ├── indices/
│   │       └── queries/
│   │
│   ├── storage/                 # S3/MinIO upload, signed URL, image variants
│   │   └── src/
│   │
│   ├── plugin-sdk/              # Types, hooks, and utilities for plugin authors
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── hooks.ts
│   │   │   └── index.ts
│   │   └── README.md            # Plugin authoring guide
│   │
│   └── ui/                      # Shared React component library (shadcn + custom)
│       └── src/
│           ├── components/
│           └── index.ts
│
├── plugins/                     # First-party example plugins
│   ├── stripe-payments/
│   ├── paypal-payments/
│   └── google-analytics/
│
├── docker-compose.yml            # PostgreSQL, Redis, Elasticsearch, MinIO, app
├── docker-compose.prod.yml
├── .env.example
├── turbo.json                    # Turborepo pipeline config
├── pnpm-workspace.yaml
└── README.md
```

---

## 4. Database Schema

Define all models in `packages/db/prisma/schema.prisma`. Key models:

### Users & Auth
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  firstName     String
  lastName      String
  phone         String?
  role          UserRole  @default(CUSTOMER)
  status        UserStatus @default(ACTIVE)
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  addresses     Address[]
  orders        Order[]
  reviews       Review[]
  vendorProfile VendorProfile?
  oauthAccounts OAuthAccount[]
  sessions      Session[]
  wishlistItems WishlistItem[]
}

enum UserRole { CUSTOMER VENDOR VENDOR_STAFF ADMIN SUPERADMIN }
enum UserStatus { ACTIVE INACTIVE BANNED PENDING_VERIFICATION }

model OAuthAccount {
  id         String @id @default(cuid())
  provider   String
  providerId String
  userId     String
  user       User   @relation(fields: [userId], references: [id])
  @@unique([provider, providerId])
}

model Address {
  id         String  @id @default(cuid())
  userId     String
  user       User    @relation(fields: [userId], references: [id])
  label      String?
  firstName  String
  lastName   String
  company    String?
  line1      String
  line2      String?
  city       String
  state      String
  postalCode String
  country    String
  isDefault  Boolean @default(false)
}
```

### Vendors
```prisma
model VendorProfile {
  id            String       @id @default(cuid())
  userId        String       @unique
  user          User         @relation(fields: [userId], references: [id])
  storeName     String       @unique
  storeSlug     String       @unique
  description   String?
  logo          String?
  banner        String?
  status        VendorStatus @default(PENDING)
  commissionRate Decimal     @default(10.0)
  stripeAccountId String?
  paypalMerchantId String?
  createdAt     DateTime     @default(now())

  products      Product[]
  orders        VendorOrder[]
  payouts       Payout[]
  shippingMethods ShippingMethod[]
  promotions    Promotion[]
}

enum VendorStatus { PENDING ACTIVE SUSPENDED REJECTED }
```

### Products & Catalog
```prisma
model Product {
  id            String    @id @default(cuid())
  vendorId      String
  vendor        VendorProfile @relation(fields: [vendorId], references: [id])
  name          String
  slug          String    @unique
  description   String?
  shortDesc     String?
  status        ProductStatus @default(DRAFT)
  type          ProductType   @default(PHYSICAL)
  price         Decimal
  comparePrice  Decimal?
  costPrice     Decimal?
  sku           String?   @unique
  barcode       String?
  weight        Decimal?
  trackInventory Boolean  @default(true)
  stockQty      Int       @default(0)
  lowStockAlert Int       @default(5)
  seoTitle      String?
  seoDesc       String?
  publishedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  categories    ProductCategory[]
  images        ProductImage[]
  variants      ProductVariant[]
  options       ProductOption[]
  reviews       Review[]
  orderItems    OrderItem[]
  wishlistItems WishlistItem[]
  tags          ProductTag[]
  features      ProductFeature[]  // Key-value spec table like CS-Cart
}

enum ProductStatus { DRAFT ACTIVE INACTIVE ARCHIVED }
enum ProductType { PHYSICAL DIGITAL CONFIGURABLE }

model ProductVariant {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id])
  sku       String  @unique
  price     Decimal
  stockQty  Int     @default(0)
  imageId   String?
  options   VariantOptionValue[]
}

model ProductOption {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id])
  name      String  // e.g. "Color", "Size"
  type      OptionType // SELECT | RADIO | CHECKBOX | TEXT | FILE
  required  Boolean @default(false)
  values    ProductOptionValue[]
}

model Category {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  description String?
  imageUrl    String?
  parentId    String?
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  sortOrder   Int        @default(0)
  isActive    Boolean    @default(true)
  seoTitle    String?
  seoDesc     String?
}
```

### Orders
```prisma
model Order {
  id              String      @id @default(cuid())
  orderNumber     String      @unique @default(cuid())
  userId          String?
  user            User?       @relation(fields: [userId], references: [id])
  guestEmail      String?
  status          OrderStatus @default(PENDING)
  paymentStatus   PaymentStatus @default(UNPAID)
  subtotal        Decimal
  discountTotal   Decimal     @default(0)
  shippingTotal   Decimal     @default(0)
  taxTotal        Decimal     @default(0)
  total           Decimal
  currency        String      @default("USD")
  notes           String?
  ipAddress       String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  items           OrderItem[]
  vendorOrders    VendorOrder[]
  payments        Payment[]
  shipments       Shipment[]
  shippingAddress OrderAddress?
  billingAddress  OrderAddress?
  coupons         OrderCoupon[]
  statusHistory   OrderStatusHistory[]
}

enum OrderStatus { PENDING PROCESSING SHIPPED DELIVERED CANCELLED REFUNDED }
enum PaymentStatus { UNPAID PAID PARTIALLY_PAID REFUNDED PARTIALLY_REFUNDED }

model VendorOrder {
  id              String        @id @default(cuid())
  orderId         String
  order           Order         @relation(fields: [orderId], references: [id])
  vendorId        String
  vendor          VendorProfile @relation(fields: [vendorId], references: [id])
  status          OrderStatus   @default(PENDING)
  subtotal        Decimal
  commissionRate  Decimal
  commissionAmount Decimal
  vendorEarnings  Decimal
  payoutId        String?
  payout          Payout?       @relation(fields: [payoutId], references: [id])

  items           OrderItem[]
  shipments       Shipment[]
}
```

### Payments & Payouts
```prisma
model Payment {
  id              String        @id @default(cuid())
  orderId         String
  order           Order         @relation(fields: [orderId], references: [id])
  provider        String        // stripe | paypal | cod | bank_transfer
  providerTxId    String?
  amount          Decimal
  currency        String
  status          PaymentStatus
  metadata        Json?
  createdAt       DateTime      @default(now())
}

model Payout {
  id              String        @id @default(cuid())
  vendorId        String
  vendor          VendorProfile @relation(fields: [vendorId], references: [id])
  amount          Decimal
  currency        String
  status          PayoutStatus  @default(PENDING)
  provider        String
  providerTxId    String?
  processedAt     DateTime?
  createdAt       DateTime      @default(now())

  vendorOrders    VendorOrder[]
}

enum PayoutStatus { PENDING PROCESSING COMPLETED FAILED }
```

### Promotions
```prisma
model Promotion {
  id              String          @id @default(cuid())
  vendorId        String?         // null = platform-wide promotion
  vendor          VendorProfile?  @relation(fields: [vendorId], references: [id])
  name            String
  type            PromotionType   // COUPON | AUTO | FLASH_SALE
  discountType    DiscountType    // PERCENTAGE | FIXED_AMOUNT | FREE_SHIPPING | BUY_X_GET_Y
  discountValue   Decimal
  minOrderAmount  Decimal?
  maxUsesTotal    Int?
  maxUsesPerUser  Int?
  usesCount       Int             @default(0)
  startsAt        DateTime
  endsAt          DateTime?
  isActive        Boolean         @default(true)
  conditions      Json?           // JSON rules: applies_to, excludes, etc.

  coupons         Coupon[]
}

model Coupon {
  id          String    @id @default(cuid())
  promotionId String
  promotion   Promotion @relation(fields: [promotionId], references: [id])
  code        String    @unique
  usesCount   Int       @default(0)
}
```

---

## 5. Feature Modules

### 5.1 Authentication & Users

**Requirements:**
- Email + password registration with email verification flow
- OAuth2 social login: Google, Facebook, Apple (via `@fastify/oauth2`)
- JWT access tokens (15 min expiry) + refresh tokens (30 days, stored in Redis)
- Role-based access control: `CUSTOMER`, `VENDOR`, `VENDOR_STAFF`, `ADMIN`, `SUPERADMIN`
- Password reset via time-limited token (email link)
- Session management: list active sessions, revoke individual session
- Two-factor authentication (TOTP via `otplib`) — optional per user

**API endpoints to build:**
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
PATCH  /auth/me
GET    /auth/sessions
DELETE /auth/sessions/:id
POST   /auth/2fa/enable
POST   /auth/2fa/verify
GET    /auth/oauth/google
GET    /auth/oauth/google/callback
```

**Implementation notes:**
- Passwords hashed with `argon2` (not bcrypt)
- Rate limit login attempts: 5 per 15 minutes per IP
- Refresh tokens stored as `userId:tokenHash` in Redis with TTL
- All protected routes use `preHandler: [fastify.authenticate]` hook

---

### 5.2 Product Catalog

**Requirements:**
- Unlimited nested category tree (parent/child, unlimited depth)
- Products with: name, slug, description (rich text/HTML), images (multiple, reorderable), price, compare price, cost price, SKU, barcode, weight, dimensions
- Product types: Physical, Digital (downloadable files), Configurable (with variants)
- Product options: dropdown, radio, checkbox, text input, file upload — each can modify price/weight
- Product variants: auto-generated from option combinations, each with own SKU, price, stock
- Product features: key-value pairs for spec tables (e.g. "Material: Cotton", "Voltage: 220V")
- Product tags for cross-linking and filtering
- Bulk product import via CSV
- Inventory tracking with low-stock alerts
- Product status: Draft, Active, Inactive, Archived
- Related products and upsell/cross-sell associations

**Search integration (Elasticsearch):**
- Index: `products` with fields: name, description, tags, category names, vendor name, price, stockQty, rating
- Full-text search with fuzzy matching
- Faceted filtering: price range, categories, vendors, rating, in-stock only, custom feature values
- Sorting: relevance, price asc/desc, newest, bestselling, rating
- Autocomplete suggest endpoint

**API endpoints:**
```
GET    /products                    # Public list with search/filter/sort
GET    /products/:slug              # Public product detail
GET    /categories                  # Category tree
GET    /categories/:slug/products   # Products in category
POST   /vendor/products             # Create product (vendor auth)
PUT    /vendor/products/:id         # Update product
DELETE /vendor/products/:id
POST   /vendor/products/import      # Bulk CSV import
GET    /admin/products              # All products with vendor info
PATCH  /admin/products/:id/status   # Admin status override
```

---

### 5.3 Cart & Checkout

**Requirements:**
- Persistent cart: stored in Redis for guests (by session), merged with user cart on login
- Cart supports: quantity, selected options/variants, notes per item
- Real-time price calculation on every cart mutation:
  - Apply active automatic promotions
  - Calculate shipping estimates per vendor (cart may have items from multiple vendors)
  - Calculate tax per item/vendor based on rules
- Guest checkout (no account required) — email captured for order confirmation
- Multi-step checkout flow: Cart → Address → Shipping → Payment → Confirmation
- Address book: saved addresses, auto-fill from previous orders
- Order notes field

**Cart calculation engine (`packages/core/cart`):**
```typescript
// Core function signature — implement this
async function calculateCart(input: CartInput): Promise<CartCalculation> {
  // 1. Fetch products and validate stock
  // 2. Apply per-item option price modifiers
  // 3. Split items by vendor
  // 4. Apply automatic promotions (platform-wide first, then vendor)
  // 5. Calculate shipping per vendor group
  // 6. Apply coupon codes
  // 7. Calculate tax per vendor group
  // 8. Sum totals
  return calculation;
}
```

---

### 5.4 Order Management

**Requirements:**
- Order state machine with strict transitions:
  ```
  PENDING → PROCESSING → SHIPPED → DELIVERED
  PENDING → CANCELLED
  PROCESSING → CANCELLED (if no shipment yet)
  DELIVERED → REFUNDED (partial or full)
  ```
- Every status change logged to `OrderStatusHistory` with timestamp and actor
- Split orders: one customer order (`Order`) auto-splits into `VendorOrder` per vendor
- Customers can: view orders, track shipments, cancel (if PENDING), request return
- Vendors can: update their `VendorOrder` status, add tracking numbers, print packing slip
- Admin can: override any order status, issue refunds, reassign vendor
- Order confirmation email sent via BullMQ queue job on creation
- PDF invoice generation using `puppeteer` or `pdfkit`

---

### 5.5 Multi-Vendor System

**Requirements:**
- Vendor registration: application form → admin review → approval/rejection
- Each vendor gets: unique store slug (`/store/[slug]`), store page with logo/banner/description, independent product catalog
- Vendor micro-store page on storefront: shows vendor info, all their active products, vendor-specific reviews
- Vendor staff accounts: vendor can add team members with limited roles
- Vendor can set store-level shipping methods (in addition to platform defaults)
- Vendor can create their own promotions and coupons (subject to admin limits)
- Vendor dashboard: sales summary, pending orders, recent reviews, payout balance
- Admin can: approve/suspend/ban vendors, override commission rates per vendor, view all vendor activity

---

### 5.6 Commission & Payout Engine

**Requirements:**
- Commission rate configurable at: platform default → category level → vendor level (most specific wins)
- Commission calculated per `VendorOrder` at time of order creation:
  ```
  commissionAmount = vendorOrderSubtotal × commissionRate / 100
  vendorEarnings   = vendorOrderSubtotal - commissionAmount
  ```
- Payout triggers: manual (admin initiates), automatic (scheduled BullMQ job, e.g. every Friday)
- Payout minimum threshold: configurable per vendor
- Payout providers: Stripe Connect (preferred), PayPal Payouts, manual bank transfer
- Full payout history with status tracking per vendor
- Admin payout dashboard: total owed, pending payouts, payout history

---

### 5.7 Payment Gateway Integration

**Requirements:**
- **Stripe Connect** (primary):
  - Platform collects full payment, distributes to vendors via transfers
  - Vendor onboarding: `/vendor/payments/stripe/connect` redirects to Stripe OAuth
  - Webhooks: `payment_intent.succeeded`, `transfer.created`, `account.updated`
  - Support: cards, Apple Pay, Google Pay, SEPA, iDEAL (Stripe handles PMs)
- **PayPal Commerce Platform** (secondary):
  - Marketplace payouts API for vendor splits
  - Webhooks: `PAYMENT.CAPTURE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`
- **Cash on Delivery** (built-in): no integration needed, mark as paid on delivery
- **Bank Transfer**: manual, admin confirms receipt and marks order as paid
- Payment plugin interface in `plugin-sdk` so community can add more gateways

**Stripe flow:**
```
1. Customer hits /checkout/payment
2. API creates PaymentIntent with application_fee_amount (platform commission total)
3. Frontend mounts Stripe Elements / Payment Element
4. On confirm: Stripe charges customer, holds funds
5. Webhook: payment_intent.succeeded → mark order PAID → trigger vendor payouts job
```

---

### 5.8 Shipping & Tax

**Shipping requirements:**
- Shipping methods: Flat rate, Free shipping (above threshold), Weight-based, Per-item, Carrier-calculated
- Carrier integrations (via rate API calls): FedEx, UPS, USPS, DHL — abstracted behind `ShippingCarrier` interface
- Real-time rate fetching at checkout
- Vendor-specific shipping methods override platform defaults for their items
- Shipment tracking: vendors enter tracking number + carrier → tracking link shown to customer
- Multi-package shipments supported

**Tax requirements:**
- Tax classes assigned to products (Standard, Reduced, Zero-rated, Digital goods)
- Tax rules: define rates per country/state/postal code + tax class combination
- Tax calculated per line item, summed per vendor order
- Tax-inclusive vs tax-exclusive pricing modes (configured per storefront)
- Support for EU VAT, US sales tax, GST — structure is generic enough for any jurisdiction

---

### 5.9 Promotions & Coupons

**Promotion types:**
- **Automatic promotions**: applied to cart/order without a code based on conditions
- **Coupon codes**: single-use, multi-use, limited-quantity, percentage/fixed discount
- **Flash sales**: time-limited product price overrides
- **Buy X Get Y**: buy quantity X of product A, get Y of product B free/discounted

**Condition engine (`packages/core/promotions`):**
Conditions are stored as JSON and evaluated at cart calculation time:
```typescript
type PromotionCondition =
  | { type: 'MIN_ORDER_AMOUNT'; value: number }
  | { type: 'PRODUCT_IN_CART'; productIds: string[] }
  | { type: 'CATEGORY_IN_CART'; categoryIds: string[] }
  | { type: 'VENDOR_IN_CART'; vendorIds: string[] }
  | { type: 'USER_FIRST_ORDER' }
  | { type: 'USER_IN_GROUP'; groupIds: string[] }
  | { type: 'MIN_CART_QUANTITY'; value: number }
```

---

### 5.10 Reviews & Ratings

**Requirements:**
- Star rating (1–5) + written review on products
- Only users who have a `DELIVERED` order containing the product can submit a review (verified purchase badge)
- Reviews can include images (up to 3)
- Vendor can publicly reply to reviews
- Admin can: approve/reject reviews (configurable moderation setting), delete any review
- Review summary on product page: average rating, rating distribution bar chart, paginated review list
- Vendor profile page shows aggregate rating across all products

---

### 5.11 Multi-Storefront

**Requirements:**
- Multiple storefronts served from one backend instance
- Each storefront has: own domain/subdomain, own theme, own set of active vendors/products, own language default, own currency default, own SEO settings
- Products and vendors can be assigned to one or more storefronts
- Storefront resolved from request hostname in API middleware
- Admin can manage all storefronts from one admin panel

**Implementation:**
```prisma
model Storefront {
  id          String  @id @default(cuid())
  name        String
  domain      String  @unique
  isDefault   Boolean @default(false)
  themeId     String
  currency    String  @default("USD")
  locale      String  @default("en")
  isActive    Boolean @default(true)
  settings    Json    // logo, colors, footer links, etc.
}
```

---

### 5.12 Theme Engine

**Requirements:**
- Themes are Next.js-compatible React component packages
- Theme settings (colors, fonts, layout options) editable in admin UI → saved to `Storefront.settings`
- Live preview of theme changes before publishing
- Built-in themes: Default (modern minimal), Classic
- Theme API: themes export a manifest declaring customisable settings slots
- Themes installed as npm packages — no file system access required

---

### 5.13 SEO

**Requirements:**
- Auto-generated `<meta>` title and description from product/category data (overridable)
- Canonical URLs
- `sitemap.xml` dynamically generated: all active products, categories, vendor stores, blog posts
- `robots.txt` configurable from admin
- Structured data (JSON-LD): `Product`, `BreadcrumbList`, `Organization`, `Review`
- Slug customisation on all content types
- 301 redirect manager in admin (old slug → new slug)
- Hreflang tags for multi-language storefronts
- Open Graph and Twitter Card meta tags for social sharing

---

### 5.14 Admin Panel

Built as a React + Vite SPA served at `/admin`. Protected behind `ADMIN` or `SUPERADMIN` role.

**Sections:**
| Section | Features |
|---|---|
| Dashboard | Revenue chart, orders chart, top products, top vendors, recent orders |
| Orders | Full order list, filters, order detail, status change, refund, print invoice |
| Products | All products across all vendors, bulk status change, feature editor |
| Categories | Tree view, drag-to-reorder, create/edit/delete |
| Vendors | Application queue, vendor list, approve/suspend, commission override, payout initiation |
| Users | Customer list, search, view orders, ban/unban |
| Promotions | Create/edit platform-wide promotions and coupons |
| Payments | Payment log, refund initiation |
| Payouts | Payout queue, process payouts, payout history |
| Shipping | Platform shipping methods, carrier configuration |
| Tax | Tax classes, tax rules matrix |
| Storefronts | Create/edit storefronts, assign domains, theme picker |
| Themes | Theme settings editor, live preview |
| SEO | Redirect manager, sitemap config, robots.txt editor |
| Reports | Sales by period, sales by vendor, sales by category, export CSV |
| Settings | SMTP config, payment gateway keys, social OAuth keys, feature flags |
| Plugins | Installed plugins list, enable/disable, config UI rendered by plugin |

---

### 5.15 Vendor Panel

Built as a React + Vite SPA served at `/vendor`. Protected behind `VENDOR` or `VENDOR_STAFF` role.

**Sections:**
| Section | Features |
|---|---|
| Dashboard | Revenue, orders, visitors (if analytics plugin), payout balance |
| Products | Product list, create/edit product, bulk import CSV, manage inventory |
| Orders | Vendor's orders only, update status, add tracking, print packing slip |
| Reviews | All reviews on vendor's products, reply to reviews |
| Promotions | Create vendor-level coupons and promotions |
| Shipping | Vendor-specific shipping methods |
| Payouts | Payout history, bank/Stripe Connect setup |
| Store settings | Store name, logo, banner, description, slug, social links |
| Team | Invite staff accounts, set roles |
| Reports | Sales report, product performance |

---

### 5.16 Analytics & Reports

**Built-in reports (no external service needed):**
- Sales over time (daily/weekly/monthly/yearly)
- Revenue by vendor
- Revenue by category
- Best-selling products
- Customer acquisition (new vs returning)
- Abandoned carts (tracked via cart session)
- Coupon performance
- All reports exportable as CSV

**External analytics (via plugin):**
- Google Analytics 4 integration as first-party plugin
- Meta Pixel as first-party plugin

---

### 5.17 Notifications

**Email notifications (via BullMQ + Nodemailer + MJML templates):**
| Trigger | Recipients |
|---|---|
| Order placed | Customer, all relevant vendors |
| Order status changed | Customer |
| Vendor order status changed | Vendor |
| New vendor application | Admin |
| Vendor approved/rejected | Vendor |
| Low stock alert | Vendor |
| New review on product | Vendor |
| Payout processed | Vendor |
| Password reset | User |
| Email verification | User |

**SMS notifications (optional, Twilio plugin):**
- Order placed, order shipped, delivery confirmation

**In-app notifications:**
- Real-time via Socket.io
- Stored in DB, marked read/unread
- Notification bell in vendor and admin panels

---

### 5.18 Plugin / Add-on System

This is a core architectural feature. Every part of the system must be extendable without modifying core code.

**Hook system (`packages/core/hooks.ts`):**
```typescript
type HookMap = {
  // Cart hooks
  'cart.beforeCalculate': { cart: CartInput };
  'cart.afterCalculate': { cart: CartInput; result: CartCalculation };
  // Order hooks
  'order.beforeCreate': { order: CreateOrderInput };
  'order.afterCreate': { order: Order };
  'order.statusChanged': { order: Order; previousStatus: OrderStatus };
  // Product hooks
  'product.beforeSave': { product: CreateProductInput };
  'product.afterSave': { product: Product };
  // Payment hooks
  'payment.beforeCapture': { payment: PaymentInput };
  'payment.afterCapture': { payment: Payment };
  // Admin panel hooks
  'admin.nav.extend': { items: NavItem[] };
  // Vendor panel hooks
  'vendor.nav.extend': { items: NavItem[] };
}

// Usage in a plugin:
hooks.on('order.afterCreate', async ({ order }) => {
  await sendToExternalERP(order);
});
```

**Plugin manifest (`plugin.json`):**
```json
{
  "name": "my-erp-integration",
  "version": "1.0.0",
  "displayName": "My ERP Integration",
  "description": "Syncs orders to ERP system",
  "settingsSchema": {
    "apiKey": { "type": "string", "label": "API Key", "secret": true },
    "endpoint": { "type": "string", "label": "ERP Endpoint URL" }
  }
}
```

**Plugin installation:**
- Plugins are npm packages with `opencart-node-plugin` keyword
- Install: `pnpm add my-plugin` → auto-discovered at server startup
- Settings UI auto-generated in admin panel from `settingsSchema`
- Plugins can: register hooks, add API routes, add admin/vendor panel pages, define payment methods, define shipping carriers

---

### 5.19 REST + GraphQL API

**REST API:**
- Base URL: `/api/v1`
- Authentication: Bearer JWT in `Authorization` header
- All list endpoints support: `page`, `limit`, `sort`, `order`, `search` query params
- Consistent response envelope:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { "page": 1, "limit": 20, "total": 100 }
  }
  ```
- Error responses:
  ```json
  {
    "success": false,
    "error": { "code": "PRODUCT_NOT_FOUND", "message": "Product not found", "statusCode": 404 }
  }
  ```

**GraphQL API:**
- Endpoint: `/graphql`
- Schema-first with `graphql-codegen` generating TypeScript types
- Public queries: products, categories, search, storefront config
- Authenticated mutations: cart, checkout, orders, account
- Real-time subscriptions: order status updates, stock changes

**API Documentation:**
- Swagger/OpenAPI 3.0 auto-generated from Fastify route schemas, served at `/docs`
- GraphQL Playground at `/graphql` in development mode

---

### 5.20 Realtime (WebSocket)

**Socket.io namespaces:**
- `/customer` — order status updates, cart sync across tabs
- `/vendor` — new order alerts, low stock alerts, new review notifications
- `/admin` — live sales feed, new vendor application alerts

**Events:**
```typescript
// Server → Client
'order.statusUpdated'  // { orderId, status }
'order.newItem'        // Admin live feed
'notification.new'     // { notification }
'stock.low'            // { productId, stockQty }
```

---

## 6. API Design

### Route structure
```
/api/v1/
  auth/           # Auth endpoints
  products/       # Public catalog
  categories/     # Public category tree
  search/         # Elasticsearch-backed search
  cart/           # Cart management (session or user)
  checkout/       # Checkout steps
  orders/         # Customer order history
  account/        # Customer profile, addresses
  stores/         # Vendor store pages (public)
  vendor/         # All vendor panel API
  admin/          # All admin panel API (admin role required)
  webhooks/       # Stripe, PayPal incoming webhooks
```

### Middleware stack (applied globally)
1. `cors` — allow storefront, vendor panel, admin panel origins
2. `helmet` — security headers
3. `rate-limit` — per IP: 100 req/min general, 10 req/min auth endpoints
4. `request-id` — attach UUID to every request for tracing
5. `logger` — structured JSON logging via `pino`
6. `storefront-resolver` — attach current `Storefront` to request from hostname
7. `authenticate` — optional (validates JWT if present, attaches `request.user`)

---

## 7. Development Phases

### Phase 1 — Core store (Weeks 1–12)
**Goal: A working single-vendor store that can take real orders.**

- [ ] Monorepo scaffolding with pnpm + Turborepo
- [ ] Docker compose: PostgreSQL, Redis, MinIO
- [ ] Prisma schema (users, products, categories, orders, payments)
- [ ] Authentication system (email/password, JWT, refresh tokens)
- [ ] Product catalog CRUD (admin)
- [ ] Category management (admin)
- [ ] Product listing + detail pages (storefront, Next.js)
- [ ] Elasticsearch integration for product search
- [ ] Cart (Redis-backed, guest + authenticated)
- [ ] Checkout flow (address → shipping → payment)
- [ ] Stripe payment integration (single seller mode)
- [ ] Order creation and confirmation email
- [ ] Basic order management (admin)
- [ ] Customer order history page
- [ ] Image upload to MinIO
- [ ] Basic admin panel scaffolding

**Deliverable:** Deployable MVP store.

---

### Phase 2 — Multi-vendor (Weeks 13–20)
**Goal: Multiple vendors can register and sell on the platform.**

- [ ] Vendor registration + application flow
- [ ] Admin vendor approval workflow
- [ ] Vendor profile (storefront page + panel)
- [ ] Per-vendor product management
- [ ] Order splitting into VendorOrders
- [ ] Commission calculation engine
- [ ] Stripe Connect vendor onboarding
- [ ] PayPal Commerce Platform integration
- [ ] Vendor payout system
- [ ] Vendor dashboard
- [ ] Vendor-specific shipping methods
- [ ] Vendor promotions and coupons

**Deliverable:** Fully functional multi-vendor marketplace.

---

### Phase 3 — Payments, Shipping & Promotions (Weeks 21–28)
**Goal: Production-grade commerce features.**

- [ ] Full Stripe webhook handling
- [ ] Refund system (full + partial)
- [ ] Carrier rate API integrations (FedEx, UPS, USPS, DHL)
- [ ] Shipment tracking
- [ ] Tax rule engine
- [ ] EU VAT support
- [ ] Promotion condition engine
- [ ] Flash sales
- [ ] Buy X Get Y promotions
- [ ] Coupon system
- [ ] Review system with verified purchase gate
- [ ] Product Q&A
- [ ] Wishlist
- [ ] In-app notifications (Socket.io)
- [ ] SMS notifications (Twilio plugin)
- [ ] PDF invoice generation

**Deliverable:** Feature-complete for production traffic.

---

### Phase 4 — Platform Polish & Open Source (Weeks 29–40)
**Goal: Extensible, documented, community-ready.**

- [ ] Plugin SDK (`packages/plugin-sdk`)
- [ ] Hook system implementation across all modules
- [ ] Built-in plugins: Google Analytics, Meta Pixel, Mailchimp, MailerLite
- [ ] Theme engine
- [ ] Multi-storefront support
- [ ] i18n: English, Spanish, French, German, Arabic (RTL support)
- [ ] Multi-currency with live exchange rates
- [ ] GraphQL API (Mercurius)
- [ ] OpenAPI/Swagger docs
- [ ] Admin analytics dashboard
- [ ] Full report suite with CSV export
- [ ] Bulk product import (CSV)
- [ ] Performance optimisation: DB query audit, Redis caching layer
- [ ] E2E tests (Playwright) for critical checkout flows
- [ ] Unit tests for `packages/core` (Vitest, >80% coverage)
- [ ] GitHub Actions CI pipeline
- [ ] CONTRIBUTING.md, plugin authoring guide
- [ ] Demo site deployment

**Deliverable:** v1.0.0 public release on GitHub.

---

## 8. Infrastructure & DevOps

### Local development
```bash
# Clone and install
git clone https://github.com/your-org/opencart-node
cd opencart-node
pnpm install

# Start all infrastructure
docker-compose up -d

# Run DB migrations
pnpm --filter @opencart/db migrate:dev

# Seed demo data
pnpm --filter @opencart/db seed

# Start all apps in dev mode (hot reload)
pnpm dev
```

### docker-compose.yml services
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: opencart
      POSTGRES_USER: opencart
      POSTGRES_PASSWORD: opencart
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports: ["9200:9200"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
```

### Environment variables (`.env.example`)
```env
# Database
DATABASE_URL=postgresql://opencart:opencart@localhost:5432/opencart

# Redis
REDIS_URL=redis://localhost:6379

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=opencart-media
S3_REGION=us-east-1

# JWT
JWT_ACCESS_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-in-production

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CLIENT_ID=ca_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox

# Email
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@opencart-node.com

# App
NODE_ENV=development
PORT=3001
STOREFRONT_URL=http://localhost:3000
ADMIN_URL=http://localhost:3002
VENDOR_URL=http://localhost:3003
```

### Production deployment (recommended)
- **App servers**: Railway, Render, or Fly.io (Node.js containers)
- **Database**: Supabase or Neon (managed PostgreSQL)
- **Redis**: Upstash (serverless Redis)
- **Elasticsearch**: Elastic Cloud or Bonsai
- **Storage**: AWS S3 or Cloudflare R2
- **CDN**: Cloudflare for static assets and storefront

---

## 9. Security Requirements

- [ ] All inputs validated with `zod` schemas before hitting business logic
- [ ] SQL injection impossible — Prisma parameterises all queries
- [ ] XSS prevention: sanitise all HTML rich text with `DOMPurify` on server before save
- [ ] CSRF protection: SameSite cookies for session, double-submit pattern
- [ ] Rate limiting on all public-facing endpoints
- [ ] Stripe webhook signature verification (`stripe.webhooks.constructEvent`)
- [ ] PayPal webhook verification
- [ ] File upload restrictions: MIME type check, max file size (configurable), malware scan hook
- [ ] Vendor data isolation: all vendor queries scoped by `vendorId` from JWT, never from request body
- [ ] Admin routes protected by role check in Fastify preHandler
- [ ] Sensitive config (API keys) only in env vars, never in DB or committed to git
- [ ] HTTPS enforced in production (redirect HTTP → HTTPS)
- [ ] Security headers via `@fastify/helmet`
- [ ] Dependency vulnerability scanning via GitHub Dependabot
- [ ] Regular `pnpm audit` in CI pipeline

---

## 10. Open Source Guidelines

### Repository setup
- **License**: MIT (maximally permissive, encourages commercial adoption)
- **Versioning**: Semantic versioning (semver) — `MAJOR.MINOR.PATCH`
- **Changelog**: `CHANGELOG.md` maintained via `changesets`
- **Branching**: `main` (stable) + `dev` (next release) + feature branches

### Files to include
```
README.md              # Project overview, quickstart, feature list
CONTRIBUTING.md        # How to contribute, PR guidelines, code style
CODE_OF_CONDUCT.md     # Contributor Covenant
SECURITY.md            # How to report security vulnerabilities
docs/
  architecture.md      # High-level architecture decisions
  plugin-guide.md      # How to build a plugin
  api-reference.md     # REST API reference
  deployment.md        # Self-hosting guide (Docker, VPS, cloud)
  configuration.md     # All environment variables documented
```

### GitHub configuration
- Issue templates: Bug report, Feature request, Plugin submission
- PR template: checklist including tests, docs update, breaking change flag
- Branch protection on `main`: require PR review, require CI pass
- GitHub Actions workflows:
  - `ci.yml`: lint (ESLint + Prettier), typecheck, unit tests, build
  - `e2e.yml`: Playwright tests on PR to `main`
  - `release.yml`: triggered on push to `main`, runs `changesets version` + `npm publish` for packages

---

*This document is the single source of truth for the OpenCart-Node project. All implementation decisions should trace back to a requirement defined here. When in doubt, build the simpler thing first and iterate.*
