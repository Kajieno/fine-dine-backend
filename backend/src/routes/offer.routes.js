import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { listOffers, createOffer, updateOffer, deleteOffer, toggleOffer } from '../controllers/index.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/', listOffers);
router.post('/', createOffer);
router.put('/:id', updateOffer);
router.delete('/:id', deleteOffer);
router.patch('/:id/toggle', toggleOffer);

export default router;
