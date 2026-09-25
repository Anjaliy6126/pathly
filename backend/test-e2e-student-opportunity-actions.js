import { app } from './src/app.js';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';

const prisma = new PrismaClient();
const PORT = 5006;
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
    const student1 = await prisma.student.create({ data: { fullName: 'Action Student 1', email: 'action1@test.com' } });
    const student2 = await prisma.student.create({ data: { fullName: 'Action Student 2', email: 'action2@test.com' } });

    const opp1 = await prisma.opportunity.create({
      data: { title: 'Active Opp 1', organization: 'Org1', type: 'INTERNSHIP', isActive: true }
    });
    const opp2 = await prisma.opportunity.create({
      data: { title: 'Active Opp 2', organization: 'Org2', type: 'JOB', isActive: true }
    });
    const oppInactive = await prisma.opportunity.create({
      data: { title: 'Inactive Opp', organization: 'Org3', type: 'OTHER', isActive: false }
    });

    testData = { s1: student1.id, s2: student2.id, o1: opp1.id, o2: opp2.id, oi: oppInactive.id };

    const token1 = jwt.sign({ studentId: student1.id }, JWT_SECRET, { expiresIn: '1h' });
    const token2 = jwt.sign({ studentId: student2.id }, JWT_SECRET, { expiresIn: '1h' });

    const headers1 = { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' };
    const headers2 = { 'Authorization': `Bearer ${token2}`, 'Content-Type': 'application/json' };

    // BOOKMARKS
    log('Testing Bookmarks...');
    
    // 2. Bookmark valid active opportunity -> 201
    let res = await fetch(`${API_URL}/students/${student1.id}/bookmarks`, {
      method: 'POST', headers: headers1, body: JSON.stringify({ opportunityId: opp1.id })
    });
    let data = await res.json();
    assert(data.success, 'Failed to create bookmark');
    const bookmarkId = data.data.id;

    // 3. Duplicate bookmark -> 409
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks`, {
      method: 'POST', headers: headers1, body: JSON.stringify({ opportunityId: opp1.id })
    });
    assert(res.status === 409, 'Expected 409 for duplicate bookmark');

    // 4. List bookmarks -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks`, { headers: headers1 });
    data = await res.json();
    assert(data.data.bookmarks.length === 1, 'Should have 1 bookmark');
    
    // 5. Check existing bookmark -> bookmarked=true
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks/${opp1.id}`, { headers: headers1 });
    data = await res.json();
    assert(data.data.bookmarked === true, 'Should be bookmarked');

    // 6. Check non-bookmarked opportunity -> bookmarked=false
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks/${opp2.id}`, { headers: headers1 });
    data = await res.json();
    assert(data.data.bookmarked === false, 'Should not be bookmarked');

    // 7. Delete bookmark -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks/${bookmarkId}`, { method: 'DELETE', headers: headers1 });
    assert(res.status === 200, 'Expected 200 for delete bookmark');

    // 8. Check again -> bookmarked=false
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks/${opp1.id}`, { headers: headers1 });
    data = await res.json();
    assert(data.data.bookmarked === false, 'Should be false after deletion');

    // APPLICATIONS
    log('Testing Applications...');

    // 9. Create application -> 201
    res = await fetch(`${API_URL}/students/${student1.id}/applications`, {
      method: 'POST', headers: headers1, body: JSON.stringify({ opportunityId: opp1.id, notes: 'Test notes' })
    });
    data = await res.json();
    assert(res.status === 201, 'Failed to create application');
    const appId = data.data.id;

    // 10. Verify status is APPLIED
    assert(data.data.status === 'APPLIED', 'Initial status should be APPLIED');
    // 11. Verify appliedAt exists
    assert(data.data.appliedAt !== null, 'appliedAt should not be null');

    // 12. Duplicate application -> 409
    res = await fetch(`${API_URL}/students/${student1.id}/applications`, {
      method: 'POST', headers: headers1, body: JSON.stringify({ opportunityId: opp1.id })
    });
    assert(res.status === 409, 'Expected 409 for duplicate application');

    // 13. List applications -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/applications`, { headers: headers1 });
    data = await res.json();
    assert(data.data.applications.length === 1, 'Should have 1 application');

    // 14. Get single application -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${appId}`, { headers: headers1 });
    data = await res.json();
    assert(data.data.id === appId, 'Should return the correct application');

    // 15. Update to SHORTLISTED -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${appId}`, {
      method: 'PATCH', headers: headers1, body: JSON.stringify({ status: 'SHORTLISTED' })
    });
    data = await res.json();
    assert(data.data.status === 'SHORTLISTED', 'Status should be SHORTLISTED');

    // 16. Update notes -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${appId}`, {
      method: 'PATCH', headers: headers1, body: JSON.stringify({ notes: 'Updated notes' })
    });
    data = await res.json();
    assert(data.data.notes === 'Updated notes', 'Notes should be updated');

    // 17. Filter by SHORTLISTED -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/applications?status=SHORTLISTED`, { headers: headers1 });
    data = await res.json();
    assert(data.data.applications.length === 1, 'Should return 1 application when filtered');

    res = await fetch(`${API_URL}/students/${student1.id}/applications?status=REJECTED`, { headers: headers1 });
    data = await res.json();
    assert(data.data.applications.length === 0, 'Should return 0 applications when filtered for REJECTED');

    // 18. Update to SELECTED -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${appId}`, {
      method: 'PATCH', headers: headers1, body: JSON.stringify({ status: 'SELECTED' })
    });
    assert(res.status === 200, 'Update to SELECTED should succeed');

    // 19. Delete application -> 200
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${appId}`, { method: 'DELETE', headers: headers1 });
    assert(res.status === 200, 'Expected 200 for delete application');

    // 20. Verify application no longer exists
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${appId}`, { headers: headers1 });
    assert(res.status === 404, 'Application should be deleted');

    // VALIDATION & SECURITY
    log('Testing Validation & Security...');

    // 21. Invalid opportunityId -> 400
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks`, {
      method: 'POST', headers: headers1, body: JSON.stringify({ opportunityId: 'invalid' })
    });
    assert(res.status === 400, 'Expected 400 for invalid opportunityId');

    // 22. Unknown opportunity -> 404
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks`, {
      method: 'POST', headers: headers1, body: JSON.stringify({ opportunityId: 99999 })
    });
    assert(res.status === 404, 'Expected 404 for unknown opportunity');

    // 23. Invalid status -> 400
    // Create temp app
    const tempApp = await prisma.studentOpportunityApplication.create({ data: { studentId: student1.id, opportunityId: opp2.id } });
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${tempApp.id}`, {
      method: 'PATCH', headers: headers1, body: JSON.stringify({ status: 'FAKE_STATUS' })
    });
    assert(res.status === 400, 'Expected 400 for invalid status');

    // 24. Invalid page -> 400
    res = await fetch(`${API_URL}/students/${student1.id}/applications?page=-1`, { headers: headers1 });
    assert(res.status === 400, 'Expected 400 for invalid page');

    // 26. Missing JWT -> 401
    res = await fetch(`${API_URL}/students/${student1.id}/applications`);
    assert(res.status === 401, 'Expected 401 for missing JWT');

    // 28. Cross-student bookmark access blocked -> 403
    res = await fetch(`${API_URL}/students/${student2.id}/bookmarks`, { headers: headers1 });
    assert(res.status === 403, 'Expected 403 for cross-student access');

    // 29. Cross-student application access blocked -> 403
    res = await fetch(`${API_URL}/students/${student2.id}/applications`, { headers: headers1 });
    assert(res.status === 403, 'Expected 403 for cross-student access');
    
    // Cross-student delete (requires token2 for URL 2, but we use token1)
    // Create bookmark for s2
    const b2 = await prisma.studentOpportunityBookmark.create({ data: { studentId: student2.id, opportunityId: opp1.id } });
    res = await fetch(`${API_URL}/students/${student2.id}/bookmarks/${b2.id}`, { method: 'DELETE', headers: headers1 });
    assert(res.status === 403, 'Expected 403 for cross-student delete');

    // 30. Inactive opportunity cannot receive a new bookmark/application
    res = await fetch(`${API_URL}/students/${student1.id}/bookmarks`, {
      method: 'POST', headers: headers1, body: JSON.stringify({ opportunityId: oppInactive.id })
    });
    assert(res.status === 400, 'Expected 400 for bookmarking inactive opp');

    // 31. Existing records remain readable after opportunity deactivation
    // Make opp2 inactive
    await prisma.opportunity.update({ where: { id: opp2.id }, data: { isActive: false } });
    res = await fetch(`${API_URL}/students/${student1.id}/applications/${tempApp.id}`, { headers: headers1 });
    data = await res.json();
    assert(res.status === 200 && data.data.id === tempApp.id, 'Should still be able to read tracking for deactivated opp');

    log('All Actions API tests passed successfully.');

  } catch (err) {
    log(`TEST FAILED: ${err.stack}`);
    process.exitCode = 1;
  } finally {
    log('Cleaning up test data...');
    if (testData.s1) await prisma.student.deleteMany({ where: { id: { in: [testData.s1, testData.s2] } } });
    if (testData.o1) await prisma.opportunity.deleteMany({ where: { id: { in: [testData.o1, testData.o2, testData.oi] } } });
    await prisma.$disconnect();
    if (server) server.close();
  }
}

runTests();
