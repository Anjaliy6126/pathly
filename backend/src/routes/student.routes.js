import { Router } from 'express';
import { createStudent, getStudent, updateStudent } from '../controllers/student.controller.js';
import { authenticate, requireOwnership } from '../middleware/auth.middleware.js';
import { getStudentMatchedOpportunities } from '../controllers/matching.controller.js';

const router = Router();

router.post('/', createStudent);
router.get('/:id', authenticate, requireOwnership, getStudent);
router.patch('/:id', authenticate, requireOwnership, updateStudent);

router.get('/:studentId/matching/opportunities', authenticate, requireOwnership, getStudentMatchedOpportunities);

export default router;
