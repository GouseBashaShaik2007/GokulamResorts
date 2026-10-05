# Gokulam Resorts — Chirala Beach

Full-stack resort platform: Next.js (App Router) + Tailwind frontend, Node/Express REST API, PostgreSQL,
Razorpay payments with server-side signature verification, and Socket.IO live updates. It covers online
and walk-in bookings of specific rooms, manager approval, ID-verified check-in, check-out, housekeeping,
and restaurant ordering.

## 1. Folder structure

```
Gokulum/
├── backend/
│   ├── server.js                       # Express + Socket.IO + scheduler entry point
│   ├── .env.example                    # copy to .env
│   └── src/
│       ├── db/
│       │   ├── schema.sql              # idempotent table definitions (re-run every migrate)
│       │   ├── migrations/             # one-time scripts, applied once each, in name order
│       │   ├── migrate.js              # applies pending migrations, then schema.sql
│       │   ├── seed.js                 # admin login, room types, room numbers, menu
│       │   └── pool.js                 # pg Pool + transaction helper
│       ├── services/
│       │   ├── booking.service.js      # booking state machine, payments, refunds, IDs, expiry
│       │   ├── pricing.service.js      # nightly rates + promotions + manager discounts
│       │   ├── gateway.service.js      # Razorpay (live / mock)
│       │   ├── storage.service.js      # private ID-document storage (S3 / local dev)
│       │   ├── notify.service.js       # SMS / WhatsApp / email outbox
│       │   ├── cleaning.service.js     # housekeeping state machine
│       │   └── audit.js                # audit_log writer
│       ├── jobs/                       # scheduler: hold expiry, message retry, 11 PM cleaning, ID purge
│       ├── middleware/                 # adminAuth, deskAuth, staffAuth, kitchenAuth, validate, errors
│       ├── controllers/  routes/       # REST endpoints (see section 4)
│       ├── realtime.js                 # Socket.IO rooms + events
│       └── utils/                      # dates (resort timezone), asyncHandler
│
└── frontend/
    ├── app/
    │   ├── rooms/, booking/[roomId]/   # room types → dates → pick a room number → pay
    │   ├── booking/confirmation, booking/status   # guest status (booking ID + phone)
    │   ├── admin/                      # manager dashboard
    │   ├── frontdesk/                  # front desk console
    │   ├── staff/                      # housekeeping mobile screens
    │   ├── order/, dine-in/, kitchen/  # food ordering: QR codes (tables, hotel rooms, counter), the restaurant kiosk, kitchen display
    │   └── contact/, page.js, layout.js
    ├── components/
    │   ├── bookings/                   # DeskBoard, BookingDetail, CounterBookingForm, RoomPicker
    │   ├── admin/                      # BookingsManager (+ promotions), HousekeepingManager, menu …
    │   ├── BookingForm.js, GuestBookingStatus.js, Navbar.js, …
    └── lib/                            # api (axios + auth helpers), live-update socket hook, formatting
```

## 2. Step-by-step setup

### Prerequisites
- Node.js 18+
- PostgreSQL 13+ with the `btree_gist` extension (bundled with Postgres; available on Neon, Supabase, RDS)
- A Razorpay account (optional for development — without keys, payments run in mock mode)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
# (Razorpay keys, S3 and messaging are needed before going live — see section 7)

npm run db:migrate   # pending one-time migrations, then schema.sql
npm run db:seed      # admin login, 4 room types, 17 room numbers, sample menu

npm run dev          # http://localhost:5000  (nodemon)
```

Health check: `GET http://localhost:5000/health` → `{ "success": true, "status": "ok" }`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000/api

npm run dev          # http://localhost:3000
```

Log in at `http://localhost:3000/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then add staff in
*Housekeeping → Staff* (Front desk, Bedding, Toiletry, Inspector).

**Screens**

| URL | Who | What |
|-----|-----|------|
| `/rooms`, `/rooms/:slug` | Guests | Pick dates → pick an actual room number → pay |
| `/booking/status` | Guests | Look up a booking with booking ID + mobile number (no login) |
| `/admin` | Manager | Bookings (approvals, discounts, cancellations, IDs, promotions), rooms, housekeeping, menu |
| `/frontdesk` | Front desk staff | Arrivals / departures / in-house, walk-ins, payments, ID capture, check-in/out |
| `/staff` | Housekeeping | Bedding / toiletry / inspector task screens (front desk logins are redirected) |
| `/kitchen` | Kitchen | Food orders |

## 3. Booking system (PMS)

The **booking row is the source of truth**; payments, refunds, ID documents, cleaning jobs and guest
messages all hang off it. Guests have no accounts — a guest is the name / phone / email on the booking.

```
online:  pending_payment ─Razorpay─▶ paid ─manager approves─▶ confirmed
counter:                               (paid at the desk) ──▶ confirmed
stay:    confirmed ─ID + full payment─▶ checked_in ─▶ checked_out ─▶ cleaning job
exits:   cancelled / rejected (full refund) · no_show (no refund)
```

**Rules enforced by the server**

- **One room, one live booking per night.** A Postgres exclusion constraint on `(room_unit_id,
  daterange(check_in, check_out))` rejects overlaps for any `pending_payment / paid / confirmed /
  checked_in` booking — including simultaneous requests.
- **Online holds:** the room is held `BOOKING_HOLD_MINUTES` (15) while the guest pays. Once paid, the
  manager has `BOOKING_APPROVAL_HOURS` (24) to approve; otherwise the booking auto-cancels with a full
  refund (checked every 2 minutes). A payment that arrives after its hold expired is refunded automatically.
- **Counter bookings** (walk-ins) are confirmed immediately and paid in full on the spot
  (cash / UPI / card + a reference number).
- **Check-in** needs: status confirmed, date on/after check-in, nothing due, the primary guest's ID
  verified and uploaded, and the room `Ready` in housekeeping. IDs for all adults are expected; the desk
  sees "ID recorded for 1 of 2 adults" if some are missing.
- **Extensions** price the extra nights at current rates and promotions and add a balance due; check-out
  is blocked until it is paid. Extending into another guest's booking is refused.
- **Early check-out** ends the stay today and frees the unused nights. There is no automatic refund —
  a manager discount can give money back.
- **Check-out** creates the room's cleaning job in the same transaction; the 11 PM job is a safety net.
- **Discounts are manager-only.** Booking-level: % or ₹ with a mandatory reason; if the guest already
  paid more than the new total, the difference is refunded automatically. Standing promotions
  ("20% off Villas in June") apply per night to new bookings; the largest one per night wins.
- **Refunds** go back through Razorpay automatically. Money taken at the counter is refunded at the
  counter: it shows on the front desk board until someone records the payout (method + reference).
- **Guest ID documents:** Aadhaar / Passport / Driving licence. Only the last 4 characters of the ID
  number are stored; Aadhaar images must be masked (the desk confirms this before saving). Files go to
  private object storage; only managers can open them, through 60-second links, and every view is
  logged. Files are deleted `DOC_RETENTION_DAYS` (default 90, max 180) after check-out or cancellation;
  the metadata stays.
- **Guest messages** (received, confirmed, rejected, cancelled/expired, refund, extended, thank-you) are
  written to a `notifications` outbox for SMS, WhatsApp and email, then delivered after commit.
- **Audit trail:** every approval, rejection, discount, payment, refund, ID action, check-in/out and
  automatic expiry is recorded in `audit_log` with who did it, and shown as "History" on each booking.
- **Live updates:** booking changes reach the manager and front desk screens instantly (Socket.IO).

**Tables**

| Table | Purpose |
|-------|---------|
| `rooms` | Room types: description, nightly rate, capacity, amenities, images. |
| `room_units` | Physical rooms (101, V1 …) guests book directly; floor, view, housekeeping status. |
| `bookings` | One stay in one room: guest, dates, status, price breakdown (base, promotions, manager discount, total), `amount_paid` (net of refunds), hold deadlines, timestamps. |
| `payments` | Money in: Razorpay (order/payment ids, verified signature) or counter (cash/UPI/card + reference, who recorded it). |
| `refunds` | Money out: Razorpay refunds (tracked by webhook) or counter payouts (pending until paid out). |
| `guest_documents` | ID proofs: guest, type, last 4 chars, nationality, storage key, masked confirmation, verified by/at, purged at. |
| `rate_discounts` | Standing promotions by room type and date range, with a reason. |
| `audit_log` | Who did what, when (manager, staff, guest, system). |
| `notifications` | Guest message outbox (SMS / WhatsApp / email) and delivery status. |
| `admins` | Manager logins. |
| `staff` | Staff logins (phone + password), one role: FrontDesk / Bedding / Toiletry / Inspector. |

The state machine and money handling live in
[`booking.service.js`](backend/src/services/booking.service.js); pricing in
[`pricing.service.js`](backend/src/services/pricing.service.js).

## 4. API reference

All routes are mounted under `/api`.

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/rooms`, `/rooms/:id` | Public | Room types (with number of rooms) |
| GET | `/availability?checkIn&checkOut&roomTypeId&guests` | Public | Free room numbers + price quote |
| POST | `/book-room` | Public | Hold a room (`pending_payment`) |
| POST | `/create-order` | Public | Razorpay order for a held booking (booking id + phone) |
| POST | `/verify-payment` | Public | **Verify Razorpay signature** → booking `paid` (awaiting approval) |
| POST | `/razorpay/webhook` | Razorpay signature | `payment.captured`, `refund.processed`, `refund.failed` |
| GET | `/bookings/lookup?bookingId&phone` | Public (rate-limited) | Guest status page |
| POST | `/contact` | Public | Contact form |
| POST | `/admin/login` | Public | Manager login → JWT |
| POST | `/admin/bookings/:id/approve` · `reject` · `cancel` | Manager | Decisions (reject/cancel need a reason; full refund) |
| POST | `/admin/bookings/:id/discount` | Manager | % or ₹ discount with reason (overpayment refunded) |
| GET | `/admin/documents/:id/url` | Manager | 60-second link to one ID document (logged) |
| GET/POST, PUT | `/admin/rate-discounts`, `/admin/rate-discounts/:id` | Manager | Promotions |
| GET | `/desk/overview` | Front desk or manager | Arrivals, departures, in-house, approvals, pending payouts |
| GET | `/desk/bookings?q&status`, `/desk/bookings/:id` | Front desk or manager | Search, full detail |
| GET | `/desk/availability` | Front desk or manager | Rooms free for a walk-in |
| POST | `/desk/bookings` | Front desk or manager | Walk-in booking + full payment |
| POST | `/desk/bookings/:id/payments` | Front desk or manager | Record a counter payment for a balance due |
| POST / DELETE | `/desk/bookings/:id/documents[/:docId]` | Front desk or manager | Upload a verified ID (multipart) / remove before check-in |
| POST | `/desk/bookings/:id/check-in` · `extend` · `check-out` · `no-show` | Front desk or manager | Stay operations |
| POST | `/desk/refunds/:id/complete` | Front desk or manager | Record a counter refund payout |
| — | `/admin/rooms…`, `/admin/menu…`, `/admin/food-orders`, `/menu…`, `/food-orders…`, `/kitchen…` | | Rooms, menu and food ordering |
| POST | `/checkouts` | Kiosk key, or a room's QR key | Price a basket and open a Razorpay order for it (nothing reaches the kitchen yet) |
| POST | `/checkouts/:token/confirm` | Checkout token | **Verify Razorpay signature** → the food order is created, already paid |
| GET · POST | `/checkouts/:token` · `…/abandon` | Checkout token | Where a checkout stands · the customer backed out |

## 4a. Housekeeping (room cleaning) module

**Screens:** Admin → *Housekeeping* tab (cleaning board, staff, room numbers) · `/staff` (mobile
screen for bedding / toiletry staff and inspectors, phone + password login).

**Flow per cleaning job:** `Dirty → Cleaning → Inspection → Ready` (`Ready` = bookable). Each job has
three tasks — Bedding, Toiletry, Inspection — each assigned to one staff member of that role.

- Bedding and toiletry run in parallel: **Start → Pause ⇄ Resume → Complete**. First Start moves the
  room to `Cleaning`. `start_time` is the first start; `end_time` is set on Complete.
- When both are `Completed` the room moves to `Inspection`.
- Inspector **Approve** → `Ready`. **Reject** needs the failed task(s) + a reason: only those tasks reset
  to `Pending` (reason shown to the cleaner), completed ones stay done, the room returns to
  `Cleaning`, and the same inspector gets it back. Every decision is kept in `cleaning_inspections`.
- **No inspector on shift:** a manager (cleaning board) or the front desk (Rooms tab) can approve a room
  that has reached `Inspection`. A manager can also send it back, or mark a room `Ready` before cleaning
  has finished (a room marked dirty by mistake); the front desk cannot.
- **Assigning:** a manager from the cleaning board, or an inspector from `/staff` → *Assign rooms*, where
  inspectors see every open room and choose who does each task.
- **Guests:** for a stay starting today, the website only offers rooms that are `Ready`. Later arrivals
  and front desk walk-ins are not restricted.
- Every task list is sorted by priority (VIP > High > Normal), then oldest first.

**Where jobs come from:**
1. **Check-out** (primary): the front desk's check-out creates the job immediately. Priority is High
   when the room has another arrival the same day, otherwise Normal.
2. **11 PM safety net** (`CLEANING_CRON`, `RESORT_TIMEZONE`): any stay checked out in the last 3 days
   without a cleaning job gets one. The admin board also has a **Run nightly now** button.
3. **Manually:** a manager marks any room dirty (with priority + note).

The database allows one checkout job per stay and never two open jobs on the same room. Check-in is
refused while a room is not `Ready`.

| Table | Purpose |
|-------|---------|
| `cleaning_jobs` | One cleaning cycle for one room: the stay it follows, source (checkout / nightly / manual), priority, status. |
| `cleaning_tasks` | Bedding / Toiletry / Inspection per job: assignee, status, `start_time`, `end_time`, last `failure_reason`. |
| `cleaning_inspections` | Audit log of approve/reject decisions. |

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET/POST, PUT | `/admin/staff`, `/admin/staff/:id` | Manager | Staff (incl. front desk): add, rename, (de)activate, reset password |
| GET/POST, PUT | `/admin/room-units`, `/admin/room-units/:id` | Manager | Physical rooms (number, floor, view) |
| GET/POST | `/admin/cleaning/jobs` | Manager | Board / mark a room dirty |
| PUT / PATCH | `/admin/cleaning/jobs/:id/assign` · `/priority` | Manager | Assign staff / change priority |
| POST | `/admin/cleaning/jobs/:id/approve` · `reject` | Manager | Decide an inspection (`approve` with `force: true` marks a room ready early) |
| POST | `/admin/cleaning/run-nightly` | Manager | Run the safety net now |
| POST | `/desk/rooms/:id/approve-cleaning` | Front desk or manager | Approve a cleaned room (`:id` is the room) |
| POST | `/staff/login` | Public | Staff login → JWT |
| GET | `/staff/tasks` | Staff | My open tasks, priority-sorted |
| POST | `/staff/tasks/:id/start` · `pause` · `complete` · `approve` · `reject` | Staff | Task actions |
| GET / PUT | `/staff/jobs` · `/staff/jobs/:id/assign` | Inspector | Every open room and the team / assign staff |

The housekeeping state machine lives in [`cleaning.service.js`](backend/src/services/cleaning.service.js).

## 5. Payment flow (Razorpay)

1. The guest picks a room; the frontend calls `POST /api/book-room` and the room is held (`pending_payment`).
2. `POST /api/create-order` (booking id + phone) creates a Razorpay order for the booking total. Only the
   **public** key id goes to the browser.
3. Razorpay Checkout runs; on success the frontend sends `razorpay_order_id`, `razorpay_payment_id` and
   `razorpay_signature` to `POST /api/verify-payment`.
4. **The backend recomputes** `HMAC_SHA256(order_id + "|" + payment_id, key_secret)` and compares in
   constant time. Only a verified payment is recorded; the booking becomes `paid` and waits for the
   manager. It is not confirmed until the manager approves.
5. **Webhook** (`/api/razorpay/webhook`, signed with `RAZORPAY_WEBHOOK_SECRET`) is the second path:
   `payment.captured` records payments whose guest closed the browser before step 4, and
   `refund.processed` / `refund.failed` track refunds (a failed refund puts the money back on the booking).
6. Refunds (reject, cancel, auto-expiry, discounts, late payments) go through the Razorpay refunds API
   inside the same transaction as the booking change — if Razorpay refuses, nothing changes.

**Restaurant kiosk.** The self-ordering tablet in the restaurant (`/dine-in`, set up once from Admin → QR
Codes) takes payment on its own screen with the same Razorpay account. A basket is priced on the server
and held as a *checkout*; only a verified payment turns it into a food order, so the kitchen never sees an
unpaid kiosk order. The same webhook covers a kiosk whose own confirmation was lost, and a job closes
checkouts nobody paid for every five minutes: a payment that arrives after the kiosk has moved on is
refunded instead of becoming an order nobody is waiting for. Cancelling an order that was paid online
(kitchen, manager, or the guest while it is still new) refunds it through Razorpay automatically.

**Hotel rooms.** Each room has a QR code (`/order/room/<number>`, printed from Admin → QR Codes). The
guest chooses how to pay: *pay now* uses the same checkouts as the kiosk on the guest's own phone; *cash*
places the order at once and is paid at the room's door. Nobody at a desk records that cash: marking the
order delivered on the kitchen screen does (and taking "delivered" back undoes it). Nothing is added to
the room's bill.

**Mock mode:** without real keys (or with `RAZORPAY_MODE=mock`) orders and refunds are simulated and the
booking page shows a "Simulate Successful Payment" button. Mock mode refuses to start when
`NODE_ENV=production`.

## 6. Environment variables

See [`backend/.env.example`](backend/.env.example) and
[`frontend/.env.local.example`](frontend/.env.local.example). Never commit real `.env`/`.env.local`
files — both are already in [`.gitignore`](.gitignore). Booking-related settings: `RESORT_TIMEZONE`,
`BOOKING_HOLD_MINUTES`, `BOOKING_APPROVAL_HOURS`, `RAZORPAY_MODE`, `RAZORPAY_WEBHOOK_SECRET`,
`STORAGE_DRIVER` + `S3_*`, `DOC_RETENTION_DAYS`, `NOTIFY_DRIVER`, `CLEANING_CRON`.

## 7. Security notes / production checklist

- All inputs are validated with `express-validator` before hitting a controller.
- Payment verification uses HMAC-SHA256 + constant-time comparison — never string `===`.
- Manager routes need an admin JWT; front desk routes accept a manager or an active FrontDesk staff
  JWT; deactivating a staff member cuts their access immediately.
- `helmet`, CORS allow-listing (`FRONTEND_URL`), and rate limiting on logins, payments and the public
  booking lookup.
- Guest ID files: private bucket, random keys, 60-second links for managers only, views logged,
  automatic deletion after the retention period, Aadhaar stored masked with the last 4 digits only.

**Before going live**

- Real Razorpay keys (`RAZORPAY_MODE=live`), a webhook pointed at `/api/razorpay/webhook` with
  `payment.captured`, `refund.processed` and `refund.failed`, and `RAZORPAY_WEBHOOK_SECRET` set.
- `STORAGE_DRIVER=s3` with a private bucket (local storage is refused in production).
- An SMS / WhatsApp / email provider added as a driver in
  [`notify.service.js`](backend/src/services/notify.service.js). Indian SMS needs DLT-registered
  templates; WhatsApp needs approved Business API templates. Until then messages are only logged.
- HTTPS, `NODE_ENV=production`, managed Postgres with backups, and a single backend instance running
  the scheduler (or move the cron jobs to one worker if you scale out).
