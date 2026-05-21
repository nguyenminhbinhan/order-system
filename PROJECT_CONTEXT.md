# PROJECT_CONTEXT.md — AI Handoff Document
# Restaurant QR Ordering & Management System (Quán ăn Bình An)

> **Document Purpose:** Enable any AI model (Claude/GPT/Gemini) to fully understand and continue development of this system without losing architectural context, business rules, or stabilization work already completed.
>
> **Last Updated:** 2026-05-08
> **Project Status:** Feature-complete. Production-ready for graduation demo.

---

# 1. Project Overview

## What This Project Is

A **fullstack realtime restaurant QR ordering and management system** built as a graduation-level project. Customers scan QR codes at physical restaurant tables to browse a menu, place orders, and pay — all without needing an account or login. Staff (waiters, kitchen, admin) manage orders through role-specific dashboards with live WebSocket updates.

## Core Concept

- **QR Code → Table Session → Order → Kitchen → Serve → Payment → Reset**
- Every table has a unique QR code. Scanning it opens a mobile-optimized customer menu.
- Orders flow through a realtime pipeline: Customer → Waiter confirmation → Kitchen display → Waiter marks ready/completed → Bill → Payment → Table reset.
- The payment system uses a **simulated (fake) QR payment flow** that mimics real banking apps (MoMo/VNPay) for demo purposes.

## Target Roles

| Role | Auth Required | Description |
|------|--------------|-------------|
| **Customer** | ❌ No login | Scans QR, browses menu, orders food, tracks status, requests payment |
| **Waiter/Service** | ✅ JWT | Manages tables, confirms/edits orders, generates bills, processes payments |
| **Kitchen** | ✅ JWT | **READ-ONLY** monitor. Views confirmed orders on a Kanban board. Never presses action buttons. |
| **Admin/Manager** | ✅ JWT | Full system control: menu management, user management, table CRUD, analytics, audit logs |

---

# 2. Full Tech Stack

## Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Vue 3** | ^3.5.29 | Core UI framework (Composition API + `<script setup>`) |
| **Pinia** | ^3.0.4 | State management (5 stores: user, order, cart, menu, ui) |
| **Vue Router** | ^5.0.3 | SPA routing with role-based guards |
| **Tailwind CSS** | ^3.4.19 | Utility-first styling with dark mode (`class` strategy) |
| **Vite** | ^7.3.1 | Build tool and dev server |
| **Socket.IO Client** | ^4.8.3 | Realtime WebSocket communication |
| **Axios** | ^1.13.6 | HTTP client with interceptor-based token refresh |
| **Chart.js + vue-chartjs** | ^4.5.1 / ^5.3.3 | Admin dashboard analytics charts |
| **qrcode + qrcode.vue** | ^1.5.4 / ^3.8.0 | QR code generation for payment and table links |
| **SweetAlert2** | ^11.26.24 | Confirmation dialogs |
| **vue3-toastify** | ^0.2.9 | Toast notifications |
| **html2pdf.js** | ^0.14.0 | Bill PDF generation |
| **vite-plugin-pwa** | ^1.2.0 | Progressive Web App support |
| **Playwright** | ^1.58.2 | E2E testing (dev dependency) |

## Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **NestJS** | ^11.1.16 | Server framework (modules, controllers, services, guards) |
| **Prisma** | ^5.22.0 | ORM for MySQL with typed schema |
| **MySQL** | — | Primary database |
| **Socket.IO (server)** | ^11.1.17 | WebSocket gateway (`@nestjs/platform-socket.io`) |
| **JWT** | ^11.0.2 | Authentication (`@nestjs/jwt` + `passport-jwt`) |
| **bcrypt** | ^6.0.0 | Password hashing |
| **Redis (ioredis)** | ^5.10.0 | Cache layer (`cache-manager-redis-store`) |
| **Multer** | ^2.1.1 | Image upload handling |
| **class-validator** | ^0.14.4 | DTO validation |
| **uuid** | ^13.0.0 | UUID generation for entities |

## Infrastructure

- **CORS:** Configured via `CORS_ORIGIN` env var (defaults to `*`)
- **Static Files:** `uploads/` directory served at `/uploads` prefix
- **Validation:** Global `ValidationPipe` with `whitelist: true` and implicit conversion
- **Error Handling:** `GlobalExceptionFilter` + `LoggingInterceptor`

---

# 3. Folder Structure

## Backend (`backend/src/`)

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema (11 models, 8 enums)
│   └── seed.ts                # Database seeder
├── src/
│   ├── main.ts                # Bootstrap: CORS, pipes, filters, static assets
│   ├── app.module.ts          # Root module importing all feature modules
│   ├── auth/
│   │   ├── auth.controller.ts # POST /auth/login, /auth/register, /auth/refresh, GET /auth/profile
│   │   ├── auth.service.ts    # Login, register, refresh, getProfile
│   │   ├── auth.module.ts     # JWT module config
│   │   ├── constants.ts       # JWT secret, accessTokenExpiry: '8h', refreshTokenExpiry: '7d'
│   │   ├── jwt.strategy.ts    # Passport JWT strategy
│   │   ├── jwt-auth.guard.ts  # AuthGuard('jwt')
│   │   ├── guards/
│   │   │   └── roles.guard.ts # Role-based access control
│   │   └── decorators/
│   │       └── roles.decorator.ts
│   ├── orders/
│   │   ├── orders.controller.ts  # CRUD + confirm + confirmWithEdits
│   │   └── orders.service.ts     # Order creation with idempotency, status transitions, socket emissions
│   ├── tables/
│   │   ├── tables.controller.ts  # CRUD + call-waiter + request-payment + preview-bill + checkout + create-payment + reset
│   │   └── tables.service.ts     # Table lifecycle, session management, bill preview, checkout, QR payment creation
│   ├── payments/
│   │   ├── payments.controller.ts # CRUD + GET :id/info (public) + POST :id/confirm (public)
│   │   └── payments.service.ts    # Fake QR payment: createForSession, getPaymentInfo, confirmPayment
│   ├── socket/
│   │   ├── order.gateway.ts   # WebSocket gateway: rooms (kitchen, service, order_*), event emissions
│   │   └── socket.module.ts
│   ├── admin/
│   │   ├── admin.controller.ts # GET /admin/dashboard, /admin/analytics, /admin/revenue, /admin/bills, /admin/audit
│   │   └── admin.service.ts    # Dashboard analytics, revenue charts, bill history, audit logs, DB cleanup
│   ├── users/                  # User CRUD, password validation
│   ├── categories/             # Menu category CRUD
│   ├── menu-items/             # Menu item CRUD with image upload
│   ├── messages/               # Table chat messages (customer↔waiter)
│   ├── cache/                  # Redis cache module
│   ├── prisma/                 # PrismaService singleton
│   ├── common/
│   │   ├── filters/global-exception.filter.ts
│   │   └── interceptors/logging.interceptor.ts
│   ├── image-items/            # Image management
│   └── option-items/           # Menu item options
```

## Frontend (`frontend/src/`)

```
frontend/src/
├── main.js                    # App bootstrap: Pinia, Router, Toastify
├── App.vue                    # Root component with viewport simulation wrapper + settings panel
├── router/
│   └── index.ts               # All routes with meta.requiresAuth and meta.roles guards
├── stores/
│   ├── user.store.ts          # Auth state: login, logout, initSession, fetchProfile
│   ├── order.store.ts         # Order state: placeOrder, table session tracking, socket listeners
│   ├── cart.store.ts          # Cart state: addItem (dedup by product+note), removeItem, clearCart
│   ├── menu.store.ts          # Menu items + categories fetching
│   └── ui.store.ts            # Theme (light/dark/system) + viewport simulation (desktop/tablet/mobile)
├── services/
│   ├── api.ts                 # Axios instance with 401 interceptor → auto token refresh + queue
│   ├── socket.ts              # SocketService singleton: connect, rooms, deduplicated listeners
│   ├── auth.service.ts        # Auth API calls
│   └── order.service.ts       # Order API calls
├── views/
│   ├── LoginView.vue          # Staff login (email/password)
│   ├── customer/
│   │   ├── CustomerView.vue   # Menu browsing, search, category filter, add to cart
│   │   ├── CartView.vue       # Cart + order tracking + call waiter + request payment
│   │   ├── PaymentView.vue    # Public payment page (accessed via QR scan)
│   │   └── OrderTrackingView.vue
│   ├── service/
│   │   └── ServiceTablesView.vue  # Waiter dashboard: table grid, order modal, bill preview, QR payment, staff ordering
│   ├── kitchen/
│   │   └── KitchenKanbanView.vue  # READ-ONLY Kanban board for kitchen staff
│   └── admin/
│       ├── AdminDashboardView.vue # Analytics: revenue, charts, top items
│       ├── AdminView.vue          # Menu management (CRUD)
│       ├── AdminUsersView.vue     # User management
│       ├── AdminTablesView.vue    # Table management
│       ├── AdminBillsView.vue     # Bill history
│       ├── AdminAuditView.vue     # Audit log viewer
│       └── TableQRView.vue        # QR code generator for tables
├── components/
│   ├── customer/
│   │   ├── FoodCard.vue       # Menu item card (4:3 aspect ratio, touch-optimized)
│   │   ├── CategoryFilter.vue # Scrollable category pills
│   │   └── CartItem.vue       # Cart item with quantity controls
│   ├── service/
│   │   ├── PrintBill.vue      # Bill receipt component (80mm thermal format)
│   │   └── ChatModal.vue      # Customer↔waiter live chat
│   └── SettingsPanel.vue      # Theme + viewport toggle UI
├── assets/
│   └── main.css               # Global CSS: animations, scrollbar, safe-area, touch optimization
├── utils/
│   └── constants.ts           # API_BASE_URL from VITE_API_URL env
└── types/                     # TypeScript interfaces
```

---

# 4. Role-Based Architecture

## Customer (No Authentication)

- Scans QR code → opens `/customer?tableId={id}`
- Browses menu with search and category filter
- Adds items to cart with optional notes
- Places order → order status = `pending_confirmation`
- Tracks order status in real-time via socket events
- Calls waiter (creates system message + socket notification)
- Requests payment (updates table status to `needs_payment`)
- Views payment page (public `/payment/:paymentId`) → confirms payment
- Sees thank-you screen after payment
- Order history stored in `localStorage` for persistence

## Waiter / Service Staff (JWT Required, role: `service`)

- Views all tables in a grid with color-coded status
- Receives real-time notifications for: new orders, call waiter, payment requests
- Opens table modal to see all orders for that table
- **Confirms orders** (status: `pending_confirmation` → `confirmed`)
- **Edits orders** before confirmation (adjust quantities, notes)
- **Marks orders ready** (status: `confirmed` → `ready`)
- **Marks orders completed** (status: `ready` → `completed`)
- Opens bill preview → generates QR payment → customer scans and pays
- Can also process **cash payment** (direct checkout)
- Can **force reset** a table (emergency cleanup)
- Can **add more orders** to an active table (staff ordering modal)
- Has live chat with customers per table

## Kitchen (JWT Required, role: `kitchen`)

> **CRITICAL RULE: Kitchen is READ-ONLY. Kitchen staff NEVER press action buttons.**

- Views a Kanban board showing only `confirmed` orders
- Orders appear automatically via `orderConfirmed` socket event
- Orders disappear when waiter marks them as `ready` or `completed`
- Kitchen monitors what needs to be cooked — waiter handles all state transitions

## Admin / Manager (JWT Required, role: `admin` or `manager`)

- Full access to all admin dashboards
- **Dashboard:** Revenue analytics, top items, charts (7-day revenue, hourly breakdown)
- **Menu Management:** CRUD menu items with image upload, category assignment, availability toggle
- **User Management:** Create/edit/deactivate staff accounts (service, kitchen, admin roles)
- **Table Management:** Create/delete/restore tables, generate QR codes
- **Bill History:** View all completed sessions with itemized receipts
- **Audit Logs:** Paginated log of all system actions (CREATE_ORDER, CONFIRM_ORDER, CHECKOUT, etc.)
- **QR Generator:** Generate and print QR codes for all tables
- **Database Cleanup:** Close orphaned sessions, force-clean broken state

---

# 5. Complete Business Flow

## Full Lifecycle (Step-by-Step)

```
1. QR SCAN
   Customer scans QR code on physical table
   → Browser opens: /customer?tableId={id}

2. SESSION CREATION
   Frontend calls POST /tables/{id}/session
   → Backend checks for active session
   → If none exists AND no recent cooldown → creates new TableSession
   → If session recently ended (< 30 seconds) → returns { sessionEnded: true }
   → Returns session token stored in localStorage

3. MENU BROWSING
   Frontend fetches GET /menu-items (public, no auth)
   Customer browses, searches, filters by category
   Adds items to cart (Pinia cart.store, client-side only)

4. ORDER PLACEMENT
   Customer clicks "Gửi món" (Send order)
   Frontend calls POST /orders with { tableId, items: [{ menuItemId, quantity, note }] }
   → Backend validates items against DB
   → Calculates total SERVER-SIDE (never trusts frontend total)
   → Idempotency check: rejects if order placed < 5 seconds ago for same table
   → Creates Order (status: pending_confirmation) + OrderItems in transaction
   → Updates Table status to waiting_confirmation
   → Emits socket: newOrderCreated → service room
   → Emits socket: tableUpdated → service room
   → Emits socket: dashboardUpdated → global
   → Creates AuditLog entry

5. WAITER CONFIRMATION
   Waiter sees new order notification (yellow badge on table card)
   Opens table modal → sees order items
   Option A: Confirm as-is → POST /orders/{id}/confirm
   Option B: Edit quantities/notes then confirm → POST /orders/{id}/confirm-with-edits
   → Order status: pending_confirmation → confirmed
   → Table status: waiting_confirmation → occupied
   → Emits socket: orderConfirmed → kitchen room
   → Emits socket: orderUpdated → global
   → Emits socket: tableUpdated → service room

6. KITCHEN MONITORING (READ-ONLY)
   Kitchen Kanban board receives orderConfirmed event
   Displays order card with items, quantities, notes
   Kitchen staff physically prepares the food
   Kitchen does NOT press any buttons — waiter handles next step

7. WAITER MARKS READY
   Waiter clicks "Xác nhận đã nấu" on order card
   → PATCH /orders/{id} with { status: 'ready' }
   → Table status → needs_payment
   → Emits socket: orderUpdated → global

8. WAITER MARKS COMPLETED
   Waiter clicks "Hoàn tất" on order card
   → PATCH /orders/{id} with { status: 'completed' }
   → Emits socket: orderUpdated → global

9. BILL GENERATION
   Waiter clicks "Xem tạm tính / Checkout" on table modal
   → GET /tables/{id}/preview-bill (auth required: service/admin/manager)
   → Returns aggregated items, subtotal, total (NO TAX)
   → Bill preview modal renders with PrintBill component

10. QR PAYMENT CREATION
    Waiter clicks "Tạo QR" on bill preview
    → POST /tables/{id}/create-payment (auth required)
    → Creates Payment record (status: pending, method: bank)
    → Returns paymentId
    → Frontend generates QR code containing URL: /payment/{paymentId}
    → Bill displays QR code for customer to scan

11. CUSTOMER PAYMENT (Public, No Auth)
    Customer scans QR on bill with their phone
    → Browser opens /payment/{paymentId}
    → Frontend calls GET /payments/{paymentId}/info (public endpoint)
    → Displays: restaurant info, table number, items, total amount
    → Customer clicks "XÁC NHẬN THANH TOÁN"
    → Frontend calls POST /payments/{paymentId}/confirm (public endpoint)

12. PAYMENT CONFIRMATION (Backend Transaction)
    → Validates payment exists and is pending
    → DUPLICATE GUARD: If already paid, returns { alreadyPaid: true }
    → In a single Prisma $transaction:
      a. Payment status → paid, sets paidAt
      b. All session orders → completed
      c. TableSession → endedAt + paidAt + totalAmount
      d. Table → status: empty
      e. Messages → deleted for table
      f. AuditLog → QR_PAYMENT_CONFIRMED
    → Emits socket via emitPaymentCompleted():
      - paymentCompleted → global (customer devices)
      - tableUpdated → service room (waiter refreshes)
      - dashboardUpdated → global (admin analytics)

13. CASH PAYMENT (Alternative)
    Waiter clicks "Thu tiền mặt (Cash)" on bill preview
    → POST /tables/{id}/checkout (auth required)
    → Same transaction as above but without Payment record
    → Table resets, session closes, all orders completed

14. POST-PAYMENT
    Customer sees success screen: "Thanh toán thành công!"
    Order history saved to localStorage
    Table is now status: empty and ready for next customer

15. SESSION COOLDOWN
    After payment, a 30-second cooldown prevents auto-creation of new session
    If customer's browser still has /customer?tableId={id} open,
    the session check returns { sessionEnded: true }
    This prevents zombie sessions from post-payment page reloads
```

## Order Status State Machine

```
pending_confirmation → confirmed → ready → completed
                    ↘ cancelled (at any point before completed)
```

## Table Computed States (Derived from orders)

```
available        = no active session
waiting_confirm  = has pending_confirmation orders
occupied         = has confirmed/preparing orders
serving          = all orders are ready/completed
paying           = table status is needs_payment (set by requestPayment or bill preview)
```

---

# 6. Realtime Architecture

## Socket.IO Configuration

- **Namespace:** `/orders`
- **Transport:** WebSocket only (no polling fallback)
- **Reconnection:** Infinite attempts, 1-5s delay range
- **Auth:** Token sent via `auth` callback on every connect/reconnect
- **Server file:** `backend/src/socket/order.gateway.ts`
- **Client file:** `frontend/src/services/socket.ts`

## Socket Rooms

| Room | Members | Purpose |
|------|---------|---------|
| `kitchen` | Kitchen staff | Receives `orderConfirmed` events |
| `service` | Waiters | Receives `newOrderCreated`, `tableUpdated`, `tableNotification` |
| `order_{orderId}` | Customer tracking specific order | Receives order-level updates |
| *(global/broadcast)* | Everyone | `orderUpdated`, `dashboardUpdated`, `paymentCompleted` |

## Socket Events

### Server → Client

| Event | Target | Payload | Trigger |
|-------|--------|---------|---------|
| `newOrderCreated` | service room | Full order object | Customer places order |
| `orderConfirmed` | kitchen room | Full order object | Waiter confirms order |
| `orderUpdated` | global | Full order object | Any order status change |
| `tableUpdated` | service room | tableId (number) | Any table state change |
| `dashboardUpdated` | global | {} or order object | Any business event |
| `paymentCompleted` | global | { tableId, paymentId? } | Payment confirmed |
| `tableNotification` | service room | { tableId, type, message } | Call waiter / request payment |
| `newMessage` | service + table room | Message object | Chat message sent |

### Client → Server

| Event | Purpose |
|-------|---------|
| `joinKitchen` | Join kitchen room |
| `joinService` | Join service room |
| `joinCustomer` | Join order-specific room |
| `leaveKitchen` / `leaveService` / `leaveCustomer` | Leave rooms |

## Deduplication Architecture (CRITICAL)

The `SocketService` class enforces **off-before-on** pattern for ALL event registrations:

```typescript
// EVERY listener registration first removes existing listener
onNewOrderCreated(callback) {
  if (this.socket) {
    this.socket.off('newOrderCreated');  // Remove existing
    this.socket.on('newOrderCreated', callback);  // Add new
  }
}
```

**Why this matters:** Without this, Vue component remounts (hot reload, navigation, tab switches) would stack duplicate listeners, causing events to fire multiple times per update.

## Reconnect Behavior

1. Socket detects disconnect (network drop)
2. Shows toast: "🔴 Realtime connection lost. Reconnecting..."
3. Auto-reconnects with exponential backoff (1-5s)
4. On reconnect, auto-rejoins previous room based on `currentRole` tracking
5. Shows toast: "🟢 Connected to realtime server"

## Listener Cleanup Strategy

- Views use `onUnmounted()` to call specific `off*()` methods
- Views should NEVER call `socketService.disconnect()` — that kills the entire socket
- Only `userStore.logout()` calls `socketService.disconnect()`
- `removeAllAppListeners()` removes all app-level listeners without destroying socket

---

# 7. Authentication Architecture

## JWT Lifecycle

| Token | Expiry | Storage | Purpose |
|-------|--------|---------|---------|
| Access Token | **8 hours** | `localStorage('token')` | API authorization (Bearer header) |
| Refresh Token | **7 days** | `localStorage('refreshToken')` | Silent token renewal |

### Why 8 hours (not 15 minutes)

The access token was changed from 15m to 8h because:
- Restaurant staff work 8-12 hour shifts
- Frequent token expiry caused "Access Denied" loops during active service
- The waiter's session would break mid-rush, requiring re-login
- 8h covers a full shift without interruption
- Refresh token (7d) handles cross-day persistence

## Token Refresh Flow (Axios Interceptor)

```
1. API call returns 401
2. Check: is this a refresh or login request? → if yes, skip
3. Check: do we have a refresh token? → if no, redirect to /login
4. Check: refresh attempts < 2? → if no, redirect to /login
5. If already refreshing → queue this request
6. Call POST /auth/refresh with refreshToken
7. On success:
   - Store new access_token + refresh_token
   - Process queued requests with new token
   - Retry original request
8. On failure:
   - Clear auth state
   - Redirect to /login
```

## Session Persistence (Page Reload)

1. Router guard checks `userStore.isAuthenticated` (token exists in localStorage)
2. If authenticated but `user` is null → calls `userStore.initSession()`
3. `initSession()` first loads cached user from localStorage (instant, no network)
4. Then validates with server via `GET /auth/profile` (background)
5. Ensures socket is connected after rehydration

## Role Guards

- **Backend:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('admin', 'service', etc.)`
- **Frontend:** `router.beforeEach` checks `meta.requiresAuth` and `meta.roles`
- Mismatched roles redirect to the correct dashboard (not login)

---

# 8. Payment Architecture (Fake QR Payment)

## Why Fake Payment

This is a graduation project. Real payment gateway integration (MoMo, VNPay, ZaloPay) requires:
- Business registration
- API keys and merchant accounts
- Compliance requirements
- Webhook infrastructure

Instead, the system implements a **simulated QR payment flow** that looks and behaves exactly like a real one, but the "bank transfer" is simulated by the customer pressing a confirm button.

## Complete QR Payment Flow

```
WAITER SIDE (Authenticated):
1. Opens table modal → clicks "Xem tạm tính / Checkout"
2. GET /tables/{id}/preview-bill → returns aggregated bill
3. Bill preview modal opens with PrintBill component
4. Clicks "Tạo QR" → POST /tables/{id}/create-payment
5. Backend creates Payment record (status: pending)
6. Returns paymentId
7. Frontend generates QR code: URL = {FRONTEND_URL}/payment/{paymentId}
8. QR displayed on bill for customer to scan

CUSTOMER SIDE (Public, No Auth):
9.  Customer scans QR with phone camera
10. Phone browser opens /payment/{paymentId}
11. PaymentView.vue mounts → GET /payments/{paymentId}/info
12. Displays: restaurant name, address, phone, table number, all items, total
13. Customer reviews and clicks "XÁC NHẬN THANH TOÁN"
14. POST /payments/{paymentId}/confirm
15. Backend executes full checkout transaction (see Section 5, Step 12)
16. Socket emits paymentCompleted to all parties
17. Customer sees "Thanh toán thành công!" screen
18. Waiter's table card updates to "available" in real-time
19. Admin dashboard revenue updates in real-time
```

## Public Endpoints (No Auth)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /payments/:id/info` | GET | Customer views payment details |
| `POST /payments/:id/confirm` | POST | Customer confirms payment |
| `POST /tables/:id/session` | POST | Create/get session token |
| `GET /tables/:id/orders` | GET | Get active orders for table |
| `POST /tables/:id/call-waiter` | POST | Customer calls waiter |
| `POST /tables/:id/request-payment` | POST | Customer requests payment |
| `GET /tables` | GET | List all tables |
| `GET /menu-items` | GET | List all menu items |

## Duplicate Payment Protection

```typescript
// In confirmPayment():
if (payment.status === 'paid') {
  return { success: true, alreadyPaid: true, ... };
  // Does NOT re-process. Returns success without side effects.
}
```

## Existing Payment Dedup

```typescript
// In createForSession() / createPaymentForTable():
const existingPayment = await prisma.payment.findFirst({
  where: { order: { sessionId: session.id }, status: 'pending' }
});
if (existingPayment) {
  return { paymentId: existingPayment.id, ... , existing: true };
}
```

---

# 9. Database & Entities

## Prisma Schema (MySQL)

### Enums

```prisma
enum UserRole     { customer, service, kitchen, manager, admin }
enum UserStatus   { active, inactive, suspended, deleted }
enum TableStatus  { empty, waiting_confirmation, occupied, needs_payment }
enum OrderStatus  { pending_confirmation, pending, confirmed, preparing, ready, delivered, completed, cancelled }
enum OrderItemStatus { pending, preparing, done, cancelled }
enum PaymentMethod   { cash, bank, momo, vnpay }
enum PaymentStatus   { pending, paid, failed }
enum MessageSender   { customer, service, system }
```

### Entity Relationships

```
User ──┬── MenuItem (creator)
       └── AuditLog

Table ──┬── Order
        ├── Message
        └── TableSession ── Order

Category ── MenuItem ──┬── OrderItem
                       ├── ImageItem
                       └── OptionItem

Order ──┬── OrderItem
        └── Payment
```

### Key Models

| Model | PK | Key Fields | Notes |
|-------|----|-----------|-------|
| `User` | UUID | email (unique), role, password (bcrypt), status, isDeleted | Soft delete |
| `Table` | Auto-increment Int | name ("Table 1"), qrCode, status, isDeleted | Soft delete |
| `TableSession` | UUID | tableId, startedAt, endedAt (null=active), totalAmount, paidAt | Represents one customer visit |
| `Order` | UUID | tableId, sessionId, status, totalAmount, createdAt | Linked to session |
| `OrderItem` | UUID | orderId, menuItemId, name (snapshot), price (snapshot), quantity, note | Price snapshotted at order time |
| `MenuItem` | UUID | name, price (Decimal 10,0), available, categoryId, imageFilename | VND currency, no decimals |
| `Payment` | UUID | orderId, method, amount, status, paidAt | Linked to first order in session |
| `Message` | UUID | tableId, sender (customer/service/system), content | Chat + system notifications |
| `AuditLog` | UUID | userId (nullable), action, tableId, metadata (JSON) | Full audit trail |

### Important Design Decisions

- **Price is `Decimal(10,0)`** — Vietnamese Dong has no decimals
- **OrderItem snapshots name and price** — Menu price changes don't affect historical orders
- **Payment links to first order** in session but represents the entire session's total
- **Soft delete** on User, Table, MenuItem — preserves order history
- **TableSession.endedAt = null** means session is active

---

# 10. Current UI/UX Design System

## Theme Architecture

- **Three modes:** `light`, `dark`, `system` (follows OS preference)
- **Storage:** `localStorage('binh_an_theme')`
- **Implementation:** Tailwind CSS `class` strategy — `dark` class toggled on `<html>`
- **Smooth transitions:** `html.theme-transitioning` class enables 300ms transitions
- **System listener:** `matchMedia('prefers-color-scheme: dark')` updates in real-time
- **Store:** `ui.store.ts` manages theme state, viewport simulation, and settings panel

## Viewport Simulation

- **Three modes:** `desktop` (100%), `tablet` (820px), `mobile` (430px)
- **Purpose:** Presentation/responsive preview for graduation demo
- **Implementation:** `App.vue` wraps `<router-view>` in a constrained container with device frame aesthetics (box-shadow, rounded corners)
- **Does NOT affect business logic** — purely visual containment

## Responsive Architecture (Mobile-First)

- **Breakpoints:** Tailwind defaults (`sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`)
- **Touch targets:** All buttons ≥ 44px (`min-h-[44px]`), primary CTAs ≥ 52-56px
- **Touch feedback:** `active:scale-[0.97]` on cards, `active:scale-90` on small buttons
- **iOS safe area:** `env(safe-area-inset-bottom)` on bottom navigation bars
- **Admin sidebar:** `hidden lg:flex` — replaced with mobile bottom navigation on small screens
- **Service modals:** Bottom-sheet pattern on mobile (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`)
- **Customer menu:** 2-column grid, max-width `512px` (max-w-lg), compact header on mobile
- **Food cards:** 4:3 aspect ratio, lazy loading, touch-optimized add button (40x40)

## Animations

- **Fade-in:** `animate-fade-in` (0.2s)
- **Slide-up:** `animate-slide-up` (0.3s, cubic-bezier)
- **Scale-in:** `animate-scale-in` (0.2s)
- **Skeleton loading:** Shimmer gradient animation for loading states
- **Theme transitions:** 300ms for background/color when switching themes

## Kitchen Layout

- Fixed-screen operational Kanban board
- NOT responsive — designed for wall-mounted monitors
- Cards auto-appear via socket events
- No user interaction required (read-only)

---

# 11. Major Bugs Already Fixed

## 1. Socket Listener Stacking (CRITICAL)

**Root cause:** Vue component remounts (navigation, hot-reload) called `socket.on()` without removing previous listeners, causing events to fire N times where N = number of remounts.

**Fix:** Implemented `off-before-on` pattern in `SocketService`. Every `on*()` method first calls `socket.off(event)` before registering the new listener.

**File:** `frontend/src/services/socket.ts`

## 2. Phantom Tax / Service Fee

**Root cause:** Early implementations added 5-10% tax/service fee in bill calculations. This contradicted the business requirement of NO TAX.

**Fix:** Removed ALL tax calculations from:
- `tables.service.ts` → `checkout()` and `getPreviewBill()`
- `payments.service.ts` → `createForSession()` and `confirmPayment()`
- Frontend bill display components

**Rule:** `total = subtotal` everywhere. No tax, no service fee.

## 3. Auth Redirect Loops (401 Infinite Refresh)

**Root cause:** Token refresh failures triggered new 401 errors, creating infinite loops. Also, 403 (role mismatch) was incorrectly treated as token expiry.

**Fix:**
- Added `MAX_REFRESH_ATTEMPTS = 2` counter in Axios interceptor
- Separated 401 (token expired → refresh) from 403 (role mismatch → toast only, no logout)
- Added guard to skip refresh for `/auth/refresh` and `/auth/login` URLs

**File:** `frontend/src/services/api.ts`

## 4. Session Zombie Resurrection

**Root cause:** After payment completes, the customer's browser still has `/customer?tableId={id}` open. On page reload, `POST /tables/{id}/session` would create a NEW session for the now-empty table.

**Fix:** Added 30-second cooldown in `getOrCreateSessionToken()`. If a session ended < 30 seconds ago, returns `{ token: null, sessionEnded: true }` instead of creating a new session.

**File:** `backend/src/tables/tables.service.ts` (lines 216-248)

## 5. Duplicate Order Insertion (Double-Click)

**Root cause:** Rapid clicks on "Gửi món" button sent multiple POST requests before the first response arrived.

**Fix:** Backend idempotency check — rejects orders if another order was created for the same table within the last 5 seconds.

**File:** `backend/src/orders/orders.service.ts` (lines 28-40)

## 6. Hardcoded localhost URLs

**Root cause:** Socket URL and API base URL were hardcoded to `http://localhost:3000`.

**Fix:** All URLs now read from environment variables:
- `VITE_API_URL` for frontend API and socket connections
- `CORS_ORIGIN` for backend CORS configuration
- `FRONTEND_URL` for QR code URL generation

## 7. requestPayment Guard Issue

**Root cause:** `requestPayment()` used `findOne()` to get table status, but `findOne()` strips the `status` field via destructuring (`const { status, sessions, ...publishableTable } = t`).

**Fix:** Changed to use `prisma.table.findUnique()` directly (raw query) to get the actual `status` field for the guard check.

**File:** `backend/src/tables/tables.service.ts` (lines 363-401)

## 8. Socket Reconnect Token Staleness

**Root cause:** After token refresh, the socket remained connected with the old (expired) token. All subsequent socket operations silently failed.

**Fix:** `userStore.login()` calls `socketService.reconnectWithNewToken()` which disconnects and reconnects — the `auth` callback always reads fresh token from `localStorage`.

## 9. Auto-Confirm Stuck Orders

**Root cause:** If a waiter fails to confirm an order within 5 minutes, the table stays in `waiting_confirmation` state indefinitely.

**Fix:** Background job (`autoConfirmPendingJob`) runs every 60 seconds and auto-confirms orders pending > 5 minutes.

**File:** `backend/src/tables/tables.service.ts` (lines 17-37)

## 10. Empty Session Cleanup

**Root cause:** Sessions created by QR scan but abandoned (no orders placed) would stay open indefinitely, blocking table status.

**Fix:** Background job (`expireSessionsJob`) runs every 60 seconds and closes sessions open > 5 minutes with zero orders.

---

# 12. Important Business Rules

> **These rules are NON-NEGOTIABLE. Any future AI agent MUST preserve them.**

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **NO TAX, NO SERVICE FEE** | `total = subtotal` everywhere. Price on menu = price on bill. |
| 2 | **Kitchen is READ-ONLY** | Kitchen view has NO action buttons. Waiter handles all state changes. |
| 3 | **Waiter confirms all food states** | Only waiter can: confirm order, mark ready, mark completed, process payment. |
| 4 | **Customer sees payment/call waiter ONLY after ordering** | CartView shows these actions only when `activeOrderId` exists. |
| 5 | **Fake payment only** | No real payment gateway. QR points to frontend payment page. |
| 6 | **Session cooldown = 30 seconds** | After payment, new session creation is blocked for 30 seconds. |
| 7 | **Server-side price calculation** | Backend recalculates total from DB prices. Frontend total is ignored. |
| 8 | **Socket deduplication** | Every `on()` call MUST call `off()` first. No exceptions. |
| 9 | **Soft delete for tables/users/menu items** | `isDeleted = true` — never hard delete entities with history. |
| 10 | **Order idempotency** | Reject duplicate orders within 5-second window per table. |
| 11 | **Vietnamese Dong (VND)** | All prices in VND, Decimal(10,0), no decimal places. |
| 12 | **Payment links to first order** | Payment record connects to first order in session; amount = session total. |
| 13 | **Duplicate payment returns success** | If payment already paid, return `{ alreadyPaid: true }` — don't re-process. |
| 14 | **Table QR code format** | `{FRONTEND_URL}/customer?tableId={id}` |

---

# 13. API Endpoints

## Auth (`/auth`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/login` | ❌ | Login with email/password → returns access_token + refresh_token |
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/refresh` | ❌ | Exchange refresh_token for new token pair |
| GET | `/auth/profile` | ✅ JWT | Get current user profile (fresh from DB) |

## Tables (`/tables`)

| Method | Endpoint | Auth | Roles | Purpose |
|--------|----------|------|-------|---------|
| GET | `/tables` | ❌ | — | List all tables with computed states |
| GET | `/tables/:id` | ❌ | — | Get single table details |
| POST | `/tables` | ✅ | admin, manager | Create new table |
| PUT | `/tables/:id` | ✅ | admin, manager | Update table |
| DELETE | `/tables/:id` | ✅ | admin, manager | Soft delete table |
| PATCH | `/tables/:id/restore` | ✅ | admin, manager | Restore deleted table |
| POST | `/tables/:id/session` | ❌ | — | Get/create session token |
| GET | `/tables/:id/orders` | ❌ | — | Get active orders for table |
| POST | `/tables/:id/call-waiter` | ❌ | — | Customer calls waiter |
| POST | `/tables/:id/request-payment` | ❌ | — | Customer requests payment |
| GET | `/tables/:id/preview-bill` | ✅ | admin, manager, service | Get bill preview |
| POST | `/tables/:id/create-payment` | ✅ | admin, manager, service | Create QR payment |
| POST | `/tables/:id/checkout` | ✅ | admin, manager, service | Cash checkout |
| POST | `/tables/:id/reset` | ✅ | admin, manager, service | Force reset table |

## Orders (`/orders`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/orders` | ❌ | Create order (customer) |
| GET | `/orders` | ❌ | List all orders |
| GET | `/orders/:id` | ❌ | Get single order |
| PATCH | `/orders/:id` | ❌ | Update order (status change) |
| POST | `/orders/:id/confirm` | ❌ | Confirm pending order (waiter) |
| POST | `/orders/:id/confirm-with-edits` | ❌ | Confirm with item edits (waiter) |
| DELETE | `/orders/:id` | ❌ | Delete order |

## Payments (`/payments`)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/payments/:id/info` | ❌ | **PUBLIC** — Customer views payment details |
| POST | `/payments/:id/confirm` | ❌ | **PUBLIC** — Customer confirms payment |
| POST | `/payments` | ❌ | Create payment record |
| GET | `/payments` | ❌ | List all payments |

## Admin (`/admin`)

| Method | Endpoint | Auth | Roles | Purpose |
|--------|----------|------|-------|---------|
| GET | `/admin/dashboard` | ✅ | admin, manager | Dashboard analytics |
| GET | `/admin/analytics` | ✅ | admin, manager | Detailed analytics |
| GET | `/admin/revenue` | ✅ | admin, manager | Revenue summary |
| GET | `/admin/revenue/analytics` | ✅ | admin, manager | Revenue with date filters |
| GET | `/admin/revenue/presets` | ✅ | admin, manager | Today/month/year revenue |
| GET | `/admin/revenue/chart` | ✅ | admin, manager | Revenue chart data |
| GET | `/admin/bills` | ✅ | admin, manager | Bill history |
| GET | `/admin/audit` | ✅ | admin, manager | Audit logs (paginated) |
| POST | `/admin/cleanup` | ✅ | admin, manager | Database cleanup |

---

# 14. Deployment Configuration

## Environment Variables

### Backend (`.env`)

```env
DATABASE_URL=mysql://user:password@host:3306/order_system
JWT_SECRET=your-jwt-secret-key
PORT=3000
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:3000
```

## Frontend Deployment

- Build: `npm run build` → outputs to `dist/`
- PWA-enabled (service worker auto-generated)
- Requires SPA-compatible hosting (all routes → index.html)
- Set `VITE_API_URL` to production backend URL before building

## Backend Deployment

- Build: `npm run build` → outputs to `dist/`
- Run: `npm run start:prod` (or `node dist/main`)
- Requires: MySQL, Redis (optional for caching), `uploads/` directory for images
- Run `npx prisma migrate deploy` on first deploy
- Run `npx prisma db seed` for initial data (optional)

## CORS Configuration

- Backend reads `CORS_ORIGIN` env var
- Defaults to `*` (allow all) if not set
- For production: set to exact frontend domain
- Socket.IO CORS mirrors the same setting

---

# 15. Testing & QA

## Verified Flows

- ✅ Customer: QR scan → menu browse → add to cart → place order → track → call waiter → request payment
- ✅ Waiter: view tables → confirm order → edit order → mark ready → mark completed → bill preview → QR payment → cash checkout
- ✅ Kitchen: Kanban displays confirmed orders → auto-updates on status changes
- ✅ Admin: dashboard analytics → menu CRUD → user management → table management → bills → audit logs
- ✅ Payment: QR generation → customer scan → payment page → confirm → table reset → thank-you screen
- ✅ Session lifecycle: creation → ordering → payment → cooldown → new session
- ✅ Socket reconnect: disconnect → reconnect → room rejoin → events resume
- ✅ Token refresh: expired token → auto-refresh → retry request → no user action needed
- ✅ Dark/light/system theme switching
- ✅ Viewport simulation (desktop/tablet/mobile)

## Race Condition Protections

| Protection | Implementation |
|-----------|----------------|
| Duplicate orders | 5-second idempotency window per table |
| Duplicate payment | `alreadyPaid` guard in `confirmPayment()` |
| Duplicate payment creation | Check for existing pending payment before creating |
| Double-click on buttons | Frontend uses `loading` state to disable buttons during API calls |
| Session resurrection | 30-second cooldown after session close |
| Stuck pending orders | Auto-confirm after 5 minutes (background job) |
| Empty sessions | Auto-close after 5 minutes with no orders (background job) |
| Cooldown on actions | `checkCooldown()` with configurable per-action delays |

## Transaction Safety

All critical operations use `prisma.$transaction()`:
- Order creation (session + order + items + table status)
- Order confirmation (order + table status)
- Payment confirmation (payment + orders + session + table + messages)
- Cash checkout (orders + session + table + messages + audit)
- Force reset (items + orders + session)

---

# 16. Remaining Known Issues

1. **Order endpoints lack auth guards** — Most `/orders` endpoints are currently public. In production, status changes should require `service` role authentication.
2. **Redis is optional** — The cache module is configured but not heavily utilized. Could improve performance for menu item caching.
3. **No rate limiting** — Public endpoints (order creation, call waiter) rely on cooldown checks but have no formal rate limiting middleware.
4. **Kitchen view not responsive** — Designed for fixed monitors; may need adjustments for tablet kitchen use.
5. **Image upload size limit** — No explicit max file size configured for menu item images.
6. **No input sanitization** — Menu item descriptions and order notes are not sanitized for XSS (mitigated by Vue's default escaping).
7. **Chunk size warning** — Build produces chunks > 500KB. Could benefit from code splitting.

---

# 17. Future Improvements

| Priority | Improvement | Description |
|----------|------------|-------------|
| 🔴 High | **Real payment gateway** | Integrate MoMo/VNPay/ZaloPay via webhooks |
| 🔴 High | **Order endpoint auth** | Add `@UseGuards(JwtAuthGuard)` to order status changes |
| 🟡 Medium | **Push notifications** | Web Push API for waiter notifications |
| 🟡 Medium | **Printer integration** | ESC/POS commands for thermal receipt printers |
| 🟡 Medium | **Kitchen monitor optimization** | Auto-scroll, sound alerts, large font mode |
| 🟡 Medium | **Multi-language support** | i18n for Vietnamese/English |
| 🟢 Low | **Analytics export** | PDF/CSV export for revenue reports |
| 🟢 Low | **Customer feedback** | Post-payment satisfaction rating |
| 🟢 Low | **Table map view** | Visual restaurant floor plan |
| 🟢 Low | **Inventory tracking** | Low-stock alerts for menu items |
| 🟢 Low | **Staff scheduling** | Shift management |

---

# 18. Instructions For Future AI Agents

> **READ THIS SECTION CAREFULLY BEFORE MAKING ANY CHANGES.**

## Absolute Rules

1. **DO NOT redesign the business flow.** The order lifecycle (pending_confirmation → confirmed → ready → completed) is battle-tested. Do not add or remove states.

2. **DO NOT remove socket deduplication.** The `off-before-on` pattern in `SocketService` prevents critical listener stacking bugs. Never register a socket listener without first removing the previous one.

3. **DO NOT reintroduce tax or service fees.** `total = subtotal` is a core business rule. There is no tax in this system.

4. **DO NOT make kitchen interactive.** Kitchen is READ-ONLY. All state transitions are handled by the waiter. This is an intentional architectural decision reflecting real restaurant workflow.

5. **DO NOT change the payment flow.** The fake QR payment system is specifically designed for graduation demo. The public endpoints (`/payments/:id/info` and `/payments/:id/confirm`) MUST remain unauthenticated.

6. **DO NOT call `socketService.disconnect()` from view components.** Only `userStore.logout()` should call disconnect. Views should use specific `off*()` methods in `onUnmounted()`.

7. **Preserve session cooldown (30 seconds).** This prevents zombie sessions from post-payment reloads.

8. **Always use Prisma `$transaction()`** for operations that modify multiple tables (orders, payments, sessions).

9. **Always test after modifications:**
   - `npm run build` in frontend (must pass with 0 errors)
   - Full flow test: order → confirm → ready → bill → payment → reset
   - Socket test: verify events fire correctly in all roles
   - Multi-tab test: open customer + waiter tabs simultaneously

10. **Preserve the audit log.** Every significant action (CREATE_ORDER, CONFIRM_ORDER, CHECKOUT, QR_PAYMENT_CONFIRMED, CALL_WAITER, REQUEST_PAYMENT) must create an AuditLog entry.

## Before Modifying Any File

1. Trace the full dependency chain (which stores, services, and views use it)
2. Check if it emits or listens to socket events
3. Check if it participates in a transaction
4. Check if it has cooldown/idempotency guards
5. Run build after changes to verify no TypeScript errors

## File Modification Risk Levels

| Risk | Files | Reason |
|------|-------|--------|
| 🔴 Critical | `socket.ts`, `order.gateway.ts`, `orders.service.ts`, `payments.service.ts`, `tables.service.ts` | Core realtime and business logic |
| 🟡 Medium | `api.ts`, `user.store.ts`, `order.store.ts`, `router/index.ts` | Auth flow, session management |
| 🟢 Low | View components, CSS, UI components | Visual-only changes |

---

# SYSTEM_ARCHITECTURE_SUMMARY

```
┌─────────────┐     QR Scan      ┌─────────────┐
│  Customer    │ ──────────────→  │  Frontend    │
│  (Phone)     │ ←── Socket ───  │  (Vue 3)     │
└─────────────┘                  └──────┬───────┘
                                        │ Axios + Socket.IO
                                        ▼
                                 ┌──────────────┐
                                 │   Backend    │
                                 │  (NestJS)    │
                                 ├──────────────┤
                                 │ OrderGateway │ ← Socket.IO Server
                                 │ AuthModule   │ ← JWT + Passport
                                 │ TablesModule │ ← Session lifecycle
                                 │ PaymentsModule│ ← Fake QR flow
                                 │ OrdersModule │ ← Order pipeline
                                 │ AdminModule  │ ← Analytics
                                 └──────┬───────┘
                                        │ Prisma ORM
                                        ▼
                                 ┌──────────────┐
                                 │    MySQL     │
                                 │  (11 tables) │
                                 └──────────────┘

Socket Flow:
  Customer places order → newOrderCreated → Service room
  Waiter confirms       → orderConfirmed  → Kitchen room
  Status changes        → orderUpdated    → Global
  Payment confirmed     → paymentCompleted → Global + Service
  Table state change    → tableUpdated    → Service room
```

---

# CURRENT_PROJECT_STATUS

| Area | Status | Notes |
|------|--------|-------|
| Customer flow | ✅ Complete | QR scan → order → track → payment |
| Waiter flow | ✅ Complete | Confirm → mark ready → bill → payment |
| Kitchen flow | ✅ Complete | Read-only Kanban, auto-updates |
| Admin flow | ✅ Complete | Full CRUD, analytics, audit |
| Fake QR Payment | ✅ Complete | End-to-end with duplicate protection |
| Realtime/Socket | ✅ Stabilized | Dedup, reconnect, room management |
| Authentication | ✅ Stabilized | 8h tokens, refresh flow, role guards |
| Session lifecycle | ✅ Stabilized | Cooldown, cleanup jobs, zombie prevention |
| Responsive UI | ✅ Complete | Mobile-first, touch-optimized, dark mode |
| Theme system | ✅ Complete | Light/dark/system with smooth transitions |
| Viewport simulation | ✅ Complete | Desktop/tablet/mobile preview |
| Build | ✅ Passing | Vite build, 0 errors, PWA enabled |

**Overall:** Feature-complete and production-ready for graduation demo presentation.

---

# NEXT_RECOMMENDED_STEPS

1. **Final E2E Testing** — Run Playwright tests for all critical flows
2. **Production Deployment** — Deploy backend (Node.js hosting) + frontend (static hosting/CDN)
3. **Environment Configuration** — Set production `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `VITE_API_URL`
4. **Database Migration** — Run `prisma migrate deploy` on production MySQL
5. **Seed Data** — Run `prisma db seed` for initial menu items, categories, admin user
6. **SSL/HTTPS** — Ensure both frontend and backend are served over HTTPS
7. **Demo Preparation** — Test with physical QR codes printed for each table
8. **Backup Strategy** — Set up MySQL backups for demo day resilience
