import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getEducation = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const educations = await prisma.education.findMany({ where: { studentId } });
    return res.status(200).json({ success: true, data: educations });
  } catch (error) {
    console.error("Error getting education:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const createEducation = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const { degree, institution, fieldOfStudy, startYear, endYear, cgpa, percentage } = req.body;

    if (!degree || !institution || !startYear) {
      return res.status(400).json({ success: false, message: "degree, institution, and startYear are required." });
    }
    if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2100) {
      return res.status(400).json({ success: false, message: "startYear must be a valid year." });
    }
    if (endYear !== null && endYear !== undefined) {
      if (!Number.isInteger(endYear) || endYear < startYear) {
        return res.status(400).json({ success: false, message: "endYear must be valid and >= startYear." });
      }
    }
    if (cgpa !== null && cgpa !== undefined) {
      if (typeof cgpa !== 'number' || cgpa < 0 || cgpa > 10) {
        return res.status(400).json({ success: false, message: "cgpa must be between 0 and 10." });
      }
    }
    if (percentage !== null && percentage !== undefined) {
      if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        return res.status(400).json({ success: false, message: "percentage must be between 0 and 100." });
      }
    }

    const education = await prisma.education.create({
      data: {
        studentId,
        degree,
        institution,
        fieldOfStudy: fieldOfStudy || null,
        startYear,
        endYear: endYear || null,
        cgpa: cgpa !== undefined ? cgpa : null,
        percentage: percentage !== undefined ? percentage : null
      }
    });

    return res.status(201).json({ success: true, data: education });
  } catch (error) {
    console.error("Error creating education:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const updateEducation = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const educationId = parseInt(req.params.educationId, 10);
    if (isNaN(studentId) || isNaN(educationId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const education = await prisma.education.findUnique({ where: { id: educationId } });
    if (!education || education.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Education record not found or ownership mismatch." });
    }

    const { degree, institution, fieldOfStudy, startYear, endYear, cgpa, percentage } = req.body;
    
    // validate if provided
    if (startYear !== undefined && (!Number.isInteger(startYear) || startYear < 1900 || startYear > 2100)) {
       return res.status(400).json({ success: false, message: "startYear must be a valid year." });
    }
    const finalStartYear = startYear !== undefined ? startYear : education.startYear;
    const finalEndYear = endYear !== undefined ? endYear : education.endYear;
    
    if (finalEndYear !== null && finalEndYear !== undefined) {
      if (!Number.isInteger(finalEndYear) || finalEndYear < finalStartYear) {
        return res.status(400).json({ success: false, message: "endYear must be valid and >= startYear." });
      }
    }

    if (cgpa !== undefined && cgpa !== null) {
      if (typeof cgpa !== 'number' || cgpa < 0 || cgpa > 10) return res.status(400).json({ success: false, message: "cgpa must be between 0 and 10." });
    }

    if (percentage !== undefined && percentage !== null) {
      if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) return res.status(400).json({ success: false, message: "percentage must be between 0 and 100." });
    }

    const updated = await prisma.education.update({
      where: { id: educationId },
      data: {
        ...(degree !== undefined && { degree }),
        ...(institution !== undefined && { institution }),
        ...(fieldOfStudy !== undefined && { fieldOfStudy }),
        ...(startYear !== undefined && { startYear }),
        ...(endYear !== undefined && { endYear }),
        ...(cgpa !== undefined && { cgpa }),
        ...(percentage !== undefined && { percentage }),
      }
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating education:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const deleteEducation = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const educationId = parseInt(req.params.educationId, 10);
    if (isNaN(studentId) || isNaN(educationId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const education = await prisma.education.findUnique({ where: { id: educationId } });
    if (!education || education.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Education record not found or ownership mismatch." });
    }

    await prisma.education.delete({ where: { id: educationId } });
    return res.status(200).json({ success: true, message: "Education record removed successfully." });
  } catch (error) {
    console.error("Error deleting education:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
