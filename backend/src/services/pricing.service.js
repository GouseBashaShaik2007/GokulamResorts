/**
 * Room pricing.
 *
 *   per night:  rate (room type) − promotion (best rate_discount that night)
 *   booking:    − manager discount (on the post-promotion subtotal)
 *   tax:        GST per night on that night's value after all discounts:
 *               ≤ ₹7,500/night → 5%, above → 18%
 *   total:      taxable value + GST  (this is what the guest pays)
 *
 * Every booking stores its night-by-night breakdown (`nights_detail`) so
 * discounts and extensions can recompute tax per night later.
 */
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Hotel accommodation GST slabs (per night, on the value actually charged).
const GST_THRESHOLD = 7500;
const GST_RATE_LOW = 5;
const GST_RATE_HIGH = 18;
const gstRateFor = (nightValue) => (nightValue <= GST_THRESHOLD ? GST_RATE_LOW : GST_RATE_HIGH);

/**
 * Quote nights [fromDate, toDate) for a room type.
 * Returns { nightlyRate, nights, base, promo, promoDetails, nightsDetail }.
 * nightsDetail: [{ date, rate, promo }] — one entry per night.
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
    nightsDetail: rows.map((r) => ({ date: r.date, rate: nightlyRate, promo: Number(r.amount) })),
  };
}

// Manager discount on the post-promotion subtotal.
function manualDiscountAmount(subtotal, type, value) {
  if (!type || !value) return 0;
  const amount = type === 'percent' ? (subtotal * Number(value)) / 100 : Number(value);
  return round2(Math.min(subtotal, Math.max(0, amount)));
}

/**
 * Full price of a stay from its nights. The manager discount is spread across
 * nights in proportion to each night's value, then GST is worked out per night.
 * Returns { base, promo, subtotal, manual, taxable, tax, taxDetails, total }.
 * taxDetails: [{ rate, nights, taxable, tax }] grouped by GST rate.
 */
function priceStay({ nights, manualType = null, manualValue = null }) {
  const base = round2(nights.reduce((s, n) => s + Number(n.rate), 0));
  const promo = round2(nights.reduce((s, n) => s + Number(n.promo || 0), 0));
  const subtotal = round2(base - promo);
  const manual = manualDiscountAmount(subtotal, manualType, manualValue);
  const taxable = round2(subtotal - manual);
  const factor = subtotal > 0 ? taxable / subtotal : 0;

  // Night values after all discounts; the last night absorbs rounding so the
  // nights always add up to `taxable` exactly.
  let allocated = 0;
  const values = nights.map((n, i) => {
    const value = i === nights.length - 1 ? round2(taxable - allocated) : round2((n.rate - (n.promo || 0)) * factor);
    allocated = round2(allocated + value);
    return value;
  });

  const byRate = new Map();
  for (const value of values) {
    const rate = gstRateFor(value);
    const group = byRate.get(rate) || { rate, nights: 0, taxable: 0, tax: 0 };
    group.nights += 1;
    group.taxable = round2(group.taxable + value);
    group.tax = round2(group.tax + (value * rate) / 100);
    byRate.set(rate, group);
  }
  const taxDetails = [...byRate.values()].sort((a, b) => a.rate - b.rate);
  const tax = round2(taxDetails.reduce((s, g) => s + g.tax, 0));

  return { base, promo, subtotal, manual, taxable, tax, taxDetails, total: round2(taxable + tax) };
}

/** A booking row's nights. Older rows without a stored breakdown are rebuilt from their dates. */
function nightsOfBooking(b) {
  if (Array.isArray(b.nights_detail) && b.nights_detail.length > 0) return b.nights_detail;
  const promoByDate = Object.fromEntries((b.promo_details || []).map((p) => [p.date, Number(p.amount)]));
  const nights = [];
  for (let d = new Date(`${b.check_in}T00:00:00Z`); d < new Date(`${b.check_out}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    nights.push({ date, rate: Number(b.nightly_rate), promo: promoByDate[date] || 0 });
  }
  return nights;
}

module.exports = {
  GST_THRESHOLD,
  GST_RATE_LOW,
  GST_RATE_HIGH,
  gstRateFor,
  quoteNights,
  manualDiscountAmount,
  priceStay,
  nightsOfBooking,
  round2,
};
