import { Router } from 'express';
import {
  getStudentSkills,
  addStudentSkill,
  removeStudentSkill,
  addSkillEvidence,
  getSkillEvidence,
  removeSkillEvidence
} from '../controllers/skill.controller.js';
import { authenticate, requireOwnership } from '../middleware/auth.middleware.js';

const router = Router();

router.use('/:studentId', authenticate, requireOwnership);

router.get('/:studentId/skills', getStudentSkills);
router.post('/:studentId/skills', addStudentSkill);
router.delete('/:studentId/skills/:studentSkillId', removeStudentSkill);

router.post('/:studentId/skills/:studentSkillId/evidence', addSkillEvidence);
router.get('/:studentId/skills/:studentSkillId/evidence', getSkillEvidence);
router.delete('/:studentId/skills/:studentSkillId/evidence/:evidenceId', removeSkillEvidence);

export default router;
