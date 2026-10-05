// GST on a hotel room, charged per night on that night's price after any
// offer: 5% up to ₹7,500 a night, 18% above. A booking is always priced by the
// API (backend/src/services/pricing.service.js) — this copy is only for
// previews, and must be kept in step with it.
export const GST_THRESHOLD = 7500;

export const gstRateFor = (nightPrice) => (nightPrice <= GST_THRESHOLD ? 5 : 18);

/** What the guest pays for one night at this price, GST included. */
export const withGst = (nightPrice) => Math.round(nightPrice * (100 + gstRateFor(nightPrice))) / 100;
