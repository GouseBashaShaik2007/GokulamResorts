/**
 * 11 PM safety net for housekeeping: check-out normally creates the cleaning
 * job immediately; this catches any checked-out stay that still has none.
 * Safe to run more than once: one job per stay is enforced in the DB.
 */
const cron = require('node-cron');
const { generateNightlyJobs, TIMEZONE } = require('../services/cleaning.service');
const { emitJobUpdate } = require('../realtime');

const SCHEDULE = process.env.CLEANING_CRON || '0 23 * * *';

async function runNightlyCleaning() {
  const { date, jobs } = await generateNightlyJobs();
  console.log(`[cleaning] nightly run for ${date}: ${jobs.length} job(s) created`);
  for (const job of jobs) emitJobUpdate(job.id, 'job_created');
  return { date, jobs };
}

function scheduleNightlyCleaning() {
  if (!cron.validate(SCHEDULE)) {
    console.error(`[cleaning] invalid CLEANING_CRON "${SCHEDULE}" — nightly run disabled`);
    return;
  }
  cron.schedule(
    SCHEDULE,
    () => runNightlyCleaning().catch((err) => console.error('[cleaning] nightly run failed:', err)),
    { timezone: TIMEZONE }
  );
  console.log(`[cleaning] nightly job generation scheduled "${SCHEDULE}" (${TIMEZONE})`);
}

module.exports = { scheduleNightlyCleaning, runNightlyCleaning };
