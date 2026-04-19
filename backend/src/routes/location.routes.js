import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { listLocations, createLocation, updateLocation, deleteLocation, toggleLocation } from '../controllers/index.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/', listLocations);
router.post('/', createLocation);
router.put('/:id', updateLocation);
router.delete('/:id', deleteLocation);
router.patch('/:id/toggle', toggleLocation);

export default router;
