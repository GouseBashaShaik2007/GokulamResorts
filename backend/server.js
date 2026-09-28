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

const app = express();

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

// --- API routes ---
app.use('/api/rooms', roomsRoutes);
app.use('/api', bookingRoutes); // /api/availability, /api/book-room, /api/bookings/lookup
app.use('/api', paymentRoutes); // /api/create-order, /api/verify-payment, /api/razorpay/webhook
app.use('/api/admin', adminRoutes); // /api/admin/login, /api/admin/add-room, ...
app.use('/api/contact', contactRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api', foodOrderRoutes); // /api/food-orders, /api/food-orders/:id
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
