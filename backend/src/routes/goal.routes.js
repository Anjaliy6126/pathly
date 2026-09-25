import { Router } from 'express';
import {
  getGoals,
  getStudentGoals,
  addStudentGoal,
  removeStudentGoal
} from '../controllers/goal.controller.js';

const router = Router();

router.get('/goals', getGoals);
router.get('/students/:studentId/goals', getStudentGoals);
router.post('/students/:studentId/goals', addStudentGoal);
router.delete('/students/:studentId/goals/:studentGoalId', removeStudentGoal);

export default router;
