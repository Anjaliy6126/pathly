import { Router } from 'express';
import { createStudent, getStudent, updateStudent, getCapabilityProfile } from '../controllers/student.controller.js';
import {
  createBookmark,
  deleteBookmark,
  getBookmarks,
  checkBookmark,
  createApplication,
  updateApplication,
  getApplications,
  getApplication,
  deleteApplication
} from '../controllers/student-action.controller.js';
import { authenticate, requireOwnership } from '../middleware/auth.middleware.js';
import { getStudentMatchedOpportunities } from '../controllers/matching.controller.js';

const router = Router();

router.post('/', createStudent);
router.get('/:id', authenticate, requireOwnership, getStudent);
router.patch('/:id', authenticate, requireOwnership, updateStudent);

// Bookmarks
router.post('/:studentId/bookmarks', authenticate, requireOwnership, createBookmark);
router.get('/:studentId/bookmarks', authenticate, requireOwnership, getBookmarks);
router.get('/:studentId/bookmarks/:opportunityId', authenticate, requireOwnership, checkBookmark);
router.delete('/:studentId/bookmarks/:bookmarkId', authenticate, requireOwnership, deleteBookmark);

// Applications
router.post('/:studentId/applications', authenticate, requireOwnership, createApplication);
router.get('/:studentId/applications', authenticate, requireOwnership, getApplications);
router.get('/:studentId/applications/:applicationId', authenticate, requireOwnership, getApplication);
router.patch('/:studentId/applications/:applicationId', authenticate, requireOwnership, updateApplication);
router.delete('/:studentId/applications/:applicationId', authenticate, requireOwnership, deleteApplication);

router.get('/:studentId/matching/opportunities', authenticate, requireOwnership, getStudentMatchedOpportunities);
router.get('/:studentId/capability-profile', authenticate, requireOwnership, getCapabilityProfile);

export default router;
