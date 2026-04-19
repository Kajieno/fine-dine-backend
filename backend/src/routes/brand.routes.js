import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { getBrand, updateBrand } from '../controllers/index.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/', getBrand);
router.put('/', updateBrand);

export default router;
