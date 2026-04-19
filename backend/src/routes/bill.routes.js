import express from 'express';
import { authenticateToken, requireCaptain } from '../middleware/auth.middleware.js';
import { createBillRequest, markBillDone, listBillRequests } from '../controllers/index.js';

const router = express.Router();

router.post('/', createBillRequest);
router.patch('/:id/done', authenticateToken, requireCaptain, markBillDone);
router.get('/', authenticateToken, requireCaptain, listBillRequests);

export default router;
