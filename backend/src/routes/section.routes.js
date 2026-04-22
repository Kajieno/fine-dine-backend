import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
  toggleSection,
  assignTablesToSection,
} from '../controllers/index.js';

const router = Router();

// GET /api/sections/:locationId — list sections for a location (admin)
router.get('/:locationId', authenticateToken, requireAdmin, listSections);

// POST /api/sections/:locationId — create a section (admin)
router.post('/:locationId', authenticateToken, requireAdmin, createSection);

// PUT /api/sections/:id — update a section (admin)
router.put('/:id', authenticateToken, requireAdmin, updateSection);

// DELETE /api/sections/:id — delete a section (admin)
router.delete('/:id', authenticateToken, requireAdmin, deleteSection);

// PATCH /api/sections/:id/toggle — toggle section active/inactive (admin)
router.patch('/:id/toggle', authenticateToken, requireAdmin, toggleSection);

// POST /api/sections/:id/assign-tables — batch assign tables to section (admin)
router.post('/:id/assign-tables', authenticateToken, requireAdmin, assignTablesToSection);

export default router;
