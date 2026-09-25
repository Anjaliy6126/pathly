import { Router } from 'express';
import { evaluate } from '../controllers/matching.controller.js';

const router = Router();

router.post('/evaluate', evaluate);

export default router;
