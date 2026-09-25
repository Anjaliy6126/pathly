import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const getGoals = async (req, res) => {
  try {
    const goals = await prisma.goal.findMany();
    return res.status(200).json({ success: true, data: goals });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const getStudentGoals = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const goals = await prisma.studentGoal.findMany({ 
      where: { studentId },
      include: { goal: true }
    });
    return res.status(200).json({ success: true, data: goals });
  } catch (error) {
    console.error("Error getting student goals:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const addStudentGoal = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId) || studentId <= 0) return res.status(400).json({ success: false, message: "Invalid student ID." });

    const { goalId, note } = req.body;
    const parsedGoalId = parseInt(goalId, 10);
    if (isNaN(parsedGoalId) || parsedGoalId <= 0) return res.status(400).json({ success: false, message: "goalId must be a positive integer." });

    const studentExists = await prisma.student.findUnique({ where: { id: studentId } });
    if (!studentExists) return res.status(404).json({ success: false, message: "Student not found." });

    const goalExists = await prisma.goal.findUnique({ where: { id: parsedGoalId } });
    if (!goalExists) return res.status(404).json({ success: false, message: "Goal not found." });

    const existingStudentGoal = await prisma.studentGoal.findUnique({
      where: { studentId_goalId: { studentId, goalId: parsedGoalId } }
    });
    if (existingStudentGoal) return res.status(409).json({ success: false, message: "Student already has this goal." });

    const studentGoal = await prisma.studentGoal.create({
      data: {
        studentId,
        goalId: parsedGoalId,
        note: note || null
      },
      include: { goal: true }
    });

    return res.status(201).json({ success: true, data: studentGoal });
  } catch (error) {
    console.error("Error adding student goal:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

export const removeStudentGoal = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const studentGoalId = parseInt(req.params.studentGoalId, 10);
    if (isNaN(studentId) || isNaN(studentGoalId)) return res.status(400).json({ success: false, message: "Invalid IDs." });

    const studentGoal = await prisma.studentGoal.findUnique({ where: { id: studentGoalId } });
    if (!studentGoal || studentGoal.studentId !== studentId) {
      return res.status(404).json({ success: false, message: "Student goal not found or ownership mismatch." });
    }

    await prisma.studentGoal.delete({ where: { id: studentGoalId } });
    return res.status(200).json({ success: true, message: "Student goal removed successfully." });
  } catch (error) {
    console.error("Error removing student goal:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
