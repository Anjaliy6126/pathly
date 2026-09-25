import { Router } from 'express';
import { createStudent, getStudent, updateStudent } from '../controllers/student.controller.js';

const router = Router();

router.post('/', createStudent);
router.get('/:id', getStudent);
router.patch('/:id', updateStudent);

export default router;
