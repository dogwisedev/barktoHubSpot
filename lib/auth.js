// lib/auth.js
// CRON_SECRET: Vercel sends it automatically on cron calls as "Authorization: Bearer <CRON_SECRET>".
// BB_KEY: the Bark Buster key pasted into the extension popup (people allowed to control auto-buy).

const isCron = (req) => !!process.env.CRON_SECRET &&
  (req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` || req.query?.secret === process.env.CRON_SECRET);

const isBB = (req) => !!process.env.BB_KEY && req.headers["x-bb-key"] === process.env.BB_KEY;

module.exports = { isCron, isBB };
