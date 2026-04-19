import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { listTables, createTable, getTableQr, regenerateTableQr, deleteTable } from '../controllers/index.js';

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get('/', listTables);
router.post('/', createTable);
router.get('/:id/qr', getTableQr);
router.post('/:id/regenerate-qr', regenerateTableQr);
router.delete('/:id', deleteTable);

export default router;
