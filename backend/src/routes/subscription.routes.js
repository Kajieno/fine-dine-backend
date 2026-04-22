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
import { authSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public - restaurant registration
router.post('/register', registerBrand);

// Public - Paymob webhook callback
router.post('/paymob/webhook', paymobWebhook);

// Protected - initiate payment after registration
router.post('/initiate-payment', initiateSubscriptionPayment);

// Protected - get subscription status for a brand
router.get('/status/:brandId', authSuperAdmin, getSubscriptionStatus);

// Protected - add branch (charges $29 via Paymob)
router.post('/add-branch/:brandId', addBranchPayment);

// Super Admin - list all brands
router.get('/brands', authSuperAdmin, listBrands);

// Super Admin - activate/suspend brand
router.patch('/brands/:brandId/activate', authSuperAdmin, activateBrand);
router.patch('/brands/:brandId/suspend', authSuperAdmin, suspendBrand);

export default router;
