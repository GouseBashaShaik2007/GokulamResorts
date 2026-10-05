/**
 * Background jobs (resort timezone):
 *   every 2 min   expire unpaid holds + unapproved paid bookings (auto refund)
 *   every minute  retry guest messages still in the outbox
 *   every 5 min   close online food payments nobody completed (refund any paid late)
 *   11 PM         cleaning safety net for check-outs without a cleaning job
 *   3:30 AM       delete ID documents past the retention period, and photos
 *                 of room problems resolved more than a month ago
 *   6:15 AM       refresh display exchange rates (and once at startup)
 */
const cron = require('node-cron');
const { TIMEZONE } = require('../utils/dates');
const bookings = require('../services/booking.service');
const notify = require('../services/notify.service');
const { scheduleNightlyCleaning } = require('./nightlyCleaning');
const fx = require('../services/fx.service');
const roomIssues = require('../controllers/roomIssue.controller');
const checkouts = require('../controllers/checkout.controller');

function every(schedule, name, fn) {
  let running = false;
  cron.schedule(
    schedule,
    async () => {
      if (running) return; // don't overlap slow runs
      running = true;
      try {
        const result = await fn();
        if (result && Object.values(result).some((v) => v)) console.log(`[jobs] ${name}:`, result);
      } catch (err) {
        console.error(`[jobs] ${name} failed:`, err);
      } finally {
        running = false;
      }
    },
    { timezone: TIMEZONE }
  );
}

function startScheduler() {
  every('*/2 * * * *', 'expire holds', () => bookings.expireHolds());
  every('* * * * *', 'notification retry', () => notify.flush());
  every('*/5 * * * *', 'online food payments', () => checkouts.sweepStaleCheckouts());
  every(process.env.DOC_PURGE_CRON || '30 3 * * *', 'purge ID documents', async () => ({
    purged: await bookings.purgeExpiredDocuments(),
  }));
  every(process.env.DOC_PURGE_CRON || '30 3 * * *', 'purge room problem photos', async () => ({
    purged: await roomIssues.purgeOldPhotos(),
  }));
  every('15 6 * * *', 'exchange rates', () => fx.refreshRates());
  fx.refreshRates(); // don't wait until tomorrow morning after a restart

  // A host that sleeps when idle (Render's free plan) is rarely awake at
  // 3:30 AM, so the deletion guests are promised also runs shortly after every
  // start. Safe to repeat: it only touches files already past the retention period.
  setTimeout(() => {
    bookings
      .purgeExpiredDocuments()
      .then((purged) => purged && console.log('[jobs] purge ID documents (after start):', { purged }))
      .catch((err) => console.error('[jobs] purge ID documents (after start) failed:', err));
  }, 30 * 1000).unref();
  scheduleNightlyCleaning();
  console.log(`[jobs] scheduler started (${TIMEZONE}); ID documents kept ${bookings.RETENTION_DAYS} days after the stay`);
}

module.exports = { startScheduler };
