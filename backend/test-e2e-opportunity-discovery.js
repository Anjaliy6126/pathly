import { app } from './src/app.js';
import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();
const PORT = 5004;
const API_URL = `http://localhost:${PORT}/api`;

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
    // Create base skills
    const reactSkill = await prisma.skill.create({ data: { name: 'ReactTest', category: 'FRONTEND' } });
    const nodeSkill = await prisma.skill.create({ data: { name: 'NodeTest', category: 'BACKEND' } });
    
    // Create opportunities
    const opp1 = await prisma.opportunity.create({
      data: {
        title: 'Frontend React Internship',
        organization: 'GoogleTest',
        description: 'React development.',
        type: 'INTERNSHIP',
        workMode: 'REMOTE',
        location: 'Delhi',
        isActive: true,
        skills: {
          create: [
            { skillId: reactSkill.id, isRequired: true }
          ]
        },
        cycles: {
          create: [
            { cycleLabel: '2026', status: 'OPEN', applicationDeadline: new Date('2026-10-15') }
          ]
        }
      }
    });

    const opp2 = await prisma.opportunity.create({
      data: {
        title: 'Backend Node Job',
        organization: 'AmazonTest',
        description: 'Node development.',
        type: 'JOB',
        workMode: 'ONSITE',
        location: 'Seattle',
        isActive: true,
        skills: {
          create: [
            { skillId: nodeSkill.id, isRequired: true },
            { skillId: reactSkill.id, isRequired: false }
          ]
        },
        cycles: {
          create: [
            { cycleLabel: '2027', status: 'UPCOMING', applicationDeadline: new Date('2027-10-15') }
          ]
        }
      }
    });
    
    const opp3 = await prisma.opportunity.create({
      data: {
        title: 'Inactive Test Opp',
        organization: 'GoogleTest',
        type: 'INTERNSHIP',
        isActive: false
      }
    });

    // Create OpportunitySource and Verification for opp1
    const source = await prisma.opportunitySource.create({
      data: { name: 'Test Source', sourceType: 'COMPANY' }
    });
    await prisma.opportunityVerification.create({
      data: {
        opportunityId: opp1.id,
        sourceId: source.id,
        status: 'VERIFIED',
        verifiedBy: 'tester'
      }
    });

    testData = {
      reactSkillId: reactSkill.id,
      nodeSkillId: nodeSkill.id,
      opp1Id: opp1.id,
      opp2Id: opp2.id,
      opp3Id: opp3.id,
      sourceId: source.id
    };

    // 1. Basic opportunity list & Pagination
    log('Testing Basic list & Pagination...');
    let res = await fetch(`${API_URL}/opportunities`);
    let data = await res.json();
    assert(data.success, 'Request failed');
    assert(data.data.pagination.total >= 2, 'Should find at least 2 active opportunities');
    
    // 2. Keyword filter
    log('Testing Keyword filter...');
    res = await fetch(`${API_URL}/opportunities?keyword=frontend`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 by keyword');
    
    // 3. Type filter
    log('Testing Type filter...');
    res = await fetch(`${API_URL}/opportunities?type=JOB`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp2.id), 'Should find opp2 by type');
    assert(!data.data.opportunities.some(o => o.id === opp1.id), 'Should not find opp1 by type=JOB');

    // 4. Work mode filter
    log('Testing Work Mode filter...');
    res = await fetch(`${API_URL}/opportunities?workMode=REMOTE`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 by workMode');

    // 5. Location partial filter
    log('Testing Location partial filter...');
    res = await fetch(`${API_URL}/opportunities?location=del`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 by location del');

    // 6. Organization partial filter
    log('Testing Organization filter...');
    res = await fetch(`${API_URL}/opportunities?organization=google`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 by organization');

    // 7-9. Skill filters
    log('Testing Skill filters...');
    res = await fetch(`${API_URL}/opportunities?skill=ReactTest`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id) && data.data.opportunities.some(o => o.id === opp2.id), 'Should find both by skill ReactTest');

    res = await fetch(`${API_URL}/opportunities?requiredSkill=ReactTest`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id) && !data.data.opportunities.some(o => o.id === opp2.id), 'Should find opp1 only for requiredSkill ReactTest');

    res = await fetch(`${API_URL}/opportunities?preferredSkill=ReactTest`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp2.id), 'Should find opp2 for preferredSkill ReactTest');

    // 10. Deadline range filter
    log('Testing Deadline filter...');
    res = await fetch(`${API_URL}/opportunities?deadlineFrom=2026-01-01&deadlineTo=2026-12-31`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 by deadline');
    assert(!data.data.opportunities.some(o => o.id === opp2.id), 'Should not find opp2 by deadline');

    // 11. Cycle status filter
    log('Testing Cycle Status filter...');
    res = await fetch(`${API_URL}/opportunities?status=OPEN`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 by cycle status OPEN');

    // 12. Verification status filter
    log('Testing Verification Status filter...');
    res = await fetch(`${API_URL}/opportunities?verificationStatus=VERIFIED`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 by verification status');
    assert(!data.data.opportunities.some(o => o.id === opp2.id), 'Should not find opp2 by verification status');

    // 13. Multiple filters together
    log('Testing Multiple filters...');
    res = await fetch(`${API_URL}/opportunities?type=INTERNSHIP&workMode=REMOTE&skill=ReactTest&status=OPEN`);
    data = await res.json();
    assert(data.data.opportunities.some(o => o.id === opp1.id), 'Should find opp1 with combined filters');

    // 15-18. Invalid inputs
    log('Testing Invalid Inputs...');
    const errType = await fetch(`${API_URL}/opportunities?type=INVALID_TYPE`);
    assert(errType.status === 400, 'Expected 400 for invalid type');

    const errDate = await fetch(`${API_URL}/opportunities?deadlineFrom=not-a-date`);
    assert(errDate.status === 400, 'Expected 400 for invalid date');

    const errPage = await fetch(`${API_URL}/opportunities?page=0`);
    assert(errPage.status === 400, 'Expected 400 for invalid page');

    // 19. Inactive opportunity excluded
    log('Testing Inactive Opportunity Exclusion...');
    res = await fetch(`${API_URL}/opportunities`);
    data = await res.json();
    assert(!data.data.opportunities.some(o => o.id === opp3.id), 'Should NOT find inactive opp3');

    log('All Discovery API tests passed successfully.');

  } catch (err) {
    log(`TEST FAILED: ${err.stack}`);
    process.exitCode = 1;
  } finally {
    log('Cleaning up test data...');
    if (testData.opp1Id) await prisma.opportunity.deleteMany({ where: { id: { in: [testData.opp1Id, testData.opp2Id, testData.opp3Id] } } });
    if (testData.reactSkillId) await prisma.skill.deleteMany({ where: { id: { in: [testData.reactSkillId, testData.nodeSkillId] } } });
    if (testData.sourceId) await prisma.opportunitySource.deleteMany({ where: { id: testData.sourceId } });
    await prisma.$disconnect();
    if (server) server.close();
  }
}

runTests();
