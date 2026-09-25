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
