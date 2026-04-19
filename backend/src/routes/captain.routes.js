import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { listCaptains, createCaptain, updateCaptain, deleteCaptain, toggleCaptain } from '../controllers/index.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/', listCaptains);
router.post('/', createCaptain);
router.put('/:id', updateCaptain);
router.delete('/:id', deleteCaptain);
router.patch('/:id/toggle', toggleCaptain);

export default router;
