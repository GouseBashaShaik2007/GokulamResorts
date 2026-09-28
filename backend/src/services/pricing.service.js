/**
 * Room pricing. Nightly rate comes from the room type; standing promotions
 * (rate_discounts) are applied per night — when several match a night, the
 * largest discount wins (no stacking). A manager's booking-level discount is
 * applied on top, to the amount after promotions.
 */
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Quote nights [fromDate, toDate) for a room type.
 * Returns { nightlyRate, nights, base, promo, promoDetails }.
 */
async function quoteNights(client, roomTypeId, fromDate, toDate) {
  const { rows: typeRows } = await client.query(`SELECT price_per_night FROM rooms WHERE id = $1`, [roomTypeId]);
  if (typeRows.length === 0) throw new Error(`Unknown room type ${roomTypeId}`);
  const nightlyRate = Number(typeRows[0].price_per_night);

  const { rows } = await client.query(
    `SELECT n.night::date::text AS date, best.id AS rule_id, best.name, COALESCE(best.amount, 0) AS amount
     FROM generate_series($2::date, $3::date - 1, interval '1 day') AS n(night)
     LEFT JOIN LATERAL (
       SELECT rd.id, rd.name,
              LEAST($4::numeric,
                    CASE rd.discount_type WHEN 'percent' THEN round($4::numeric * rd.value / 100, 2)
                                          ELSE rd.value END) AS amount
       FROM rate_discounts rd
       WHERE rd.is_active
         AND (rd.room_type_id IS NULL OR rd.room_type_id = $1)
         AND n.night::date BETWEEN rd.start_date AND rd.end_date
       ORDER BY amount DESC, rd.id
       LIMIT 1
     ) best ON true
     ORDER BY n.night`,
    [roomTypeId, fromDate, toDate, nightlyRate]
  );

  const promoDetails = rows
    .filter((r) => Number(r.amount) > 0)
    .map((r) => ({ date: r.date, ruleId: r.rule_id, name: r.name, amount: Number(r.amount) }));

  return {
    nightlyRate,
    nights: rows.length,
    base: round2(nightlyRate * rows.length),
    promo: round2(promoDetails.reduce((s, p) => s + p.amount, 0)),
    promoDetails,
  };
}

// Manager discount on the post-promotion subtotal.
function manualDiscountAmount(subtotal, type, value) {
  if (!type || !value) return 0;
  const amount = type === 'percent' ? (subtotal * Number(value)) / 100 : Number(value);
  return round2(Math.min(subtotal, Math.max(0, amount)));
}

// Recomputes the money columns of a booking row from its parts.
function totals({ base, promo, manualType, manualValue }) {
  const subtotal = round2(base - promo);
  const manual = manualDiscountAmount(subtotal, manualType, manualValue);
  return { subtotal, manual, total: round2(Math.max(0, subtotal - manual)) };
}

module.exports = { quoteNights, manualDiscountAmount, totals, round2 };
