import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const prisma = new PrismaClient();

export const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, error: 'Full name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingStudent = await prisma.student.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingStudent) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const student = await prisma.student.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash
      },
      select: {
        id: true,
        fullName: true,
        email: true
      }
    });

    res.status(201).json({ success: true, data: student });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const student = await prisma.student.findUnique({
      where: { email: normalizedEmail }
    });

    if (!student || !student.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, student.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { studentId: student.id },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        student: {
          id: student.id,
          fullName: student.fullName,
          email: student.email
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getMe = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.user.studentId },
      select: {
        id: true,
        fullName: true,
        email: true,
        collegeName: true,
        branch: true,
        currentYear: true,
        cgpa: true,
        city: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.status(200).json({ success: true, data: student });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
