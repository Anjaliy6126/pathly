import { app } from './src/app.js';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';

const prisma = new PrismaClient();
const PORT = 5007;
const API_URL = `http://localhost:${PORT}/api`;
const JWT_SECRET = env.jwtSecret;

const log = (msg) => console.log(`[TEST] ${msg}`);
const assert = (condition, msg) => {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
};

async function runTests() {
  let server;
  let testData = {};

  try {
    log('Starting test server...');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    log('Creating test data...');
    // Create students
    // Goals
    const timestamp = Date.now();
    const student1 = await prisma.student.create({ data: { fullName: 'Profile Student 1', email: `prof1_${timestamp}@test.com` } });
    const student2 = await prisma.student.create({ data: { fullName: 'Profile Student 2', email: `prof2_${timestamp}@test.com` } });
    const studentEmpty = await prisma.student.create({ data: { fullName: 'Empty Student', email: `empty_${timestamp}@test.com` } });

    // Education
    const edu1 = await prisma.education.create({ data: { studentId: student1.id, degree: 'B.Tech', institution: 'Test College', startYear: 2022, endYear: 2026 } });
    const edu2 = await prisma.education.create({ data: { studentId: student1.id, degree: 'Class XII', institution: 'Test School', startYear: 2020, endYear: 2022 } });

    // Goals
    const newGoal = await prisma.goal.create({ data: { name: `Software Development ${timestamp}` } });
    const goal1 = await prisma.studentGoal.create({ data: { studentId: student1.id, goalId: newGoal.id, note: 'Frontend focus' } });

    // Skills & Evidence
    const skillReact = await prisma.skill.create({ data: { name: `ReactProf_${timestamp}`, category: 'FRONTEND' } });
    const skillNode = await prisma.skill.create({ data: { name: `NodeProf_${timestamp}`, category: 'BACKEND' } });

    const sSkill1 = await prisma.studentSkill.create({
      data: {
        studentId: student1.id,
        skillId: skillReact.id,
        source: 'PROJECT',
        evidences: {
          create: [
            { evidenceType: 'PROJECT', title: 'React Web' },
            { evidenceType: 'GITHUB_REPOSITORY', title: 'react-web-repo' }
          ]
        }
      }
    });

    const sSkill2 = await prisma.studentSkill.create({
      data: { studentId: student1.id, skillId: skillNode.id, source: 'SELF_STUDY' } // No evidence
    });

    // Projects
    const proj1 = await prisma.project.create({
      data: {
        studentId: student1.id,
        title: 'Project 1',
        status: 'COMPLETED',
        skills: {
          create: [{ skillId: skillReact.id }]
        }
      }
    });

    const proj2 = await prisma.project.create({
      data: { studentId: student1.id, title: 'Project 2', status: 'ONGOING' }
    });

    testData = {
      students: [student1.id, student2.id, studentEmpty.id],
      skills: [skillReact.id, skillNode.id]
    };

    const token1 = jwt.sign({ studentId: student1.id }, JWT_SECRET, { expiresIn: '1h' });
    const token2 = jwt.sign({ studentId: student2.id }, JWT_SECRET, { expiresIn: '1h' });
    const tokenEmpty = jwt.sign({ studentId: studentEmpty.id }, JWT_SECRET, { expiresIn: '1h' });

    const headers1 = { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' };

    log('Testing valid authenticated request...');
    let res = await fetch(`${API_URL}/students/${student1.id}/capability-profile`, { headers: headers1 });
    let data = await res.json();
    assert(data.success, 'Failed to get capability profile');
    
    const p = data.data;

    // 2. Student summary returned
    assert(p.student.id === student1.id, 'Student summary incorrect');
    assert(p.student.fullName === 'Profile Student 1', 'Student name incorrect');
    
    // 3. passwordHash not returned
    assert(p.student.passwordHash === undefined, 'passwordHash must not be exposed');

    // 4. Education returned (newest first by endYear desc)
    assert(p.education.length === 2, 'Should return 2 education records');
    assert(p.education[0].endYear === 2026, 'Should sort newest education first');

    // 5. Goals returned
    assert(p.goals.length === 1 && p.goals[0].name.startsWith('Software Development'), 'Should return goals');

    // 6. Skills returned
    assert(p.skills.length === 2, 'Should return 2 skills');
    
    // 7. Skill evidence returned
    const reactSkillData = p.skills.find(s => s.skill.name.startsWith('ReactProf'));
    assert(reactSkillData.evidence.length === 2, 'Should return 2 evidence items for React');

    // 8. Projects returned
    assert(p.projects.length === 2, 'Should return 2 projects');
    
    // 9. Project skills returned
    const p1 = p.projects.find(proj => proj.title === 'Project 1');
    assert(p1.skills.length === 1 && p1.skills[0].name.startsWith('ReactProf'), 'Should return project skills');

    // 10. Summary counts are correct
    assert(p.summary.skillCount === 2, 'skillCount should be 2');
    
    // 11. skillsWithEvidence count is correct
    assert(p.summary.skillsWithEvidence === 1, 'skillsWithEvidence should be 1');
    
    // 12. evidenceCount is correct
    assert(p.summary.evidenceCount === 2, 'evidenceCount should be 2');
    
    // 13. completedProjectCount is correct
    assert(p.summary.completedProjectCount === 1, 'completedProjectCount should be 1');
    assert(p.summary.projectCount === 2, 'projectCount should be 2');
    assert(p.summary.educationRecordCount === 2, 'educationRecordCount should be 2');
    assert(p.summary.goalCount === 1, 'goalCount should be 1');

    // 14. evidenceByType counts are correct
    assert(p.evidenceByType['PROJECT'] === 1, 'evidenceByType PROJECT should be 1');
    assert(p.evidenceByType['GITHUB_REPOSITORY'] === 1, 'evidenceByType GITHUB_REPOSITORY should be 1');

    // 15. skillsByCategory counts are correct
    assert(p.skillsByCategory['FRONTEND'] === 1, 'skillsByCategory FRONTEND should be 1');
    assert(p.skillsByCategory['BACKEND'] === 1, 'skillsByCategory BACKEND should be 1');

    // 16. Missing JWT -> 401
    res = await fetch(`${API_URL}/students/${student1.id}/capability-profile`);
    assert(res.status === 401, 'Should return 401 for missing JWT');

    // 17. Invalid JWT -> 401
    res = await fetch(`${API_URL}/students/${student1.id}/capability-profile`, { headers: { 'Authorization': 'Bearer invalid' } });
    assert(res.status === 401, 'Should return 401 for invalid JWT');

    // 18. Student A accessing Student B -> 403
    res = await fetch(`${API_URL}/students/${student2.id}/capability-profile`, { headers: headers1 });
    assert(res.status === 403, 'Should return 403 for cross-access');

    // 19. Unknown student -> 404
    const tokenUnknown = jwt.sign({ studentId: 99999 }, JWT_SECRET, { expiresIn: '1h' });
    res = await fetch(`${API_URL}/students/99999/capability-profile`, { headers: { 'Authorization': `Bearer ${tokenUnknown}` } });
    assert(res.status === 404, 'Should return 404 for unknown student');

    // 20. Student with no optional records returns empty arrays and zero counts
    res = await fetch(`${API_URL}/students/${studentEmpty.id}/capability-profile`, { headers: { 'Authorization': `Bearer ${tokenEmpty}` } });
    data = await res.json();
    assert(data.data.education.length === 0, 'Empty student should have 0 education');
    assert(data.data.summary.skillCount === 0, 'Empty student should have 0 skills');
    assert(Object.keys(data.data.evidenceByType).length === 0, 'Empty student should have empty evidenceByType');

    log('All Capability Profile API tests passed successfully.');

  } catch (err) {
    log(`TEST FAILED: ${err.stack}`);
    process.exitCode = 1;
  } finally {
    log('Cleaning up test data...');
    if (testData.students) {
      await prisma.student.deleteMany({ where: { id: { in: testData.students } } });
    }
    if (testData.skills) {
      await prisma.skill.deleteMany({ where: { id: { in: testData.skills } } });
    }
    await prisma.$disconnect();
    if (server) server.close();
  }
}

runTests();
