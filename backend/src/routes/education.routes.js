import { Router } from 'express';
import {
  getEducation,
  createEducation,
  updateEducation,
  deleteEducation
} from '../controllers/education.controller.js';

const router = Router();

router.get('/:studentId/education', getEducation);
router.post('/:studentId/education', createEducation);
router.patch('/:studentId/education/:educationId', updateEducation);
router.delete('/:studentId/education/:educationId', deleteEducation);

export default router;
