import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = { studentId: decoded.studentId };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireOwnership = (req, res, next) => {
  const paramId = req.params.studentId || req.params.id;
  if (!paramId) {
    return res.status(400).json({ success: false, error: 'Bad Request: Missing resource ID in URL' });
  }

  if (req.user.studentId !== Number(paramId)) {
    return res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this resource.' });
  }
  next();
};
