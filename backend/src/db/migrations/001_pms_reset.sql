-- One-time reset for the PMS rebuild (2026-09-28).
-- Bookings move from room types to specific rooms, guests stop being `users`
-- rows, and payments gain counter methods + refunds. Existing booking data was
-- test data only, so the old booking tables are dropped and recreated by
-- schema.sql. Cleaning jobs reference bookings now, so they are rebuilt too.
-- Rooms, room units, staff, admins, menu and food orders are kept.

DROP TABLE IF EXISTS cleaning_inspections, cleaning_tasks, cleaning_jobs CASCADE;
DROP TABLE IF EXISTS payments, bookings, users CASCADE;

-- Staff gain the FrontDesk role.
DO $$
BEGIN
  IF to_regclass('staff') IS NOT NULL THEN
    ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
    ALTER TABLE staff ADD CONSTRAINT staff_role_check
      CHECK (role IN ('FrontDesk', 'Bedding', 'Toiletry', 'Inspector'));
  END IF;
END $$;
