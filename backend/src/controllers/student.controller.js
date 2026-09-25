import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const createStudent = async (req, res) => {
  try {
    const { fullName, email, collegeName, branch, currentYear, cgpa, city } = req.body;

    // Validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      return res.status(400).json({ success: false, message: "fullName is required." });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }
    if (currentYear !== undefined && (!Number.isInteger(currentYear) || currentYear <= 0)) {
      return res.status(400).json({ success: false, message: "currentYear must be a positive integer." });
    }
    if (cgpa !== undefined && (typeof cgpa !== 'number' || cgpa < 0 || cgpa > 10)) {
      return res.status(400).json({ success: false, message: "cgpa must be between 0 and 10." });
    }

    // Check if email already exists
    const existingStudent = await prisma.student.findUnique({ where: { email } });
    if (existingStudent) {
      return res.status(409).json({ success: false, message: "A student with this email already exists." });
    }

    // Create the student
    const student = await prisma.student.create({
      data: {
        fullName,
        email,
        collegeName,
        branch,
        currentYear,
        cgpa,
        city
      }
    });

    const { passwordHash, ...safeStudent } = student;

    return res.status(201).json({
      success: true,
      data: safeStudent
    });

  } catch (error) {
    console.error("Error creating student:", error);
    return res.status(500).json({ success: false, message: "Failed to create student." });
  }
};

export const getStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = parseInt(id, 10);

    if (isNaN(studentId) || studentId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        educations: true,
        goals: true,
        skills: true,
        projects: true
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const { passwordHash, educations, ...rest } = student;
    const safeStudent = {
      ...rest,
      education: educations,
    };

    return res.status(200).json({
      success: true,
      data: safeStudent
    });
  } catch (error) {
    console.error("Error getting student:", error);
    return res.status(500).json({ success: false, message: "Failed to get student." });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = parseInt(id, 10);

    if (isNaN(studentId) || studentId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid student ID." });
    }

    const { fullName, email, collegeName, branch, currentYear, cgpa, city } = req.body;

    // Validation for updated fields
    if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim() === '')) {
      return res.status(400).json({ success: false, message: "fullName cannot be empty." });
    }
    if (email !== undefined && !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }
    if (currentYear !== undefined && (!Number.isInteger(currentYear) || currentYear <= 0)) {
      return res.status(400).json({ success: false, message: "currentYear must be a positive integer." });
    }
    if (cgpa !== undefined && (typeof cgpa !== 'number' || cgpa < 0 || cgpa > 10)) {
      return res.status(400).json({ success: false, message: "cgpa must be between 0 and 10." });
    }

    // Check if student exists
    const existingStudent = await prisma.student.findUnique({ where: { id: studentId } });
    if (!existingStudent) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    // Check email uniqueness if email is being updated
    if (email !== undefined && email !== existingStudent.email) {
      const emailTaken = await prisma.student.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ success: false, message: "A student with this email already exists." });
      }
    }

    // Collect only provided fields
    const dataToUpdate = {};
    if (fullName !== undefined) dataToUpdate.fullName = fullName;
    if (email !== undefined) dataToUpdate.email = email;
    if (collegeName !== undefined) dataToUpdate.collegeName = collegeName;
    if (branch !== undefined) dataToUpdate.branch = branch;
    if (currentYear !== undefined) dataToUpdate.currentYear = currentYear;
    if (cgpa !== undefined) dataToUpdate.cgpa = cgpa;
    if (city !== undefined) dataToUpdate.city = city;

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: dataToUpdate
    });

    const { passwordHash, ...safeStudent } = updatedStudent;

    return res.status(200).json({
      success: true,
      data: safeStudent
    });

  } catch (error) {
    console.error("Error updating student:", error);
    return res.status(500).json({ success: false, message: "Failed to update student." });
  }
};

export const getCapabilityProfile = async (req, res) => {
  try {
    const { studentId } = req.params;
    const sId = parseInt(studentId, 10);

    const student = await prisma.student.findUnique({
      where: { id: sId },
      include: {
        educations: {
          orderBy: { endYear: 'desc' }
        },
        goals: {
          include: { goal: true }
        },
        skills: {
          include: {
            skill: true,
            evidences: true
          }
        },
        projects: {
          include: {
            skills: {
              include: { skill: true }
            }
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const { passwordHash, educations, goals, skills, projects, ...studentSummary } = student;

    let skillsWithEvidence = 0;
    let evidenceCount = 0;
    const evidenceByType = {};
    const skillsByCategory = {};

    skills.forEach(studentSkill => {
      if (studentSkill.skill) {
        skillsByCategory[studentSkill.skill.category] = (skillsByCategory[studentSkill.skill.category] || 0) + 1;
      }
      if (studentSkill.evidences && studentSkill.evidences.length > 0) {
        skillsWithEvidence++;
        evidenceCount += studentSkill.evidences.length;
        studentSkill.evidences.forEach(ev => {
          evidenceByType[ev.evidenceType] = (evidenceByType[ev.evidenceType] || 0) + 1;
        });
      }
    });

    const completedProjectCount = projects.filter(p => p.status === 'COMPLETED').length;

    const summary = {
      skillCount: skills.length,
      skillsWithEvidence,
      evidenceCount,
      projectCount: projects.length,
      completedProjectCount,
      educationRecordCount: educations.length,
      goalCount: goals.length
    };

    const mappedSkills = skills.map(ss => ({
      studentSkillId: ss.id,
      skill: ss.skill,
      source: ss.source,
      note: ss.note,
      evidence: ss.evidences
    }));

    const mappedProjects = projects.map(p => ({
      ...p,
      skills: p.skills.map(ps => ps.skill)
    }));

    const mappedGoals = goals.map(sg => ({
      id: sg.goalId,
      name: sg.goal ? sg.goal.name : 'Unknown',
      note: sg.note
    }));

    return res.status(200).json({
      success: true,
      data: {
        student: studentSummary,
        education: educations,
        goals: mappedGoals,
        skills: mappedSkills,
        projects: mappedProjects,
        summary,
        evidenceByType,
        skillsByCategory
      }
    });

  } catch (error) {
    console.error("Error getting capability profile:", error);
    return res.status(500).json({ success: false, message: "Failed to get capability profile." });
  }
};
