import { Router } from 'express';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  addProjectSkill,
  getProjectSkills,
  removeProjectSkill
} from '../controllers/project.controller.js';
import { authenticate, requireOwnership } from '../middleware/auth.middleware.js';

const router = Router();

router.use('/:studentId', authenticate, requireOwnership);

router.get('/:studentId/projects', getProjects);
router.post('/:studentId/projects', createProject);
router.patch('/:studentId/projects/:projectId', updateProject);
router.delete('/:studentId/projects/:projectId', deleteProject);

router.post('/:studentId/projects/:projectId/skills', addProjectSkill);
router.get('/:studentId/projects/:projectId/skills', getProjectSkills);
router.delete('/:studentId/projects/:projectId/skills/:projectSkillId', removeProjectSkill);

export default router;
