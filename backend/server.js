require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const roomsRoutes = require('./src/routes/rooms.routes');
const bookingRoutes = require('./src/routes/booking.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const adminRoutes = require('./src/routes/admin.routes');
const contactRoutes = require('./src/routes/contact.routes');
const menuRoutes = require('./src/routes/menu.routes');
const foodOrderRoutes = require('./src/routes/foodOrder.routes');
const kitchenRoutes = require('./src/routes/kitchen.routes');
const staffRoutes = require('./src/routes/staff.routes');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const { initRealtime } = require('./src/realtime');
const { startScheduler } = require('./src/jobs/scheduler');
const deskRoutes = require('./src/routes/desk.routes');
const siteRoutes = require('./src/routes/site.routes');

const app = express();

// Behind a hosting proxy (Render, a load balancer) the visitor's address
// arrives in X-Forwarded-For. Unless Express is told to trust that proxy,
// every request appears to come from the proxy itself — and all visitors then
// share one rate-limit bucket, so one person can lock everyone out.
// TRUST_PROXY is the number of proxies in front of the app: 1 on Render.
// Defaults to 1 in production and off locally.
const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// --- Security & core middleware ---
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Keep the raw body too: Razorpay webhooks are signed over the exact bytes.
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// --- Health check ---
app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// Approximate display rates for the currency switcher (charges are always INR).
app.get('/api/fx', (req, res) => {
  const rates = require('./src/services/fx.service').getRates();
  res.set('Cache-Control', 'public, max-age=3600').json({ success: true, fx: rates });
});

// --- API routes ---
app.use('/api/rooms', roomsRoutes);
app.use('/api', bookingRoutes); // /api/availability, /api/book-room, /api/bookings/lookup
app.use('/api', paymentRoutes); // /api/create-order, /api/verify-payment, /api/razorpay/webhook
app.use('/api/admin', adminRoutes); // /api/admin/login, /api/admin/add-room, ...
app.use('/api/contact', contactRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api', siteRoutes); // /api/site-info, /api/offers
app.use('/api', foodOrderRoutes); // /api/order-access, /api/food-orders, /api/food-orders/:token, /api/table-requests
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/desk', deskRoutes); // front desk (and managers): check-in/out, counter bookings, IDs
app.use('/api/staff', staffRoutes); // housekeeping staff login + task actions

// --- 404 + error handling ---
app.use(notFound);
app.use(errorHandler);

// HTTP server shared by Express and Socket.IO (housekeeping live updates).
const server = http.createServer(app);
initRealtime(server, allowedOrigins);
startScheduler();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Gokulam Resorts API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
