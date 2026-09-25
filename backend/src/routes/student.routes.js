import { Router } from 'express';
import { createStudent, getStudent, updateStudent } from '../controllers/student.controller.js';
import { authenticate, requireOwnership } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/', createStudent);
router.get('/:id', authenticate, requireOwnership, getStudent);
router.patch('/:id', authenticate, requireOwnership, updateStudent);

export default router;
