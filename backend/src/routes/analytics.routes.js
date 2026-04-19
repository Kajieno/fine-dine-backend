import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { analyticsOrders, analyticsCancellations, analyticsMenuPerformance, analyticsCaptainPerformance, analyticsOffersPerformance, analyticsExport } from '../controllers/index.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/orders', analyticsOrders);
router.get('/cancellations', analyticsCancellations);
router.get('/menu-performance', analyticsMenuPerformance);
router.get('/captain-performance', analyticsCaptainPerformance);
router.get('/offers-performance', analyticsOffersPerformance);
router.get('/export', analyticsExport);

export default router;
