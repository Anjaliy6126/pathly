import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const validSkillSources = ['COURSEWORK', 'PROJECT', 'INTERNSHIP', 'CERTIFICATION', 'SELF_STUDY', 'OTHER'];
const validEvidenceTypes = ['PROJECT', 'GITHUB_REPOSITORY', 'PORTFOLIO', 'INTERNSHIP', 'CERTIFICATION', 'COURSE', 'LEETCODE', 'LINKEDIN', 'OTHER'];

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// API 1: GET /api/students/:studentId/skills
export const getStudentSkills = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const skills = await prisma.studentSkill.findMany({
      where: { studentId },
      include: {
        skill: true,
        evidences: true
      }
    });

    const formattedSkills = skills.map(ss => ({
      id: ss.id,
      skill: ss.skill,
      source: ss.source,
      note: ss.note,
      evidence: ss.evidences
    }));

    return res.status(200).json({ success: true, data: formattedSkills });
  } catch (error) {
    console.error("Error getting student skills:", error);
    return res.status(500).json({ success: false, message: "Failed to get student skills." });
  }
};

// API 2: POST /api/students/:studentId/skills
export const addStudentSkill = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const { skillId, source, note } = req.body;
    const parsedSkillId = parseInt(skillId, 10);
    
    if (isNaN(parsedSkillId) || parsedSkillId <= 0) {
      return res.status(400).json({ success: false, message: "skillId must be a positive integer." });
    }
    if (source && !validSkillSources.includes(source)) {
      return res.status(400).json({ success: false, message: "Invalid source value." });
    }

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const skillExists = await prisma.skill.findUnique({ where: { id: parsedSkillId } });
    if (!skillExists) return res.status(404).json({ success: false, message: "Skill not found." });

    const existingStudentSkill = await prisma.studentSkill.findUnique({
      where: { studentId_skillId: { studentId, skillId: parsedSkillId } }
    });
    if (existingStudentSkill) return res.status(409).json({ success: false, message: "Student already has this skill." });

    const newStudentSkill = await prisma.studentSkill.create({
      data: {
        studentId,
        skillId: parsedSkillId,
        source: source || null,
        note: note || null
      },
      include: {
        skill: true
      }
    });

    return res.status(201).json({ success: true, data: newStudentSkill });
  } catch (error) {
    console.error("Error adding student skill:", error);
    return res.status(500).json({ success: false, message: "Failed to add student skill." });
  }
};

// API 3: DELETE /api/students/:studentId/skills/:studentSkillId
export const removeStudentSkill = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const studentSkillId = parseInt(req.params.studentSkillId, 10);
    if (isNaN(studentId) || studentId <= 0 || isNaN(studentSkillId) || studentSkillId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid IDs." });
    }

    const studentSkill = await prisma.studentSkill.findUnique({ where: { id: studentSkillId } });
    if (!studentSkill || studentSkill.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Student skill not found for this student." });
    }

    await prisma.studentSkill.delete({ where: { id: studentSkillId } });

    return res.status(200).json({ success: true, message: "Student skill removed successfully." });
  } catch (error) {
    console.error("Error removing student skill:", error);
    return res.status(500).json({ success: false, message: "Failed to remove student skill." });
  }
};

// API 4: POST /api/students/:studentId/skills/:studentSkillId/evidence
export const addSkillEvidence = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const studentSkillId = parseInt(req.params.studentSkillId, 10);
    
    if (isNaN(studentId) || studentId <= 0 || isNaN(studentSkillId) || studentSkillId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid IDs." });
    }

    const { evidenceType, title, description, url, evidenceDate } = req.body;

    if (!evidenceType || !validEvidenceTypes.includes(evidenceType)) {
      return res.status(400).json({ success: false, message: "Invalid or missing evidenceType." });
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ success: false, message: "Title is required." });
    }
    if (url && !isValidUrl(url)) {
      return res.status(400).json({ success: false, message: "Invalid URL format." });
    }
    
    let parsedDate = null;
    if (evidenceDate) {
      parsedDate = new Date(evidenceDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid evidenceDate." });
      }
    }

    const studentSkill = await prisma.studentSkill.findUnique({ where: { id: studentSkillId } });
    if (!studentSkill || studentSkill.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Student skill not found for this student." });
    }

    const newEvidence = await prisma.studentSkillEvidence.create({
      data: {
        studentSkillId,
        evidenceType,
        title,
        description: description || null,
        url: url || null,
        evidenceDate: parsedDate
      }
    });

    return res.status(201).json({ success: true, data: newEvidence });
  } catch (error) {
    console.error("Error adding skill evidence:", error);
    return res.status(500).json({ success: false, message: "Failed to add skill evidence." });
  }
};

// API 5: GET /api/students/:studentId/skills/:studentSkillId/evidence
export const getSkillEvidence = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const studentSkillId = parseInt(req.params.studentSkillId, 10);

    if (isNaN(studentId) || studentId <= 0 || isNaN(studentSkillId) || studentSkillId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid IDs." });
    }

    const studentSkill = await prisma.studentSkill.findUnique({ where: { id: studentSkillId } });
    if (!studentSkill || studentSkill.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Student skill not found for this student." });
    }

    const evidence = await prisma.studentSkillEvidence.findMany({
      where: { studentSkillId }
    });

    return res.status(200).json({ success: true, data: evidence });
  } catch (error) {
    console.error("Error getting skill evidence:", error);
    return res.status(500).json({ success: false, message: "Failed to get skill evidence." });
  }
};

// API 6: DELETE /api/students/:studentId/skills/:studentSkillId/evidence/:evidenceId
export const removeSkillEvidence = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const studentSkillId = parseInt(req.params.studentSkillId, 10);
    const evidenceId = parseInt(req.params.evidenceId, 10);

    if (isNaN(studentId) || studentId <= 0 || isNaN(studentSkillId) || studentSkillId <= 0 || isNaN(evidenceId) || evidenceId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid IDs." });
    }

    const studentSkill = await prisma.studentSkill.findUnique({ where: { id: studentSkillId } });
    if (!studentSkill || studentSkill.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Student skill not found for this student." });
    }

    const evidence = await prisma.studentSkillEvidence.findUnique({ where: { id: evidenceId } });
    if (!evidence || evidence.studentSkillId !== studentSkillId) {
      return res.status(404).json({ success: false, message: "Evidence not found for this student skill." });
    }

    await prisma.studentSkillEvidence.delete({ where: { id: evidenceId } });

    return res.status(200).json({ success: true, message: "Skill evidence removed successfully." });
  } catch (error) {
    console.error("Error removing skill evidence:", error);
    return res.status(500).json({ success: false, message: "Failed to remove skill evidence." });
  }
};
