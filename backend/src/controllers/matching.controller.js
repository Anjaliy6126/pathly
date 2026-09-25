import { evaluateStudentOpportunity } from '../services/matching.service.js';

export const evaluate = async (req, res) => {
  try {
    const { studentId, opportunityId } = req.body;

    // Validate that both values exist, are integers, and are greater than 0
    if (!studentId || !opportunityId || !Number.isInteger(studentId) || !Number.isInteger(opportunityId) || studentId <= 0 || opportunityId <= 0) {
      return res.status(400).json({
        success: false,
        message: "studentId and opportunityId must be positive integers."
      });
    }

    // Call the matching service
    const evaluationResult = await evaluateStudentOpportunity(studentId, opportunityId);

    // On successful evaluation, return HTTP 200
    return res.status(200).json({
      success: true,
      data: evaluationResult
    });

  } catch (error) {
    console.error('Error in evaluate controller:', error);

    // If the service threw a "not found" error, return 404
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: "Student or opportunity not found."
      });
    }

    // Unexpected server errors
    return res.status(500).json({
      success: false,
      message: "Failed to evaluate student opportunity."
    });
  }
};

export const getStudentMatchedOpportunities = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Authorization check is assumed to be handled by middleware (req.user)
    // but just in case, we also check if the student exists
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const student = await prisma.student.findUnique({ where: { id: parseInt(studentId, 10) } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const {
      fitCategory,
      type,
      workMode,
      location,
      skill,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum <= 0) return res.status(400).json({ success: false, message: 'Invalid page' });
    if (isNaN(limitNum) || limitNum <= 0) return res.status(400).json({ success: false, message: 'Invalid limit' });
    
    if (fitCategory && !['READY_NOW', 'STRETCH', 'FUTURE'].includes(fitCategory)) {
      return res.status(400).json({ success: false, message: 'Invalid fitCategory' });
    }

    const maxLimit = Math.min(limitNum, 100);
    const skip = (pageNum - 1) * maxLimit;

    const filters = { isActive: true };

    const validTypes = ['INTERNSHIP', 'JOB', 'HACKATHON', 'SCHOLARSHIP', 'COMPETITION', 'OPEN_SOURCE', 'OTHER'];
    if (type) {
      if (!validTypes.includes(type)) return res.status(400).json({ success: false, message: 'Invalid type' });
      filters.type = type;
    }

    if (workMode) {
      if (!['REMOTE', 'ONSITE', 'HYBRID'].includes(workMode)) return res.status(400).json({ success: false, message: 'Invalid workMode' });
      filters.workMode = workMode;
    }

    if (location) {
      filters.location = { contains: location, mode: 'insensitive' };
    }

    if (skill) {
      filters.skills = { some: { skill: { name: { equals: skill, mode: 'insensitive' } } } };
    }

    const validStatuses = ['OPEN', 'UPCOMING', 'CLOSED', 'CANCELLED', 'UNKNOWN'];
    if (status) {
      if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
      filters.cycles = { some: { status } };
    }

    // Paginate candidate opportunities FIRST as requested
    const opportunities = await prisma.opportunity.findMany({
      where: filters,
      skip,
      take: maxLimit,
      include: {
        cycles: true
      },
      orderBy: { id: 'desc' }
    });

    const total = await prisma.opportunity.count({ where: filters });
    const totalPages = Math.ceil(total / maxLimit);

    if (opportunities.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          studentId: parseInt(studentId, 10),
          opportunities: [],
          pagination: { page: pageNum, limit: maxLimit, total, totalPages }
        }
      });
    }

    // Evaluate each opportunity in the page
    const evaluatedResults = [];
    for (const opp of opportunities) {
      const evaluation = await evaluateStudentOpportunity(parseInt(studentId, 10), opp.id);
      
      // Post-evaluation filter if fitCategory is provided
      if (fitCategory && evaluation.fitCategory !== fitCategory) {
        continue;
      }
      
      const { cycles, ...cleanOpp } = opp;
      
      evaluatedResults.push({
        opportunity: cleanOpp,
        match: {
          fitCategory: evaluation.fitCategory,
          eligibilityPassed: evaluation.eligibilityPassed,
          requiredSkillsMatched: evaluation.requiredSkillsMatched,
          requiredSkillsTotal: evaluation.requiredSkillsTotal,
          preferredSkillsMatched: evaluation.preferredSkillsMatched,
          preferredSkillsTotal: evaluation.preferredSkillsTotal,
          missingRequiredSkills: evaluation.missingRequiredSkills.map(s => s.skill?.name || 'Unknown'),
          missingPreferredSkills: evaluation.missingPreferredSkills.map(s => s.skill?.name || 'Unknown'),
          explanation: evaluation.explanation
        }
      });
    }

    // Sort evaluated results
    const fitOrder = { 'READY_NOW': 1, 'STRETCH': 2, 'FUTURE': 3 };
    evaluatedResults.sort((a, b) => {
      const catDiff = fitOrder[a.match.fitCategory] - fitOrder[b.match.fitCategory];
      if (catDiff !== 0) return catDiff;
      // Fallback to opportunity id
      return b.opportunity.id - a.opportunity.id;
    });

    return res.status(200).json({
      success: true,
      data: {
        studentId: parseInt(studentId, 10),
        opportunities: evaluatedResults,
        pagination: {
          page: pageNum,
          limit: maxLimit,
          total,
          totalPages
        }
      }
    });

  } catch (error) {
    console.error('Error in matching discovery:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch matched opportunities."
    });
  }
};
