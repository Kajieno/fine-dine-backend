import { Router } from 'express';
import { authenticateToken, requireCaptain } from '../middleware/auth.middleware.js';
import {
  getCaptainSections,
  startCaptainSession,
  getActiveSession,
  endCaptainSession,
  getCaptainSessionHistory,
  getCaptainOrders,
} from '../controllers/index.js';

const router = Router();

// GET /api/captain/sections - get available sections for captain's location
router.get('/sections', authenticateToken, requireCaptain, getCaptainSections);

// POST /api/captain/session/start - start a session by choosing a section
router.post('/session/start', authenticateToken, requireCaptain, startCaptainSession);

// GET /api/captain/session/active - get current active session
router.get('/session/active', authenticateToken, requireCaptain, getActiveSession);

// POST /api/captain/session/end - end current active session
router.post('/session/end', authenticateToken, requireCaptain, endCaptainSession);

// GET /api/captain/session/history - get session history
router.get('/session/history', authenticateToken, requireCaptain, getCaptainSessionHistory);

// GET /api/captain/orders - get orders for active session's section
router.get('/orders', authenticateToken, requireCaptain, getCaptainOrders);

export default router;
