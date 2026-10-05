-- ---------------------------------------------------------
-- Gokulam Resorts - PostgreSQL schema (idempotent; safe to re-run)
-- Run via: npm run db:migrate
-- One-time data changes live in src/db/migrations/ and run BEFORE this file.
-- ---------------------------------------------------------

-- Needed for the "no overlapping stays in one room" exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Managers. Only they can approve/reject/cancel bookings, give discounts and
-- view guest ID documents.
CREATE TABLE IF NOT EXISTS admins (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Room types (Deluxe, Suite, Villa ...): description, nightly rate, capacity.
-- `total_rooms` is legacy — inventory is now the set of active room_units.
CREATE TABLE IF NOT EXISTS rooms (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(150) NOT NULL,
  slug             VARCHAR(180) NOT NULL UNIQUE,
  description      TEXT NOT NULL DEFAULT '',
  price_per_night  NUMERIC(10,2) NOT NULL CHECK (price_per_night >= 0),
  capacity         INTEGER NOT NULL DEFAULT 2 CHECK (capacity > 0),
  total_rooms      INTEGER NOT NULL DEFAULT 1 CHECK (total_rooms >= 0),
  size_sqft        INTEGER,
  bed_type         VARCHAR(100),
  amenities        TEXT[] NOT NULL DEFAULT '{}',
  images           TEXT[] NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Physical rooms (101, 102, V1 ...). Guests book one of these directly.
CREATE TABLE IF NOT EXISTS room_units (
  id            SERIAL PRIMARY KEY,
  room_type_id  INTEGER NOT NULL REFERENCES rooms(id),
  unit_number   VARCHAR(20) NOT NULL UNIQUE,
  floor         VARCHAR(20),
  view_label    VARCHAR(60),                          -- "Sea View", shown to guests
  -- Housekeeping state; mirrors the open cleaning job, 'Ready' when there is none.
  -- Occupancy (Occupied / Booked) is derived from bookings, not stored.
  status        VARCHAR(20) NOT NULL DEFAULT 'Ready'
                CHECK (status IN ('Dirty', 'Cleaning', 'Inspection', 'Ready')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE room_units ADD COLUMN IF NOT EXISTS view_label VARCHAR(60);
CREATE INDEX IF NOT EXISTS idx_room_units_room_type_id ON room_units (room_type_id);

-- Staff logins (phone + password). One role each.
CREATE TABLE IF NOT EXISTS staff (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  phone          VARCHAR(20)  NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20)  NOT NULL
                 CONSTRAINT staff_role_check CHECK (role IN ('FrontDesk', 'Bedding', 'Toiletry', 'Inspector')),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kitchen tablet logins: a short numeric PIN per cook instead of one shared
-- device password, so order actions can be attributed to a person (see
-- audit_log below). Deliberately its own table, not a `staff` role — PINs
-- are low-entropy by design (fast to type on a greasy tablet), so they are
-- looked up by scanning active rows and bcrypt-comparing each, not by a
-- direct WHERE match; fine at kitchen-team scale (a handful of cooks).
CREATE TABLE IF NOT EXISTS kitchen_staff (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  pin_hash      VARCHAR(255) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- Bookings — the source of truth. Guests have no accounts; a guest is the
-- name/phone/email on the booking.
--
-- Status flow:
--   online:  pending_payment -> paid -> confirmed (manager) -> checked_in -> checked_out
--   counter: confirmed (paid at desk)                       -> checked_in -> checked_out
--   exits:   cancelled (refund) | rejected (refund) | no_show (no refund)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id                      SERIAL PRIMARY KEY,
  reference               VARCHAR(12) UNIQUE NOT NULL, -- guest-facing code, e.g. GKL-7F3K2 (never a guessable sequential number)
  room_unit_id            INTEGER NOT NULL REFERENCES room_units(id),
  room_type_id            INTEGER NOT NULL REFERENCES rooms(id),
  source                  VARCHAR(10) NOT NULL CHECK (source IN ('online', 'counter')),
  guest_name              VARCHAR(150) NOT NULL,
  guest_phone             VARCHAR(20)  NOT NULL,
  guest_email             VARCHAR(150),
  adults                  INTEGER NOT NULL DEFAULT 1 CHECK (adults >= 1),
  children                INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0),
  check_in                DATE NOT NULL,
  check_out               DATE NOT NULL,              -- moves on extension / early checkout
  original_check_out      DATE NOT NULL,
  special_requests        TEXT,
  status                  VARCHAR(20) NOT NULL CHECK (status IN (
                            'pending_payment', 'paid', 'confirmed', 'checked_in',
                            'checked_out', 'cancelled', 'rejected', 'no_show')),

  -- Pricing snapshot (INR). total = (base - promo - manual) + GST, never below 0.
  -- See pricing.service.js; GST is per night (5% up to ₹7,500, else 18%).
  nightly_rate            NUMERIC(10,2) NOT NULL,
  base_amount             NUMERIC(10,2) NOT NULL,
  promo_discount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  promo_details           JSONB NOT NULL DEFAULT '[]',   -- [{date, ruleId, name, amount}]
  nights_detail           JSONB NOT NULL DEFAULT '[]',   -- [{date, rate, promo}] one per night
  manual_discount_type    VARCHAR(10) CHECK (manual_discount_type IN ('percent', 'fixed')),
  manual_discount_value   NUMERIC(10,2),
  manual_discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  manual_discount_reason  TEXT,
  manual_discount_by      INTEGER REFERENCES admins(id),
  tax_amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_details             JSONB NOT NULL DEFAULT '[]',   -- [{rate, nights, taxable, tax}]
  total_amount            NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  -- Money actually held for this booking: captured payments minus refunds.
  amount_paid             NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- pending_payment: end of payment window. paid: manager approval deadline.
  hold_expires_at         TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ,
  confirmed_at            TIMESTAMPTZ,
  checked_in_at           TIMESTAMPTZ,
  checked_out_at          TIMESTAMPTZ,
  closed_at               TIMESTAMPTZ,               -- cancelled / rejected / no_show
  close_reason            TEXT,
  created_by_staff_id     INTEGER REFERENCES staff(id),
  created_by_admin_id     INTEGER REFERENCES admins(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_booking_dates CHECK (check_out > check_in),
  -- Hard lock: a room can never hold two live bookings on overlapping nights.
  CONSTRAINT no_overlapping_room_bookings EXCLUDE USING gist (
    room_unit_id WITH =,
    daterange(check_in, check_out) WITH &&
  ) WHERE (status IN ('pending_payment', 'paid', 'confirmed', 'checked_in'))
);

-- Guest-facing reference code, added after the table already existed in
-- some installs. Nullable add + backfill + tighten, so this is safe to
-- re-run against a table that already has rows.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reference VARCHAR(12);
UPDATE bookings SET reference = 'GKL-' || upper(substr(md5(random()::text || id::text), 1, 5))
  WHERE reference IS NULL;
ALTER TABLE bookings ALTER COLUMN reference SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_reference ON bookings (reference);

-- GST (added after launch of the booking table). Bookings made before this
-- keep tax 0 — their totals were quoted and paid without tax.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS nights_detail JSONB NOT NULL DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_details JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings (check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings (guest_phone);

-- Money in. Online = Razorpay; counter = cash / UPI / card with a reference.
CREATE TABLE IF NOT EXISTS payments (
  id                    SERIAL PRIMARY KEY,
  booking_id            INTEGER NOT NULL REFERENCES bookings(id),
  method                VARCHAR(10) NOT NULL CHECK (method IN ('razorpay', 'cash', 'upi', 'card')),
  amount                NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status                VARCHAR(10) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'failed')),
  reference             VARCHAR(100),                 -- counter payments: receipt / UTR / card slip no.
  razorpay_order_id     VARCHAR(100) UNIQUE,
  razorpay_payment_id   VARCHAR(100) UNIQUE,
  razorpay_signature    VARCHAR(255),
  recorded_by_staff_id  INTEGER REFERENCES staff(id),
  recorded_by_admin_id  INTEGER REFERENCES admins(id),
  captured_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_counter_reference CHECK (method = 'razorpay' OR reference IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);

-- Money out. Razorpay refunds are automatic; refunds of counter payments are
-- 'pending' until the front desk pays them out and records how.
CREATE TABLE IF NOT EXISTS refunds (
  id                     SERIAL PRIMARY KEY,
  booking_id             INTEGER NOT NULL REFERENCES bookings(id),
  payment_id             INTEGER REFERENCES payments(id),
  amount                 NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason                 TEXT NOT NULL,
  method                 VARCHAR(10) NOT NULL CHECK (method IN ('razorpay', 'cash', 'upi', 'card')),
  status                 VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  razorpay_refund_id     VARCHAR(100) UNIQUE,
  reference              VARCHAR(100),
  initiated_by_admin_id  INTEGER REFERENCES admins(id),
  completed_by_staff_id  INTEGER REFERENCES staff(id),
  completed_by_admin_id  INTEGER REFERENCES admins(id),
  processed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON refunds (booking_id);

-- Guest ID proofs captured at check-in. Files live in object storage (S3);
-- only managers can view them; purged after DOC_RETENTION_DAYS.
-- Aadhaar: only the last 4 digits are ever stored, and the image must be masked.
CREATE TABLE IF NOT EXISTS guest_documents (
  id                    SERIAL PRIMARY KEY,
  booking_id            INTEGER NOT NULL REFERENCES bookings(id),
  guest_name            VARCHAR(150) NOT NULL,
  is_primary            BOOLEAN NOT NULL DEFAULT false,
  id_type               VARCHAR(20) NOT NULL CHECK (id_type IN ('Aadhaar', 'Passport', 'DrivingLicense')),
  id_last4              VARCHAR(4) NOT NULL,
  nationality           VARCHAR(60) NOT NULL DEFAULT 'Indian',
  storage_key           TEXT,                          -- NULL once purged
  content_type          VARCHAR(50),
  size_bytes            INTEGER,
  masked_confirmed      BOOLEAN NOT NULL DEFAULT false,
  verified_by_staff_id  INTEGER REFERENCES staff(id),
  verified_by_admin_id  INTEGER REFERENCES admins(id),
  verified_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_aadhaar_masked CHECK (id_type <> 'Aadhaar' OR masked_confirmed),
  CONSTRAINT chk_doc_verifier CHECK (verified_by_staff_id IS NOT NULL OR verified_by_admin_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_guest_documents_booking_id ON guest_documents (booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_documents_primary ON guest_documents (booking_id) WHERE is_primary;

-- Standing price promotions ("20% off Villas in June"). Applied per night at
-- booking time; when several match a night, the biggest discount wins.
CREATE TABLE IF NOT EXISTS rate_discounts (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  room_type_id   INTEGER REFERENCES rooms(id),          -- NULL = all room types
  discount_type  VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  value          NUMERIC(10,2) NOT NULL CHECK (value > 0),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,                         -- inclusive (a night's date)
  reason         TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     INTEGER REFERENCES admins(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_rate_discount_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_rate_discount_percent CHECK (discount_type <> 'percent' OR value <= 100)
);

-- Single-row table of resort-wide settings editable from the admin panel.
-- site_url is the production address baked into printed table QR codes; kept
-- empty until an admin sets it deliberately (never inferred from the request,
-- which would silently print "localhost" onto real table tents).
CREATE TABLE IF NOT EXISTS resort_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1,
  site_url    TEXT NOT NULL DEFAULT '',
  updated_by  INTEGER REFERENCES admins(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_resort_settings_singleton CHECK (id = 1)
);
INSERT INTO resort_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Resort details shown on the guest site, editable in Admin -> Settings so a
-- phone number or check-in time doesn't need a code change. Empty = not shown.
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS phone           TEXT NOT NULL DEFAULT '';
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS whatsapp        TEXT NOT NULL DEFAULT ''; -- digits only, with country code
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS email           TEXT NOT NULL DEFAULT '';
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS address         TEXT NOT NULL DEFAULT '';
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS maps_url        TEXT NOT NULL DEFAULT ''; -- Google Maps link to the resort's pin
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS check_in_time   TEXT NOT NULL DEFAULT ''; -- as shown to guests, e.g. "2:00 PM"
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS check_out_time  TEXT NOT NULL DEFAULT '';
-- How many restaurant tables have a QR code. Orders for any other table number are refused.
ALTER TABLE resort_settings ADD COLUMN IF NOT EXISTS table_count     INTEGER NOT NULL DEFAULT 10
  CHECK (table_count BETWEEN 1 AND 200);

-- Who did what: approvals, rejections, discounts, payments, check-in/out,
-- overrides, automatic expiries.
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER REFERENCES bookings(id),
  actor_type  VARCHAR(10) NOT NULL CHECK (actor_type IN ('admin', 'staff', 'guest', 'system')),
  actor_id    INTEGER,
  action      VARCHAR(50) NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 'kitchen' added so per-cook order actions (see kitchen_staff above) are
-- distinguishable from housekeeping/front-desk 'staff' entries — both id
-- spaces start at 1, so conflating them would make actor_id ambiguous.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_type_check
  CHECK (actor_type IN ('admin', 'staff', 'kitchen', 'guest', 'system'));

CREATE INDEX IF NOT EXISTS idx_audit_log_booking_id ON audit_log (booking_id);

-- Outbox of guest messages (SMS / WhatsApp / email).
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  booking_id  INTEGER REFERENCES bookings(id),
  channel     VARCHAR(10) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
  recipient   VARCHAR(150) NOT NULL,
  template    VARCHAR(50) NOT NULL,
  body        TEXT NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'logged', 'failed')),
  provider    VARCHAR(30),
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_booking_id ON notifications (booking_id);

-- ---------------------------------------------------------
-- Food ordering module (QR menu, kiosk, kitchen dashboard)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS menu_categories (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  slug         VARCHAR(120) NOT NULL UNIQUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            SERIAL PRIMARY KEY,
  category_id   INTEGER NOT NULL REFERENCES menu_categories(id),
  name          VARCHAR(150) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image         TEXT,
  is_veg        BOOLEAN NOT NULL DEFAULT true,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items (category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items (is_available);

CREATE TABLE IF NOT EXISTS food_orders (
  id              SERIAL PRIMARY KEY,
  order_type      VARCHAR(20) NOT NULL, -- table | counter | kiosk
  table_number    VARCHAR(20),          -- NULL for counter and kiosk orders
  customer_name   VARCHAR(150),
  customer_phone  VARCHAR(20),
  notes           TEXT,
  total_amount    NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'new', -- new | preparing | ready | served | cancelled
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_orders_status ON food_orders (status);
CREATE INDEX IF NOT EXISTS idx_food_orders_created_at ON food_orders (created_at);

CREATE TABLE IF NOT EXISTS food_order_items (
  id             SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES food_orders(id),
  menu_item_id   INTEGER NOT NULL REFERENCES menu_items(id),
  item_name      VARCHAR(150) NOT NULL, -- snapshot at order time (survives menu edits)
  unit_price     NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  line_total     NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_order_items_order_id ON food_order_items (order_id);

-- Guest choices per dish: a spice level (only offered on dishes the kitchen
-- marks as adjustable) and a free-text request.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS spice_adjustable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE food_order_items ADD COLUMN IF NOT EXISTS spice_level VARCHAR(10)
  CHECK (spice_level IN ('mild', 'medium', 'hot'));
ALTER TABLE food_order_items ADD COLUMN IF NOT EXISTS notes VARCHAR(300);

-- A guest follows their own order by this random token. Order numbers are
-- sequential, so they must not work as a public address.
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS public_token VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_orders_public_token ON food_orders (public_token)
  WHERE public_token IS NOT NULL;

-- What a diner needs to know before ordering. allergens holds any of:
-- nuts, dairy, gluten, egg, shellfish, fish, soy. spice_rating is the dish's
-- usual heat, 0 (none) to 3 (hot).
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_jain      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS spice_rating SMALLINT NOT NULL DEFAULT 0
  CHECK (spice_rating BETWEEN 0 AND 3);

-- "Call staff" / "Request bill" from a table's ordering page; shown on the
-- kitchen display until someone marks it done.
CREATE TABLE IF NOT EXISTS table_requests (
  id            SERIAL PRIMARY KEY,
  table_number  VARCHAR(20) NOT NULL,
  kind          VARCHAR(10) NOT NULL CHECK (kind IN ('staff', 'bill')),
  status        VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_table_requests_open ON table_requests (status, created_at);

-- ---------------------------------------------------------
-- Housekeeping / room cleaning
-- Flow per job: Dirty -> Cleaning -> Inspection -> Ready
-- Created at check-out (primary), by the 11 PM safety net for any checkout
-- that has no job, or manually by a manager.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS cleaning_jobs (
  id            SERIAL PRIMARY KEY,
  room_unit_id  INTEGER NOT NULL REFERENCES room_units(id),
  booking_id    INTEGER REFERENCES bookings(id),       -- the stay that was checked out
  job_date      DATE NOT NULL,                         -- resort-local day the job was raised
  source        VARCHAR(10) NOT NULL CHECK (source IN ('checkout', 'nightly', 'manual')),
  reason        VARCHAR(20) NOT NULL CHECK (reason IN ('checkout', 'manual')),
  priority      VARCHAR(10) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('VIP', 'High', 'Normal')),
  status        VARCHAR(20) NOT NULL DEFAULT 'Dirty'
                CHECK (status IN ('Dirty', 'Cleaning', 'Inspection', 'Ready')),
  notes         TEXT,
  created_by    INTEGER REFERENCES admins(id),
  ready_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Never two open jobs on the same room, and one checkout clean per stay.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cleaning_jobs_open_per_unit
  ON cleaning_jobs (room_unit_id) WHERE status <> 'Ready';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cleaning_jobs_booking
  ON cleaning_jobs (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cleaning_jobs_status ON cleaning_jobs (status);

CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id                 SERIAL PRIMARY KEY,
  job_id             INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
  type               VARCHAR(20) NOT NULL CHECK (type IN ('Bedding', 'Toiletry', 'Inspection')),
  assigned_staff_id  INTEGER REFERENCES staff(id),
  status             VARCHAR(20) NOT NULL DEFAULT 'Pending'
                     CHECK (status IN ('Pending', 'InProgress', 'Paused', 'Completed', 'Failed')),
  start_time         TIMESTAMPTZ,
  end_time           TIMESTAMPTZ,
  failure_reason     TEXT,                             -- last inspector rejection, shown on redo
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, type)
);

CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_staff ON cleaning_tasks (assigned_staff_id, status);

-- Audit trail of inspector decisions (task rows are reset on reject, this is not).
CREATE TABLE IF NOT EXISTS cleaning_inspections (
  id              SERIAL PRIMARY KEY,
  job_id          INTEGER NOT NULL REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
  inspector_id    INTEGER NOT NULL REFERENCES staff(id),
  result          VARCHAR(10) NOT NULL CHECK (result IN ('approved', 'rejected')),
  failed_tasks    TEXT[] NOT NULL DEFAULT '{}',
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaning_inspections_job_id ON cleaning_inspections (job_id);

-- ---------------------------------------------------------
-- Added 2026-10: paid food orders, housekeeping PINs, room problems,
-- room details. All additive.
-- ---------------------------------------------------------

-- Payment for a food order is taken at the counter and recorded by the front
-- desk or a manager. paid_at NULL = not yet paid.
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS paid_at            TIMESTAMPTZ;
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS payment_method     VARCHAR(10) CHECK (payment_method IN ('cash', 'upi', 'card'));
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS payment_reference  VARCHAR(100);
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS paid_by_staff_id   INTEGER REFERENCES staff(id);
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS paid_by_admin_id   INTEGER REFERENCES admins(id);
CREATE INDEX IF NOT EXISTS idx_food_orders_unpaid ON food_orders (created_at) WHERE paid_at IS NULL;

-- Housekeeping may sign in by tapping their name and typing a PIN (a shared
-- phone, no keyboard to speak of). NULL = no PIN; phone + password still works.
-- The front desk never gets one.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);

-- Problems housekeeping finds in a room: a broken tap, a stain, lost property.
-- The photo, if any, is in private storage (photo_key) and is deleted a month
-- after the problem is resolved.
CREATE TABLE IF NOT EXISTS room_issues (
  id                    SERIAL PRIMARY KEY,
  room_unit_id          INTEGER NOT NULL REFERENCES room_units(id),
  kind                  VARCHAR(20) NOT NULL CHECK (kind IN ('repair', 'damage', 'lost_property', 'other')),
  description           TEXT NOT NULL,
  photo_key             TEXT,
  photo_content_type    VARCHAR(50),
  reported_by_staff_id  INTEGER NOT NULL REFERENCES staff(id),
  status                VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by_admin_id  INTEGER REFERENCES admins(id),
  resolution_note       TEXT,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_room_issues_status ON room_issues (status, created_at);

-- What guests ask about a room before booking. NULL = the manager has not
-- said, and the guest site then says nothing (breakfast falls back to the
-- amenities list).
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS breakfast_included     BOOLEAN;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS extra_bed_available    BOOLEAN;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS extra_bed_charge       NUMERIC(10,2) CHECK (extra_bed_charge >= 0); -- per night; NULL = no charge stated
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS smoking_allowed        BOOLEAN;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS wheelchair_accessible  BOOLEAN;

-- ---------------------------------------------------------
-- Added 2026-10: the restaurant's self-ordering kiosk. All additive.
-- ---------------------------------------------------------

-- The kiosk takes payment on its own screen before anything reaches the
-- kitchen. A checkout is a priced basket waiting for that payment; when the
-- payment arrives it becomes a food order that is already paid. (Room orders
-- paid online use it too: see the columns added further down.)
--   created    waiting for the payment
--   paid       the order exists (food_order_id)
--   abandoned  the customer backed out, or nobody paid in time
--   refunded   a payment arrived after it was abandoned and was sent back
CREATE TABLE IF NOT EXISTS kiosk_checkouts (
  id                   SERIAL PRIMARY KEY,
  token                VARCHAR(40) NOT NULL UNIQUE,
  items                JSONB NOT NULL, -- priced lines, as they are copied to food_order_items
  notes                TEXT,
  total_amount         NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  status               VARCHAR(10) NOT NULL DEFAULT 'created'
                       CHECK (status IN ('created', 'paid', 'abandoned', 'refunded')),
  razorpay_order_id    VARCHAR(60) NOT NULL UNIQUE,
  razorpay_payment_id  VARCHAR(60),
  refund_reference     VARCHAR(60),
  food_order_id        INTEGER REFERENCES food_orders(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at              TIMESTAMPTZ,
  checked_at           TIMESTAMPTZ -- when the clean-up job asked the gateway about it
);
CREATE INDEX IF NOT EXISTS idx_kiosk_checkouts_unchecked ON kiosk_checkouts (created_at)
  WHERE checked_at IS NULL AND status IN ('created', 'abandoned');

-- A food order paid through the payment gateway (the kiosk) has
-- payment_method 'online' and the gateway's payment id. If it is cancelled
-- later, the refund_* columns say how giving the money back stands.
-- order_type is now one of: table | counter | kiosk.
ALTER TABLE food_orders DROP CONSTRAINT IF EXISTS food_orders_payment_method_check;
ALTER TABLE food_orders ADD CONSTRAINT food_orders_payment_method_check
  CHECK (payment_method IN ('cash', 'upi', 'card', 'online'));
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(60);
CREATE UNIQUE INDEX IF NOT EXISTS idx_food_orders_gateway_payment ON food_orders (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS refund_reference   VARCHAR(60);
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS refund_status      VARCHAR(10) CHECK (refund_status IN ('pending', 'processed', 'failed'));
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS refunded_at        TIMESTAMPTZ;

-- ---------------------------------------------------------
-- Added 2026-10: food ordered to a hotel room. All additive.
-- ---------------------------------------------------------

-- Each hotel room has a QR code; an order from it is brought to the room
-- (order_type 'room', room_number = the unit's number). The guest pays online
-- when ordering, or in cash at the door: delivering an unpaid room order
-- records the cash (payment_reference 'Collected on delivery').
-- order_type is now one of: table | counter | kiosk | room.
ALTER TABLE food_orders ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

-- A room order paid online waits for its payment the same way a kiosk order
-- does, so it uses the same checkouts. (The table keeps the name of its first use.)
ALTER TABLE kiosk_checkouts ADD COLUMN IF NOT EXISTS order_type     VARCHAR(20) NOT NULL DEFAULT 'kiosk' CHECK (order_type IN ('kiosk', 'room'));
ALTER TABLE kiosk_checkouts ADD COLUMN IF NOT EXISTS room_number    VARCHAR(20);
ALTER TABLE kiosk_checkouts ADD COLUMN IF NOT EXISTS customer_name  VARCHAR(150);
ALTER TABLE kiosk_checkouts ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

-- ---------------------------------------------------------
-- Added 2026-10: a manager or the front desk can decide an inspection when
-- no inspector is on shift. All additive.
-- ---------------------------------------------------------

-- Who decided: inspector_id is the staff member (the inspector, or front desk
-- staff standing in for one); admin_id is set instead when a manager did it.
ALTER TABLE cleaning_inspections ALTER COLUMN inspector_id DROP NOT NULL;
ALTER TABLE cleaning_inspections ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES admins(id);
ALTER TABLE cleaning_inspections DROP CONSTRAINT IF EXISTS chk_inspection_decider;
ALTER TABLE cleaning_inspections ADD CONSTRAINT chk_inspection_decider
  CHECK (inspector_id IS NOT NULL OR admin_id IS NOT NULL);
