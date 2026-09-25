import { app } from './src/app.js';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import jwt from 'jsonwebtoken';

import { env } from './src/config/env.js';

const prisma = new PrismaClient();
const PORT = 5005;
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
    // Create Students
    const student1 = await prisma.student.create({
      data: {
        fullName: 'Test Student 1',
        email: 'student1@test.com',
        cgpa: 8.0,
        currentYear: 3,
        branch: 'Computer Science'
      }
    });

    const student2 = await prisma.student.create({
      data: {
        fullName: 'Test Student 2',
        email: 'student2@test.com',
      }
    });

    const token1 = jwt.sign({ studentId: student1.id }, JWT_SECRET, { expiresIn: '1h' });
    const token2 = jwt.sign({ studentId: student2.id }, JWT_SECRET, { expiresIn: '1h' });

    // Create Skills
    const reactSkill = await prisma.skill.create({ data: { name: 'MatchReact', category: 'FRONTEND' } });
    const nodeSkill = await prisma.skill.create({ data: { name: 'MatchNode', category: 'BACKEND' } });
    
    // Add skills to student1 with evidence
    const studentSkill = await prisma.studentSkill.create({
      data: {
        studentId: student1.id,
        skillId: reactSkill.id,
        evidences: {
          create: [{ title: 'React Proj', evidenceType: 'PROJECT' }]
        }
      }
    });

    // Create Opportunities
    // Opp1: Matches React perfectly -> READY_NOW
    const opp1 = await prisma.opportunity.create({
      data: {
        title: 'React Intern',
        organization: 'ReactOrg',
        type: 'INTERNSHIP',
        workMode: 'REMOTE',
        isActive: true,
        skills: {
          create: [{ skillId: reactSkill.id, isRequired: true }]
        }
      }
    });

    // Opp2: Requires Node (Missing) -> STRETCH (or FUTURE depending on ratio, let's say 1 required)
    const opp2 = await prisma.opportunity.create({
      data: {
        title: 'Node Intern',
        organization: 'NodeOrg',
        type: 'INTERNSHIP',
        isActive: true,
        skills: {
          create: [{ skillId: nodeSkill.id, isRequired: true }]
        }
      }
    });

    // Opp3: Eligibility fail -> FUTURE
    const opp3 = await prisma.opportunity.create({
      data: {
        title: 'Strict Job',
        organization: 'StrictOrg',
        type: 'JOB',
        isActive: true,
        eligibilityRequirements: {
          create: [{ type: 'MIN_CGPA', value: '9.0' }]
        }
      }
    });

    // Opp4: Inactive
    const opp4 = await prisma.opportunity.create({
      data: {
        title: 'Inactive Opp',
        organization: 'None',
        type: 'OTHER',
        isActive: false
      }
    });

    testData = {
      student1Id: student1.id,
      student2Id: student2.id,
      opp1Id: opp1.id,
      opp2Id: opp2.id,
      opp3Id: opp3.id,
      opp4Id: opp4.id,
      reactSkillId: reactSkill.id,
      nodeSkillId: nodeSkill.id
    };

    const headers1 = { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' };
    const headers2 = { 'Authorization': `Bearer ${token2}`, 'Content-Type': 'application/json' };

    // 1. Valid authenticated request
    log('Testing valid authenticated request...');
    let res = await fetch(`${API_URL}/students/${student1.id}/matching/opportunities`, { headers: headers1 });
    let data = await res.json();
    if (!data.success) console.log(data);
    assert(data.success, 'Request should succeed');
    assert(data.data.opportunities.length >= 3, 'Should fetch at least 3 active opportunities');

    // Find our specific opps in the response
    const resOpp1 = data.data.opportunities.find(o => o.opportunity.id === opp1.id);
    const resOpp2 = data.data.opportunities.find(o => o.opportunity.id === opp2.id);
    const resOpp3 = data.data.opportunities.find(o => o.opportunity.id === opp3.id);
    
    // Fit category assertions
    assert(resOpp1.match.fitCategory === 'READY_NOW', `Opp1 should be READY_NOW, got ${resOpp1.match.fitCategory}`);
    assert(resOpp2.match.fitCategory === 'FUTURE' || resOpp2.match.fitCategory === 'STRETCH', 'Opp2 should be STRETCH/FUTURE');
    assert(resOpp3.match.fitCategory === 'FUTURE', `Opp3 should be FUTURE, got ${resOpp3.match.fitCategory}`);

    // Detail checks
    assert(resOpp1.match.requiredSkillsMatched === 1, 'Opp1 should have matched 1 required skill');
    assert(resOpp1.match.missingRequiredSkills.length === 0, 'Opp1 should have no missing required skills');
    
    assert(!resOpp3.match.eligibilityPassed, 'Opp3 should have failed eligibility');

    // 2. Missing JWT
    log('Testing missing JWT...');
    res = await fetch(`${API_URL}/students/${student1.id}/matching/opportunities`);
    assert(res.status === 401, 'Should return 401 for missing JWT');

    // 3. Invalid JWT
    log('Testing invalid JWT...');
    res = await fetch(`${API_URL}/students/${student1.id}/matching/opportunities`, { headers: { 'Authorization': 'Bearer invalid' } });
    assert(res.status === 401, 'Should return 401 for invalid JWT');

    // 4. Student 1 requesting Student 2 (Security check)
    log('Testing authorization cross-access...');
    res = await fetch(`${API_URL}/students/${student2.id}/matching/opportunities`, { headers: headers1 });
    assert(res.status === 403, 'Should return 403 when requesting another student');

    // 5. Unknown student
    log('Testing unknown student...');
    const tokenUnknown = jwt.sign({ studentId: 99999 }, JWT_SECRET, { expiresIn: '1h' });
    res = await fetch(`${API_URL}/students/99999/matching/opportunities`, { headers: { 'Authorization': `Bearer ${tokenUnknown}` } });
    assert(res.status === 404, 'Should return 404 for unknown student');

    // 13. Inactive excluded
    log('Testing inactive opportunity exclusion...');
    const resOpp4 = data.data.opportunities.find(o => o.opportunity.id === opp4.id);
    assert(!resOpp4, 'Inactive opportunity should not be in the results');

    // 14. FitCategory filter
    log('Testing fitCategory filter...');
    res = await fetch(`${API_URL}/students/${student1.id}/matching/opportunities?fitCategory=READY_NOW`, { headers: headers1 });
    data = await res.json();
    assert(data.data.opportunities.every(o => o.match.fitCategory === 'READY_NOW'), 'All should be READY_NOW');

    // 15. Type filter
    log('Testing type filter...');
    res = await fetch(`${API_URL}/students/${student1.id}/matching/opportunities?type=JOB`, { headers: headers1 });
    data = await res.json();
    assert(data.data.opportunities.every(o => o.opportunity.type === 'JOB'), 'All should be JOB');

    // 21. Empty results
    log('Testing empty results...');
    res = await fetch(`${API_URL}/students/${student1.id}/matching/opportunities?fitCategory=READY_NOW&type=OTHER`, { headers: headers1 });
    data = await res.json();
    assert(data.success && data.data.opportunities.length === 0, 'Should return empty array with 200 OK');

    log('All Matching API tests passed successfully.');

  } catch (err) {
    log(`TEST FAILED: ${err.stack}`);
    process.exitCode = 1;
  } finally {
    log('Cleaning up test data...');
    if (testData.opp1Id) await prisma.opportunity.deleteMany({ where: { id: { in: [testData.opp1Id, testData.opp2Id, testData.opp3Id, testData.opp4Id] } } });
    if (testData.student1Id) await prisma.student.deleteMany({ where: { id: { in: [testData.student1Id, testData.student2Id] } } });
    if (testData.reactSkillId) await prisma.skill.deleteMany({ where: { id: { in: [testData.reactSkillId, testData.nodeSkillId] } } });
    await prisma.studentOpportunityEvaluation.deleteMany({ where: { studentId: testData.student1Id } });
    await prisma.$disconnect();
    if (server) server.close();
  }
}

runTests();
