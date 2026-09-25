import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ================= OPPORTUNITIES =================

export const getOpportunities = async (req, res) => {
  try {
    const { type, workMode, location, organization } = req.query;
    const filters = { isActive: true };

    if (type) filters.type = type;
    if (workMode) filters.workMode = workMode;
    if (location) filters.location = { contains: location, mode: 'insensitive' };
    if (organization) filters.organization = { contains: organization, mode: 'insensitive' };

    const opportunities = await prisma.opportunity.findMany({
      where: filters,
      include: {
        skills: {
          include: { skill: true }
        },
        eligibilityRequirements: true,
        cycles: {
          orderBy: { startDate: 'desc' },
          take: 1
        }
      }
    });

    res.status(200).json({ success: true, data: opportunities });
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
