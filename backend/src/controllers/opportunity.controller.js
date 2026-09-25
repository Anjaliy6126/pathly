import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ================= OPPORTUNITIES =================

export const getOpportunities = async (req, res) => {
  try {
    const {
      keyword,
      type,
      workMode,
      location,
      organization,
      skill,
      requiredSkill,
      preferredSkill,
      deadlineFrom,
      deadlineTo,
      status,
      verificationStatus,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum <= 0) return res.status(400).json({ success: false, error: 'Invalid page' });
    if (isNaN(limitNum) || limitNum <= 0) return res.status(400).json({ success: false, error: 'Invalid limit' });
    const maxLimit = Math.min(limitNum, 100);
    const skip = (pageNum - 1) * maxLimit;

    const filters = { isActive: true };

    if (keyword) {
      filters.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { organization: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } }
      ];
    }

    const validTypes = ['INTERNSHIP', 'JOB', 'HACKATHON', 'SCHOLARSHIP', 'COMPETITION', 'OPEN_SOURCE', 'OTHER'];
    if (type) {
      if (!validTypes.includes(type)) return res.status(400).json({ success: false, error: 'Invalid type' });
      filters.type = type;
    }

    if (workMode) {
      if (!['REMOTE', 'ONSITE', 'HYBRID'].includes(workMode)) return res.status(400).json({ success: false, error: 'Invalid workMode' });
      filters.workMode = workMode;
    }

    if (location) {
      filters.location = { contains: location, mode: 'insensitive' };
    }

    if (organization) {
      filters.organization = { contains: organization, mode: 'insensitive' };
    }

    const skillFilters = [];
    if (skill) {
      skillFilters.push({ skills: { some: { skill: { name: { equals: skill, mode: 'insensitive' } } } } });
    }
    if (requiredSkill) {
      skillFilters.push({ skills: { some: { isRequired: true, skill: { name: { equals: requiredSkill, mode: 'insensitive' } } } } });
    }
    if (preferredSkill) {
      skillFilters.push({ skills: { some: { isRequired: false, skill: { name: { equals: preferredSkill, mode: 'insensitive' } } } } });
    }
    if (skillFilters.length > 0) {
      filters.AND = filters.AND || [];
      filters.AND.push(...skillFilters);
    }

    const validStatuses = ['OPEN', 'UPCOMING', 'CLOSED', 'CANCELLED', 'UNKNOWN'];
    if (status) {
      if (!validStatuses.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    let parsedDeadlineFrom = null;
    let parsedDeadlineTo = null;
    if (deadlineFrom) {
      parsedDeadlineFrom = new Date(deadlineFrom);
      if (isNaN(parsedDeadlineFrom.getTime())) return res.status(400).json({ success: false, error: 'Invalid deadlineFrom date format' });
    }
    if (deadlineTo) {
      parsedDeadlineTo = new Date(deadlineTo);
      if (isNaN(parsedDeadlineTo.getTime())) return res.status(400).json({ success: false, error: 'Invalid deadlineTo date format' });
    }

    if (status || parsedDeadlineFrom || parsedDeadlineTo) {
      const cycleCondition = {};
      if (status) cycleCondition.status = status;
      if (parsedDeadlineFrom || parsedDeadlineTo) {
        cycleCondition.applicationDeadline = {};
        if (parsedDeadlineFrom) cycleCondition.applicationDeadline.gte = parsedDeadlineFrom;
        if (parsedDeadlineTo) cycleCondition.applicationDeadline.lte = parsedDeadlineTo;
      }
      filters.cycles = { some: cycleCondition };
    }

    const validVerifications = ['VERIFIED', 'FAILED', 'NEEDS_REVIEW'];
    if (verificationStatus) {
      if (!validVerifications.includes(verificationStatus)) return res.status(400).json({ success: false, error: 'Invalid verificationStatus' });
      
      const oppsWithVerifications = await prisma.opportunity.findMany({
        where: { isActive: true },
        select: {
          id: true,
          verifications: {
            orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
            take: 1
          }
        }
      });
      
      const matchingOppIds = oppsWithVerifications
        .filter(opp => opp.verifications.length > 0 && opp.verifications[0].status === verificationStatus)
        .map(opp => opp.id);
        
      if (matchingOppIds.length === 0) {
         return res.status(200).json({
            success: true,
            data: { opportunities: [], pagination: { page: pageNum, limit: maxLimit, total: 0, totalPages: 0 } }
         });
      }
      
      filters.id = { in: matchingOppIds };
    }

    // Sorting: Complex sorting by cycle status/deadline across a 1-to-Many relation
    // is difficult in Prisma without raw queries. 
    // We fall back to a simple, deterministic database-compatible ordering (id desc).
    const opportunities = await prisma.opportunity.findMany({
      where: filters,
      skip,
      take: maxLimit,
      include: {
        skills: {
          include: { skill: true }
        },
        eligibilityRequirements: true,
        cycles: true,
        verifications: {
          orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: 1
        }
      },
      orderBy: { id: 'desc' }
    });

    const total = await prisma.opportunity.count({ where: filters });
    const totalPages = Math.ceil(total / maxLimit);

    const mappedOpportunities = opportunities.map(opp => {
      const currentVerificationStatus = opp.verifications.length > 0 ? opp.verifications[0].status : null;
      
      let currentCycle = null;
      if (opp.cycles.length > 0) {
        // Selection logic: Prefer OPEN, then UPCOMING, else most recent
        const openCycle = opp.cycles.find(c => c.status === 'OPEN');
        const upcomingCycle = opp.cycles.find(c => c.status === 'UPCOMING');
        
        if (openCycle) {
          currentCycle = openCycle;
        } else if (upcomingCycle) {
          currentCycle = upcomingCycle;
        } else {
          currentCycle = opp.cycles.sort((a, b) => {
            const dateA = a.applicationDeadline || a.startDate || a.createdAt;
            const dateB = b.applicationDeadline || b.startDate || b.createdAt;
            return new Date(dateB) - new Date(dateA);
          })[0];
        }
      }

      const { cycles, verifications, ...cleanOpp } = opp;
      
      return {
        ...cleanOpp,
        currentCycle,
        verificationStatus: currentVerificationStatus
      };
    });

    res.status(200).json({
      success: true,
      data: {
        opportunities: mappedOpportunities,
        pagination: {
          page: pageNum,
          limit: maxLimit,
          total,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Get opportunities error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getOpportunity = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: Number(opportunityId) },
      include: {
        skills: {
          include: { skill: true }
        },
        eligibilityRequirements: true,
        cycles: true
      }
    });

    if (!opportunity || !opportunity.isActive) {
      return res.status(404).json({ success: false, error: 'Opportunity not found or inactive' });
    }

    res.status(200).json({ success: true, data: opportunity });
  } catch (error) {
    console.error('Get opportunity error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const isValidUrl = (urlString) => {
  try { 
    new URL(urlString); 
    return true; 
  }
  catch(e) { 
    return false; 
  }
};

export const createOpportunity = async (req, res) => {
  try {
    const { title, organization, description, type, workMode, location, stipendMin, stipendMax, applyUrl, deadline, isActive } = req.body;

    if (!title || !organization || !type) {
      return res.status(400).json({ success: false, error: 'Title, organization, and type are required' });
    }

    const validTypes = ['INTERNSHIP', 'JOB', 'HACKATHON', 'SCHOLARSHIP', 'COMPETITION', 'OPEN_SOURCE', 'OTHER'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid opportunity type' });
    }

    if (workMode && !['REMOTE', 'ONSITE', 'HYBRID'].includes(workMode)) {
      return res.status(400).json({ success: false, error: 'Invalid work mode' });
    }

    if (stipendMin !== undefined && stipendMin < 0) {
      return res.status(400).json({ success: false, error: 'stipendMin cannot be negative' });
    }

    if (stipendMax !== undefined) {
      if (stipendMax < 0) return res.status(400).json({ success: false, error: 'stipendMax cannot be negative' });
      if (stipendMin !== undefined && stipendMax < stipendMin) {
        return res.status(400).json({ success: false, error: 'stipendMax cannot be less than stipendMin' });
      }
    }

    if (applyUrl && !isValidUrl(applyUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid applyUrl format' });
    }

    let parsedDeadline = null;
    if (deadline) {
      parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid deadline date format' });
      }
    }

    const opportunity = await prisma.opportunity.create({
      data: {
        title,
        organization,
        description,
        type,
        workMode,
        location,
        stipendMin,
        stipendMax,
        applyUrl,
        deadline: parsedDeadline,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({ success: true, data: opportunity });
  } catch (error) {
    console.error('Create opportunity error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateOpportunity = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { title, organization, description, type, workMode, location, stipendMin, stipendMax, applyUrl, deadline, isActive } = req.body;

    const existing = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }

    const validTypes = ['INTERNSHIP', 'JOB', 'HACKATHON', 'SCHOLARSHIP', 'COMPETITION', 'OPEN_SOURCE', 'OTHER'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid opportunity type' });
    }

    if (workMode && !['REMOTE', 'ONSITE', 'HYBRID'].includes(workMode)) {
      return res.status(400).json({ success: false, error: 'Invalid work mode' });
    }

    const newMin = stipendMin !== undefined ? stipendMin : existing.stipendMin;
    const newMax = stipendMax !== undefined ? stipendMax : existing.stipendMax;

    if (newMin !== null && newMin < 0) return res.status(400).json({ success: false, error: 'stipendMin cannot be negative' });
    if (newMax !== null && newMax < 0) return res.status(400).json({ success: false, error: 'stipendMax cannot be negative' });
    if (newMin !== null && newMax !== null && newMax < newMin) {
      return res.status(400).json({ success: false, error: 'stipendMax cannot be less than stipendMin' });
    }

    if (applyUrl && !isValidUrl(applyUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid applyUrl format' });
    }

    let parsedDeadline = existing.deadline;
    if (deadline !== undefined) {
      if (deadline === null) {
        parsedDeadline = null;
      } else {
        parsedDeadline = new Date(deadline);
        if (isNaN(parsedDeadline.getTime())) return res.status(400).json({ success: false, error: 'Invalid deadline date format' });
      }
    }

    const updated = await prisma.opportunity.update({
      where: { id: Number(opportunityId) },
      data: { title, organization, description, type, workMode, location, stipendMin, stipendMax, applyUrl, deadline: parsedDeadline, isActive }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update opportunity error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deactivateOpportunity = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { isActive } = req.body;

    if (isActive !== false) {
      return res.status(400).json({ success: false, error: 'This endpoint is for deactivation (isActive: false) only' });
    }

    const existing = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }

    const updated = await prisma.opportunity.update({
      where: { id: Number(opportunityId) },
      data: { isActive: false }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Deactivate opportunity error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ================= OPPORTUNITY SKILLS =================

export const getOpportunitySkills = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const opportunity = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!opportunity) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    const skills = await prisma.opportunitySkill.findMany({
      where: { opportunityId: Number(opportunityId) },
      include: { skill: true }
    });

    res.status(200).json({ success: true, data: skills });
  } catch (error) {
    console.error('Get opportunity skills error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const addOpportunitySkill = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { skillId, minimumLevel, isRequired } = req.body;

    if (!skillId) return res.status(400).json({ success: false, error: 'skillId is required' });

    if (minimumLevel !== undefined && (typeof minimumLevel !== 'number' || minimumLevel <= 0)) {
      return res.status(400).json({ success: false, error: 'minimumLevel must be a positive integer' });
    }

    if (isRequired !== undefined && typeof isRequired !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isRequired must be a boolean' });
    }

    const opportunity = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!opportunity) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    const skill = await prisma.skill.findUnique({ where: { id: Number(skillId) } });
    if (!skill) return res.status(404).json({ success: false, error: 'Skill not found' });

    const existing = await prisma.opportunitySkill.findUnique({
      where: {
        opportunityId_skillId: {
          opportunityId: Number(opportunityId),
          skillId: Number(skillId)
        }
      }
    });

    if (existing) {
      return res.status(409).json({ success: false, error: 'Skill is already attached to this opportunity' });
    }

    const oppSkill = await prisma.opportunitySkill.create({
      data: {
        opportunityId: Number(opportunityId),
        skillId: Number(skillId),
        minimumLevel: minimumLevel || 1,
        isRequired: isRequired !== undefined ? isRequired : true
      }
    });

    res.status(201).json({ success: true, data: oppSkill });
  } catch (error) {
    console.error('Add opportunity skill error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateOpportunitySkill = async (req, res) => {
  try {
    const { opportunityId, opportunitySkillId } = req.params;
    const { minimumLevel, isRequired } = req.body;

    if (minimumLevel !== undefined && (typeof minimumLevel !== 'number' || minimumLevel <= 0)) {
      return res.status(400).json({ success: false, error: 'minimumLevel must be a positive integer' });
    }

    if (isRequired !== undefined && typeof isRequired !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isRequired must be a boolean' });
    }

    const existing = await prisma.opportunitySkill.findUnique({ where: { id: Number(opportunitySkillId) } });
    if (!existing || existing.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Opportunity skill not found for this opportunity' });
    }

    const updated = await prisma.opportunitySkill.update({
      where: { id: Number(opportunitySkillId) },
      data: { minimumLevel, isRequired }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update opportunity skill error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const removeOpportunitySkill = async (req, res) => {
  try {
    const { opportunityId, opportunitySkillId } = req.params;

    const existing = await prisma.opportunitySkill.findUnique({ where: { id: Number(opportunitySkillId) } });
    if (!existing || existing.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Opportunity skill not found for this opportunity' });
    }

    await prisma.opportunitySkill.delete({ where: { id: Number(opportunitySkillId) } });

    res.status(200).json({ success: true, data: { message: 'Opportunity skill removed successfully' } });
  } catch (error) {
    console.error('Remove opportunity skill error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ================= OPPORTUNITY ELIGIBILITY =================

export const getEligibilityRequirements = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const opportunity = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!opportunity) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    const requirements = await prisma.opportunityEligibility.findMany({
      where: { opportunityId: Number(opportunityId) }
    });

    res.status(200).json({ success: true, data: requirements });
  } catch (error) {
    console.error('Get eligibility error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const addEligibilityRequirement = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { type, value, description } = req.body;

    if (!type || !value) {
      return res.status(400).json({ success: false, error: 'type and value are required' });
    }

    const validTypes = ['DEGREE', 'BRANCH', 'MIN_YEAR', 'MAX_YEAR', 'MIN_CGPA', 'GRADUATION_YEAR', 'LOCATION', 'OTHER'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid eligibility type' });
    }

    const opportunity = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!opportunity) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    const requirement = await prisma.opportunityEligibility.create({
      data: {
        opportunityId: Number(opportunityId),
        type,
        value,
        description
      }
    });

    res.status(201).json({ success: true, data: requirement });
  } catch (error) {
    console.error('Add eligibility error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateEligibilityRequirement = async (req, res) => {
  try {
    const { opportunityId, eligibilityId } = req.params;
    const { value, description } = req.body;

    const existing = await prisma.opportunityEligibility.findUnique({ where: { id: Number(eligibilityId) } });
    if (!existing || existing.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Eligibility requirement not found for this opportunity' });
    }

    const updated = await prisma.opportunityEligibility.update({
      where: { id: Number(eligibilityId) },
      data: { value, description }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update eligibility error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteEligibilityRequirement = async (req, res) => {
  try {
    const { opportunityId, eligibilityId } = req.params;

    const existing = await prisma.opportunityEligibility.findUnique({ where: { id: Number(eligibilityId) } });
    if (!existing || existing.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Eligibility requirement not found for this opportunity' });
    }

    await prisma.opportunityEligibility.delete({ where: { id: Number(eligibilityId) } });

    res.status(200).json({ success: true, data: { message: 'Eligibility requirement deleted successfully' } });
  } catch (error) {
    console.error('Delete eligibility error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ================= OPPORTUNITY CYCLES =================

export const getOpportunityCycles = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const opportunity = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!opportunity) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    const cycles = await prisma.opportunityCycle.findMany({
      where: { opportunityId: Number(opportunityId) },
      orderBy: [
        { applicationDeadline: 'desc' },
        { cycleLabel: 'desc' }
      ]
    });

    res.status(200).json({ success: true, data: cycles });
  } catch (error) {
    console.error('Get cycles error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getOpportunityCycle = async (req, res) => {
  try {
    const { opportunityId, cycleId } = req.params;

    const cycle = await prisma.opportunityCycle.findUnique({ where: { id: Number(cycleId) } });
    if (!cycle || cycle.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Cycle not found for this opportunity' });
    }

    res.status(200).json({ success: true, data: cycle });
  } catch (error) {
    console.error('Get cycle error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const createOpportunityCycle = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { cycleLabel, applicationStart, applicationDeadline, startDate, endDate, status, applicationUrl } = req.body;

    if (!cycleLabel || cycleLabel.trim() === '') {
      return res.status(400).json({ success: false, error: 'cycleLabel is required' });
    }

    const validStatuses = ['UPCOMING', 'OPEN', 'CLOSED', 'CANCELLED', 'UNKNOWN'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    if (applicationUrl && !isValidUrl(applicationUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid applicationUrl format' });
    }

    let parsedAppStart = null;
    let parsedAppDeadline = null;
    let parsedStart = null;
    let parsedEnd = null;

    if (applicationStart) {
      parsedAppStart = new Date(applicationStart);
      if (isNaN(parsedAppStart.getTime())) return res.status(400).json({ success: false, error: 'Invalid applicationStart date' });
    }
    if (applicationDeadline) {
      parsedAppDeadline = new Date(applicationDeadline);
      if (isNaN(parsedAppDeadline.getTime())) return res.status(400).json({ success: false, error: 'Invalid applicationDeadline date' });
    }
    if (startDate) {
      parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime())) return res.status(400).json({ success: false, error: 'Invalid startDate date' });
    }
    if (endDate) {
      parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime())) return res.status(400).json({ success: false, error: 'Invalid endDate date' });
    }

    if (parsedAppStart && parsedAppDeadline && parsedAppDeadline < parsedAppStart) {
      return res.status(400).json({ success: false, error: 'applicationDeadline cannot be earlier than applicationStart' });
    }
    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ success: false, error: 'endDate cannot be earlier than startDate' });
    }

    const opportunity = await prisma.opportunity.findUnique({ where: { id: Number(opportunityId) } });
    if (!opportunity) return res.status(404).json({ success: false, error: 'Opportunity not found' });

    const existingCycle = await prisma.opportunityCycle.findUnique({
      where: {
        opportunityId_cycleLabel: {
          opportunityId: Number(opportunityId),
          cycleLabel
        }
      }
    });

    if (existingCycle) {
      return res.status(409).json({ success: false, error: 'Cycle with this label already exists for this opportunity' });
    }

    const cycle = await prisma.opportunityCycle.create({
      data: {
        opportunityId: Number(opportunityId),
        cycleLabel,
        applicationStart: parsedAppStart,
        applicationDeadline: parsedAppDeadline,
        startDate: parsedStart,
        endDate: parsedEnd,
        status: status || 'UNKNOWN',
        applicationUrl
      }
    });

    res.status(201).json({ success: true, data: cycle });
  } catch (error) {
    console.error('Create cycle error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateOpportunityCycle = async (req, res) => {
  try {
    const { opportunityId, cycleId } = req.params;
    const { cycleLabel, applicationStart, applicationDeadline, startDate, endDate, status, applicationUrl } = req.body;

    const existing = await prisma.opportunityCycle.findUnique({ where: { id: Number(cycleId) } });
    if (!existing || existing.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Cycle not found for this opportunity' });
    }

    if (cycleLabel && cycleLabel.trim() === '') {
      return res.status(400).json({ success: false, error: 'cycleLabel cannot be empty' });
    }

    const validStatuses = ['UPCOMING', 'OPEN', 'CLOSED', 'CANCELLED', 'UNKNOWN'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    if (applicationUrl && !isValidUrl(applicationUrl)) {
      return res.status(400).json({ success: false, error: 'Invalid applicationUrl format' });
    }

    if (cycleLabel && cycleLabel !== existing.cycleLabel) {
      const dup = await prisma.opportunityCycle.findUnique({
        where: {
          opportunityId_cycleLabel: {
            opportunityId: Number(opportunityId),
            cycleLabel
          }
        }
      });
      if (dup) return res.status(409).json({ success: false, error: 'Cycle label already exists' });
    }

    let parsedAppStart = existing.applicationStart;
    let parsedAppDeadline = existing.applicationDeadline;
    let parsedStart = existing.startDate;
    let parsedEnd = existing.endDate;

    if (applicationStart !== undefined) {
      if (applicationStart === null) parsedAppStart = null;
      else {
        parsedAppStart = new Date(applicationStart);
        if (isNaN(parsedAppStart.getTime())) return res.status(400).json({ success: false, error: 'Invalid applicationStart date' });
      }
    }
    if (applicationDeadline !== undefined) {
      if (applicationDeadline === null) parsedAppDeadline = null;
      else {
        parsedAppDeadline = new Date(applicationDeadline);
        if (isNaN(parsedAppDeadline.getTime())) return res.status(400).json({ success: false, error: 'Invalid applicationDeadline date' });
      }
    }
    if (startDate !== undefined) {
      if (startDate === null) parsedStart = null;
      else {
        parsedStart = new Date(startDate);
        if (isNaN(parsedStart.getTime())) return res.status(400).json({ success: false, error: 'Invalid startDate date' });
      }
    }
    if (endDate !== undefined) {
      if (endDate === null) parsedEnd = null;
      else {
        parsedEnd = new Date(endDate);
        if (isNaN(parsedEnd.getTime())) return res.status(400).json({ success: false, error: 'Invalid endDate date' });
      }
    }

    if (parsedAppStart && parsedAppDeadline && parsedAppDeadline < parsedAppStart) {
      return res.status(400).json({ success: false, error: 'applicationDeadline cannot be earlier than applicationStart' });
    }
    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ success: false, error: 'endDate cannot be earlier than startDate' });
    }

    const updated = await prisma.opportunityCycle.update({
      where: { id: Number(cycleId) },
      data: {
        cycleLabel: cycleLabel !== undefined ? cycleLabel : existing.cycleLabel,
        applicationStart: parsedAppStart,
        applicationDeadline: parsedAppDeadline,
        startDate: parsedStart,
        endDate: parsedEnd,
        status: status !== undefined ? status : existing.status,
        applicationUrl: applicationUrl !== undefined ? applicationUrl : existing.applicationUrl
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update cycle error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteOpportunityCycle = async (req, res) => {
  try {
    const { opportunityId, cycleId } = req.params;

    const existing = await prisma.opportunityCycle.findUnique({ where: { id: Number(cycleId) } });
    if (!existing || existing.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Cycle not found for this opportunity' });
    }

    await prisma.opportunityCycle.delete({ where: { id: Number(cycleId) } });

    res.status(200).json({ success: true, data: { message: 'Opportunity cycle deleted successfully' } });
  } catch (error) {
    console.error('Delete cycle error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ================= OPPORTUNITY CYCLE VERIFICATIONS =================

export const getCycleVerifications = async (req, res) => {
  try {
    const { opportunityId, cycleId } = req.params;

    const cycle = await prisma.opportunityCycle.findUnique({ where: { id: Number(cycleId) } });
    if (!cycle || cycle.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Cycle not found for this opportunity' });
    }

    const verifications = await prisma.opportunityCycleVerification.findMany({
      where: { opportunityCycleId: Number(cycleId) },
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.status(200).json({ success: true, data: verifications });
  } catch (error) {
    console.error('Get cycle verifications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const addCycleVerification = async (req, res) => {
  try {
    const { opportunityId, cycleId } = req.params;
    const { status, verifiedBy, notes } = req.body;

    if (!verifiedBy) return res.status(400).json({ success: false, error: 'verifiedBy is required' });

    const validStatuses = ['VERIFIED', 'FAILED', 'NEEDS_REVIEW'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid verification status' });
    }

    const cycle = await prisma.opportunityCycle.findUnique({ where: { id: Number(cycleId) } });
    if (!cycle || cycle.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Cycle not found for this opportunity' });
    }

    const verification = await prisma.opportunityCycleVerification.create({
      data: {
        opportunityCycleId: Number(cycleId),
        status,
        verifiedBy,
        notes
      }
    });

    res.status(201).json({ success: true, data: verification });
  } catch (error) {
    console.error('Add cycle verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getLatestCycleVerification = async (req, res) => {
  try {
    const { opportunityId, cycleId } = req.params;

    const cycle = await prisma.opportunityCycle.findUnique({ where: { id: Number(cycleId) } });
    if (!cycle || cycle.opportunityId !== Number(opportunityId)) {
      return res.status(404).json({ success: false, error: 'Cycle not found for this opportunity' });
    }

    const verification = await prisma.opportunityCycleVerification.findFirst({
      where: { opportunityCycleId: Number(cycleId) },
      orderBy: [
        { verifiedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    if (!verification) {
      return res.status(404).json({ success: false, error: 'No verification record found' });
    }

    res.status(200).json({ success: true, data: verification });
  } catch (error) {
    console.error('Get latest cycle verification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
