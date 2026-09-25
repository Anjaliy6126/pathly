import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Evaluates a student against an opportunity's eligibility and skill requirements.
 * 
 * @param {number} studentId - The ID of the student
 * @param {number} opportunityId - The ID of the opportunity
 * @returns {Promise<Object>} The evaluation result
 */
async function evaluateStudentOpportunity(studentId, opportunityId) {
  // Load the student profile and evidence
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      educations: true,
      skills: {
        include: {
          evidences: true,
          skill: true
        }
      }
    }
  });

  if (!student) throw new Error(`Student not found with ID ${studentId}`);

  // Load the opportunity and its requirements
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      skills: {
        include: {
          skill: true
        }
      },
      eligibilityRequirements: true
    }
  });

  if (!opportunity) throw new Error(`Opportunity not found with ID ${opportunityId}`);

  // Evaluate individual rules
  const { eligibilityPassed, eligibilityDetails, failedRequirements } = evaluateEligibility(student, opportunity.eligibilityRequirements);

  const { 
    requiredSkillsMatched, 
    requiredSkillsTotal, 
    preferredSkillsMatched, 
    preferredSkillsTotal, 
    missingRequiredSkills, 
    missingPreferredSkills,
    matchedRequiredSkillNames
  } = evaluateSkills(student, opportunity.skills);

  // Determine the fit category based on deterministic rules
  const fitCategory = determineFitCategory(failedRequirements.length > 0, requiredSkillsTotal, missingRequiredSkills.length);

  // Build a human-readable explanation of the result
  const explanation = buildExplanation(failedRequirements, missingRequiredSkills, matchedRequiredSkillNames, eligibilityPassed);

  const result = {
    studentId,
    opportunityId,
    eligibilityPassed,
    eligibilityDetails,
    requiredSkillsMatched,
    requiredSkillsTotal,
    preferredSkillsMatched,
    preferredSkillsTotal,
    missingRequiredSkills,
    missingPreferredSkills,
    fitCategory,
    explanation
  };

  // Persist the evaluation result safely in the database
  await prisma.studentOpportunityEvaluation.create({
    data: {
      studentId,
      opportunityId,
      eligibilityPassed,
      requiredSkillsMatched,
      requiredSkillsTotal,
      preferredSkillsMatched,
      preferredSkillsTotal,
      fitCategory,
      explanation
    }
  });

  return result;
}

/**
 * Evaluates the student's profile against opportunity eligibility requirements.
 */
function evaluateEligibility(student, requirements) {
  if (!requirements || requirements.length === 0) {
    return { eligibilityPassed: true, eligibilityDetails: [], failedRequirements: [] };
  }

  let hasFailed = false;
  const eligibilityDetails = [];
  const failedRequirements = [];

  for (const req of requirements) {
    let status = 'UNKNOWN'; // PASS, FAIL, UNKNOWN

    switch(req.type) {
      case 'MIN_CGPA':
        if (student.cgpa !== null && student.cgpa !== undefined) {
          status = parseFloat(student.cgpa) >= parseFloat(req.value) ? 'PASS' : 'FAIL';
        }
        break;
      case 'BRANCH':
        if (student.branch) {
          status = student.branch.toLowerCase().includes(req.value.toLowerCase()) ? 'PASS' : 'FAIL';
        }
        break;
      case 'MIN_YEAR':
        if (student.currentYear !== null && student.currentYear !== undefined) {
          status = parseInt(student.currentYear) >= parseInt(req.value) ? 'PASS' : 'FAIL';
        }
        break;
      case 'MAX_YEAR':
        if (student.currentYear !== null && student.currentYear !== undefined) {
          status = parseInt(student.currentYear) <= parseInt(req.value) ? 'PASS' : 'FAIL';
        }
        break;
      case 'DEGREE':
        if (student.educations && student.educations.length > 0) {
          const hasDegree = student.educations.some(edu => edu.degree.toLowerCase().includes(req.value.toLowerCase()));
          status = hasDegree ? 'PASS' : 'FAIL';
        }
        break;
      case 'GRADUATION_YEAR':
        if (student.educations && student.educations.length > 0) {
          const hasGradYear = student.educations.some(edu => edu.endYear && parseInt(edu.endYear) === parseInt(req.value));
          status = hasGradYear ? 'PASS' : 'FAIL';
        }
        break;
      case 'LOCATION':
        if (student.city) {
          status = student.city.toLowerCase().includes(req.value.toLowerCase()) ? 'PASS' : 'FAIL';
        }
        break;
      case 'OTHER':
        // Custom or unparseable natural language text
        status = 'UNKNOWN';
        break;
      default:
        status = 'UNKNOWN';
    }

    if (status === 'FAIL') {
      hasFailed = true;
      failedRequirements.push(req);
    }

    eligibilityDetails.push({
      requirement: req,
      status
    });
  }

  return {
    eligibilityPassed: !hasFailed,
    eligibilityDetails,
    failedRequirements
  };
}

/**
 * Evaluates the student's skills and evidence against opportunity requirements.
 */
function evaluateSkills(student, opportunitySkills) {
  let requiredSkillsMatched = 0;
  let requiredSkillsTotal = 0;
  let preferredSkillsMatched = 0;
  let preferredSkillsTotal = 0;
  const missingRequiredSkills = [];
  const missingPreferredSkills = [];
  const matchedRequiredSkillNames = [];

  if (!opportunitySkills) {
    return {
      requiredSkillsMatched, requiredSkillsTotal, preferredSkillsMatched, preferredSkillsTotal, missingRequiredSkills, missingPreferredSkills, matchedRequiredSkillNames
    };
  }

  for (const oppSkill of opportunitySkills) {
    const studentSkill = (student.skills || []).find(s => s.skillId === oppSkill.skillId);
    // Skill is supported ONLY if there's actual evidence provided
    const hasEvidence = studentSkill && studentSkill.evidences && studentSkill.evidences.length > 0;
    
    if (oppSkill.isRequired) {
      requiredSkillsTotal++;
      if (hasEvidence) {
        requiredSkillsMatched++;
        if (oppSkill.skill && oppSkill.skill.name) matchedRequiredSkillNames.push(oppSkill.skill.name);
      } else {
        missingRequiredSkills.push(oppSkill);
      }
    } else {
      preferredSkillsTotal++;
      if (hasEvidence) {
        preferredSkillsMatched++;
      } else {
        missingPreferredSkills.push(oppSkill);
      }
    }
  }

  return {
    requiredSkillsMatched,
    requiredSkillsTotal,
    preferredSkillsMatched,
    preferredSkillsTotal,
    missingRequiredSkills,
    missingPreferredSkills,
    matchedRequiredSkillNames
  };
}

/**
 * Categorizes the fit based on hard deterministic rules.
 */
function determineFitCategory(hasEligibilityFailure, requiredSkillsTotal, missingRequiredSkillsCount) {
  // Any known FAILED eligibility immediately makes it a FUTURE target.
  if (hasEligibilityFailure) {
    return 'FUTURE';
  }

  const missingRatio = requiredSkillsTotal > 0 ? (missingRequiredSkillsCount / requiredSkillsTotal) : 0;

  if (missingRatio >= 0.5) {
    // Missing half or more of required skills -> FUTURE target
    return 'FUTURE';
  } else if (missingRequiredSkillsCount > 0) {
    // Missing less than half, addressable gap -> STRETCH target
    return 'STRETCH';
  } else {
    // Satisfies all required skills & no failed eligibility -> READY_NOW
    return 'READY_NOW';
  }
}

/**
 * Generates an explainable human-readable text result based entirely on deterministic facts.
 */
function buildExplanation(failedRequirements, missingRequiredSkills, matchedRequiredSkillNames, eligibilityPassed) {
  let explanation = '';

  if (failedRequirements.length > 0) {
    const types = failedRequirements.map(r => r.type).join(', ');
    explanation += `Failed eligibility requirements: ${types}. `;
  } else {
    explanation += `Eligible based on the available profile information. `;
  }

  if (matchedRequiredSkillNames.length > 0) {
    explanation += `Required skills matched with evidence: ${matchedRequiredSkillNames.join(', ')}. `;
  }

  if (missingRequiredSkills.length > 0) {
    const missingNames = missingRequiredSkills.map(s => (s.skill && s.skill.name) ? s.skill.name : 'Unknown').join(', ');
    explanation += `Missing evidence for required skills: ${missingNames}.`;
  } else if (matchedRequiredSkillNames.length > 0) {
    explanation += `All required skills are satisfied.`;
  }

  return explanation.trim();
}

export {
  evaluateStudentOpportunity,
  evaluateEligibility,
  evaluateSkills,
  determineFitCategory,
  buildExplanation
};
