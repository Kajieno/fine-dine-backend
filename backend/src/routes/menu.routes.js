import express from 'express';
import multer from 'multer';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { listMenus, createMenu, updateMenu, deleteMenu, uploadMenu, listCategories, createCategory, updateCategory, deleteCategory, listItems, createItem, updateItem, deleteItem, toggleItem } from '../controllers/index.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(authenticateToken, requireAdmin);

router.get('/', listMenus);
router.post('/', createMenu);
router.put('/:id', updateMenu);
router.delete('/:id', deleteMenu);
router.post('/upload', upload.single('file'), uploadMenu);
router.get('/:id/categories', listCategories);
router.post('/:id/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.get('/categories/:id/items', listItems);
router.post('/categories/:id/items', createItem);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);
router.patch('/items/:id/toggle', toggleItem);

export default router;
