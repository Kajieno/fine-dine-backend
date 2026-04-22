import express from 'express';
import {
  registerBrand,
  initiateSubscriptionPayment,
  paymobWebhook,
  getSubscriptionStatus,
  addBranchPayment,
  listBrands,
  activateBrand,
  suspendBrand,
} from '../controllers/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public - restaurant registration
router.post('/register', registerBrand);

// Public - Paymob webhook callback
router.post('/paymob/webhook', paymobWebhook);

// Public - initiate payment after registration
router.post('/initiate-payment', initiateSubscriptionPayment);

// Public - get subscription status for a brand
router.get('/status/:brandId', getSubscriptionStatus);

// Public - add branch (charges $29 via Paymob)
router.post('/add-branch/:brandId', addBranchPayment);

// Super Admin - list all brands
router.get('/brands', authenticateToken, requireAdmin, listBrands);

// Super Admin - activate/suspend brand
router.patch('/brands/:brandId/activate', authenticateToken, requireAdmin, activateBrand);
router.patch('/brands/:brandId/suspend', authenticateToken, requireAdmin, suspendBrand);

export default router;
