import express from 'express';
import { adminLogin, captainLogin, superAdminLogin } from '../controllers/index.js';

const router = express.Router();

router.post('/admin/login', adminLogin);
router.post('/captain/login', captainLogin);
router.post('/superadmin/login', superAdminLogin);

export default router;
