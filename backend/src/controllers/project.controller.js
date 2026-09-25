import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const validStatuses = ['ONGOING', 'COMPLETED', 'DROPPED'];

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

export const getProjects = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const projects = await prisma.project.findMany({ 
      where: { studentId },
      include: {
        skills: {
          include: { skill: true }
        }
      }
    });
    return res.status(200).json({ success: true, data: projects });
  } catch (error) {
    console.error("Error getting projects:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const createProject = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const { title, description, githubUrl, liveUrl, status, startDate, endDate } = req.body;

    if (!title) return res.status(400).json({ success: false, message: "title is required." });
    if (githubUrl && !isValidUrl(githubUrl)) return res.status(400).json({ success: false, message: "Invalid githubUrl." });
    if (liveUrl && !isValidUrl(liveUrl)) return res.status(400).json({ success: false, message: "Invalid liveUrl." });
    if (status && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });

    let parsedStart = null;
    let parsedEnd = null;

    if (startDate) {
      parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime())) return res.status(400).json({ success: false, message: "Invalid startDate." });
    }
    if (endDate) {
      parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime())) return res.status(400).json({ success: false, message: "Invalid endDate." });
    }
    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ success: false, message: "endDate cannot be earlier than startDate." });
    }

    const project = await prisma.project.create({
      data: {
        studentId,
        title,
        description: description || null,
        githubUrl: githubUrl || null,
        liveUrl: liveUrl || null,
        status: status || 'ONGOING',
        startDate: parsedStart,
        endDate: parsedEnd
      }
    });

    return res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error("Error creating project:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const updateProject = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(studentId) || isNaN(projectId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Project not found or ownership mismatch." });
    }

    const { title, description, githubUrl, liveUrl, status, startDate, endDate } = req.body;

    if (githubUrl !== undefined && githubUrl !== null && !isValidUrl(githubUrl)) return res.status(400).json({ success: false, message: "Invalid githubUrl." });
    if (liveUrl !== undefined && liveUrl !== null && !isValidUrl(liveUrl)) return res.status(400).json({ success: false, message: "Invalid liveUrl." });
    if (status !== undefined && !validStatuses.includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });

    let parsedStart = project.startDate;
    let parsedEnd = project.endDate;

    if (startDate !== undefined) {
      if (startDate === null) parsedStart = null;
      else {
        parsedStart = new Date(startDate);
        if (isNaN(parsedStart.getTime())) return res.status(400).json({ success: false, message: "Invalid startDate." });
      }
    }

    if (endDate !== undefined) {
      if (endDate === null) parsedEnd = null;
      else {
        parsedEnd = new Date(endDate);
        if (isNaN(parsedEnd.getTime())) return res.status(400).json({ success: false, message: "Invalid endDate." });
      }
    }

    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return res.status(400).json({ success: false, message: "endDate cannot be earlier than startDate." });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(githubUrl !== undefined && { githubUrl }),
        ...(liveUrl !== undefined && { liveUrl }),
        ...(status !== undefined && { status }),
        ...(startDate !== undefined && { startDate: parsedStart }),
        ...(endDate !== undefined && { endDate: parsedEnd }),
      }
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating project:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(studentId) || isNaN(projectId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Project not found or ownership mismatch." });
    }

    await prisma.project.delete({ where: { id: projectId } });
    return res.status(200).json({ success: true, message: "Project deleted successfully." });
  } catch (error) {
    console.error("Error deleting project:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const addProjectSkill = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(studentId) || isNaN(projectId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const { skillId } = req.body;
    const parsedSkillId = parseInt(skillId, 10);
    if (isNaN(parsedSkillId) || parsedSkillId <= 0) return res.status(400).json({ success: false, message: "Invalid skillId." });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Project not found or ownership mismatch." });
    }

    const skillExists = await prisma.skill.findUnique({ where: { id: parsedSkillId } });
    if (!skillExists) return res.status(404).json({ success: false, message: "Skill not found." });

    const existingProjectSkill = await prisma.projectSkill.findUnique({
      where: { projectId_skillId: { projectId, skillId: parsedSkillId } }
    });
    if (existingProjectSkill) return res.status(409).json({ success: false, message: "Skill already attached to this project." });

    const projectSkill = await prisma.projectSkill.create({
      data: {
        projectId,
        skillId: parsedSkillId
      },
      include: { skill: true }
    });

    return res.status(201).json({ success: true, data: projectSkill });
  } catch (error) {
    console.error("Error adding project skill:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const getProjectSkills = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(studentId) || isNaN(projectId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Project not found or ownership mismatch." });
    }

    const projectSkills = await prisma.projectSkill.findMany({
      where: { projectId },
      include: { skill: true }
    });

    return res.status(200).json({ success: true, data: projectSkills });
  } catch (error) {
    console.error("Error getting project skills:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const removeProjectSkill = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const projectId = parseInt(req.params.projectId, 10);
    const projectSkillId = parseInt(req.params.projectSkillId, 10);
    if (isNaN(studentId) || isNaN(projectId) || isNaN(projectSkillId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Project not found or ownership mismatch." });
    }

    const projectSkill = await prisma.projectSkill.findUnique({ where: { id: projectSkillId } });
    if (!projectSkill || projectSkill.projectId !== projectId) {
      return res.status(404).json({ success: false, message: "Project skill not found on this project." });
    }

    await prisma.projectSkill.delete({ where: { id: projectSkillId } });

    return res.status(200).json({ success: true, message: "Project skill removed successfully." });
  } catch (error) {
    console.error("Error removing project skill:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
