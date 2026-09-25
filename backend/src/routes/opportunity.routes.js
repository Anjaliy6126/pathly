import { Router } from 'express';
import {
  getOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  deactivateOpportunity,
  getOpportunitySkills,
  addOpportunitySkill,
  updateOpportunitySkill,
  removeOpportunitySkill,
  getEligibilityRequirements,
  addEligibilityRequirement,
  updateEligibilityRequirement,
  deleteEligibilityRequirement,
  getOpportunityCycles,
  getOpportunityCycle,
  createOpportunityCycle,
  updateOpportunityCycle,
  deleteOpportunityCycle,
  getCycleVerifications,
  addCycleVerification,
  getLatestCycleVerification
} from '../controllers/opportunity.controller.js';

const router = Router();

// --- Opportunity Core ---
router.get('/', getOpportunities);
router.post('/', createOpportunity);
router.get('/:opportunityId', getOpportunity);
router.patch('/:opportunityId', updateOpportunity);
router.patch('/:opportunityId/status', deactivateOpportunity);

// --- Opportunity Skills ---
router.get('/:opportunityId/skills', getOpportunitySkills);
router.post('/:opportunityId/skills', addOpportunitySkill);
router.patch('/:opportunityId/skills/:opportunitySkillId', updateOpportunitySkill);
router.delete('/:opportunityId/skills/:opportunitySkillId', removeOpportunitySkill);

// --- Opportunity Eligibility ---
router.get('/:opportunityId/eligibility', getEligibilityRequirements);
router.post('/:opportunityId/eligibility', addEligibilityRequirement);
router.patch('/:opportunityId/eligibility/:eligibilityId', updateEligibilityRequirement);
router.delete('/:opportunityId/eligibility/:eligibilityId', deleteEligibilityRequirement);

// --- Opportunity Cycles ---
router.get('/:opportunityId/cycles', getOpportunityCycles);
router.get('/:opportunityId/cycles/:cycleId', getOpportunityCycle);
router.post('/:opportunityId/cycles', createOpportunityCycle);
router.patch('/:opportunityId/cycles/:cycleId', updateOpportunityCycle);
router.delete('/:opportunityId/cycles/:cycleId', deleteOpportunityCycle);

// --- Opportunity Cycle Verifications ---
router.get('/:opportunityId/cycles/:cycleId/verifications', getCycleVerifications);
router.post('/:opportunityId/cycles/:cycleId/verifications', addCycleVerification);
router.get('/:opportunityId/cycles/:cycleId/verification', getLatestCycleVerification);

export default router;
