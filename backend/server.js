eimport express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initSocket } from './src/socket/socket.handler.js';
import authRoutes from './src/routes/auth.routes.js';
import brandRoutes from './src/routes/brand.routes.js';
import locationRoutes from './src/routes/location.routes.js';
import menuRoutes from './src/routes/menu.routes.js';
import tableRoutes from './src/routes/table.routes.js';
import captainRoutes from './src/routes/captain.routes.js';
import offerRoutes from './src/routes/offer.routes.js';
import orderRoutes from './src/routes/order.routes.js';
import billRoutes from './src/routes/bill.routes.js';
import analyticsRoutes from './src/routes/analytics.routes.js';
import publicRoutes from './src/routes/public.routes.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : null);
app.use(cors({ origin: allowedOrigins || '*', credentials: true }));

app.get('/', (req, res) => {
  res.json({
    status: "ok",
    message: "Fine Dine API is running",
    version: "1.0.0",
    timestamp: new Date()
  });
});

app.use('/api', authRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/captains', captainRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bill-request', billRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/menu', publicRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(err);
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);
initSocket(server);

server.listen(port, () => {
  console.log(`Fine Dine backend listening on port ${port}`);
});
