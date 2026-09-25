import { app } from './src/app.js';
import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();
const PORT = 5002;
const API_URL = `http://localhost:${PORT}/api`;

const log = (msg) => console.log(`[TEST] ${msg}`);
const assert = (condition, msg) => {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
};

async function runTests() {
  let server;
  let oppId;
  let skillId;
  let oppSkillId;
  let eligId;

  try {
    log('Starting test server...');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    log('Creating a test Skill for linking...');
    const testSkill = await prisma.skill.create({
      data: { name: 'TestSkill_E2E', category: 'OTHER' }
    });
    skillId = testSkill.id;

    // 1. Create opportunity -> 201
    log('Testing Create Opportunity...');
    const createRes = await fetch(`${API_URL}/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Internship',
        organization: 'Test Org',
        description: 'A test description',
        type: 'INTERNSHIP',
        workMode: 'REMOTE',
        location: 'Earth',
        stipendMin: 100,
        stipendMax: 500,
        applyUrl: 'https://example.com/apply',
        deadline: '2030-01-01',
        isActive: true
      })
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, `Expected 201, got ${createRes.status}`);
    oppId = createData.data.id;

    // 7,8,9. Invalid inputs
    const invalidRes1 = await fetch(`${API_URL}/opportunities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', organization: 'O', type: 'INVALID_TYPE' })
    });
    assert(invalidRes1.status === 400, 'Expected 400 for invalid type');

    const invalidRes2 = await fetch(`${API_URL}/opportunities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', organization: 'O', type: 'INTERNSHIP', applyUrl: 'not-a-url' })
    });
    assert(invalidRes2.status === 400, 'Expected 400 for invalid URL');

    const invalidRes3 = await fetch(`${API_URL}/opportunities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', organization: 'O', type: 'INTERNSHIP', stipendMin: 500, stipendMax: 100 })
    });
    assert(invalidRes3.status === 400, 'Expected 400 for invalid stipend range');

    // 2. Get opportunity list -> 200
    log('Testing Get Opportunity List...');
    const listRes = await fetch(`${API_URL}/opportunities?type=INTERNSHIP`);
    const listData = await listRes.json();
    assert(listRes.status === 200, 'Expected 200');
    assert(listData.data.some(o => o.id === oppId), 'Created opportunity should be in the list');

    // 3. Get opportunity details -> 200
    log('Testing Get Opportunity Details...');
    const detRes = await fetch(`${API_URL}/opportunities/${oppId}`);
    const detData = await detRes.json();
    assert(detRes.status === 200, 'Expected 200');
    assert(detData.data.title === 'Test Internship', 'Title should match');

    // 4. Update opportunity -> 200
    log('Testing Update Opportunity...');
    const updRes = await fetch(`${API_URL}/opportunities/${oppId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Test Internship' })
    });
    const updData = await updRes.json();
    assert(updRes.status === 200, 'Expected 200');
    assert(updData.data.title === 'Updated Test Internship', 'Title should be updated');

    // 10. Attach existing skill -> 201
    log('Testing Add Opportunity Skill...');
    const addSkillRes = await fetch(`${API_URL}/opportunities/${oppId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, minimumLevel: 2, isRequired: true })
    });
    const addSkillData = await addSkillRes.json();
    assert(addSkillRes.status === 201, 'Expected 201');
    oppSkillId = addSkillData.data.id;

    // 11. Get opportunity skills -> 200
    log('Testing Get Opportunity Skills...');
    const getSkillsRes = await fetch(`${API_URL}/opportunities/${oppId}/skills`);
    const getSkillsData = await getSkillsRes.json();
    assert(getSkillsRes.status === 200, 'Expected 200');
    assert(getSkillsData.data.length === 1, 'Should have 1 skill attached');

    // 12. Duplicate skill -> 409
    const dupSkillRes = await fetch(`${API_URL}/opportunities/${oppId}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId, minimumLevel: 3 })
    });
    assert(dupSkillRes.status === 409, 'Expected 409 for duplicate skill');

    // 13. Update opportunity skill -> 200
    log('Testing Update Opportunity Skill...');
    const updSkillRes = await fetch(`${API_URL}/opportunities/${oppId}/skills/${oppSkillId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minimumLevel: 4 })
    });
    const updSkillData = await updSkillRes.json();
    assert(updSkillRes.status === 200, 'Expected 200');
    assert(updSkillData.data.minimumLevel === 4, 'Level should be updated');

    // 14. Delete opportunity skill -> 200
    log('Testing Delete Opportunity Skill...');
    const delSkillRes = await fetch(`${API_URL}/opportunities/${oppId}/skills/${oppSkillId}`, {
      method: 'DELETE'
    });
    assert(delSkillRes.status === 200, 'Expected 200');

    // 15. Verify master skill still exists
    const masterSkill = await prisma.skill.findUnique({ where: { id: skillId } });
    assert(masterSkill !== null, 'Master skill should not be deleted');

    // 16. Add eligibility -> 201
    log('Testing Add Eligibility...');
    const addEligRes = await fetch(`${API_URL}/opportunities/${oppId}/eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'MIN_CGPA', value: '8.0' })
    });
    const addEligData = await addEligRes.json();
    assert(addEligRes.status === 201, 'Expected 201');
    eligId = addEligData.data.id;

    // 17. Get eligibility -> 200
    const getEligRes = await fetch(`${API_URL}/opportunities/${oppId}/eligibility`);
    const getEligData = await getEligRes.json();
    assert(getEligRes.status === 200, 'Expected 200');
    assert(getEligData.data.length === 1, 'Should have 1 eligibility');

    // 18. Update eligibility -> 200
    log('Testing Update Eligibility...');
    const updEligRes = await fetch(`${API_URL}/opportunities/${oppId}/eligibility/${eligId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '8.5' })
    });
    const updEligData = await updEligRes.json();
    assert(updEligRes.status === 200, 'Expected 200');
    assert(updEligData.data.value === '8.5', 'Value should be updated');

    // 19. Delete eligibility -> 200
    log('Testing Delete Eligibility...');
    const delEligRes = await fetch(`${API_URL}/opportunities/${oppId}/eligibility/${eligId}`, {
      method: 'DELETE'
    });
    assert(delEligRes.status === 200, 'Expected 200');

    // 20. Try modifying eligibility belonging to another opportunity -> 404
    const badUpdEligRes = await fetch(`${API_URL}/opportunities/9999/eligibility/${eligId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '9.0' })
    });
    assert(badUpdEligRes.status === 404, 'Expected 404 when mismatching opportunityId');

    // 5. Deactivate opportunity -> 200
    log('Testing Deactivate Opportunity...');
    const deactRes = await fetch(`${API_URL}/opportunities/${oppId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false })
    });
    const deactData = await deactRes.json();
    assert(deactRes.status === 200, 'Expected 200');
    assert(deactData.data.isActive === false, 'Should be deactivated');

    // 6. Inactive opportunity should not appear in public listing
    log('Testing Inactive Opportunity Not In Public List...');
    const listRes2 = await fetch(`${API_URL}/opportunities`);
    const listData2 = await listRes2.json();
    assert(!listData2.data.some(o => o.id === oppId), 'Deactivated opportunity should NOT be in the list');

    // Inactive opportunity details should return 404
    const detRes2 = await fetch(`${API_URL}/opportunities/${oppId}`);
    assert(detRes2.status === 404, 'Expected 404 for deactivated opportunity details');

    log('All Opportunity API tests passed successfully.');

  } catch (err) {
    log(`TEST FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    log('Cleaning up test data...');
    if (oppId) await prisma.opportunity.deleteMany({ where: { id: oppId } });
    if (skillId) await prisma.skill.deleteMany({ where: { id: skillId } });
    await prisma.$disconnect();
    if (server) server.close();
  }
}

runTests();
