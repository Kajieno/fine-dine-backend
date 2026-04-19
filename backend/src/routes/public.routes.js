import express from 'express';
import { getPublicMenu } from '../controllers/index.js';

const router = express.Router();

router.get('/:brand_slug/:location_id/:table_id', getPublicMenu);

export default router;
