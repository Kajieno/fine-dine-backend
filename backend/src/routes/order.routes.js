import express from 'express';
import { authenticateToken, requireCaptain } from '../middleware/auth.middleware.js';
import { createOrder, updateOrder, cancelOrder, acceptOrder, getOrder, listOrders } from '../controllers/index.js';

const router = express.Router();

router.post('/', createOrder);
router.patch('/:id', updateOrder);
router.patch('/:id/cancel', cancelOrder);
router.patch('/:id/accept', authenticateToken, requireCaptain, acceptOrder);
router.get('/:id', getOrder);
router.get('/', authenticateToken, requireCaptain, listOrders);

export default router;
