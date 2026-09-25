import { app } from './src/app.js';
import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();
const PORT = 5003;
const API_URL = `http://localhost:${PORT}/api`;

const log = (msg) => console.log(`[TEST] ${msg}`);
const assert = (condition, msg) => {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
};

async function runTests() {
  let server;
  let oppId;
  let cycleId2026;
  let cycleId2027;

  try {
    log('Starting test server...');
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));

    // 1. Create test opportunity
    log('Creating a test Opportunity for cycles...');
    const oppRes = await fetch(`${API_URL}/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Cycle Test Opp',
        organization: 'Cycle Org',
        type: 'INTERNSHIP'
      })
    });
    const oppData = await oppRes.json();
    oppId = oppData.data.id;

    // 2. Create 2026 cycle -> 201
    log('Testing Create 2026 Cycle...');
    const cycle2026Res = await fetch(`${API_URL}/opportunities/${oppId}/cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycleLabel: '2026',
        applicationStart: '2025-09-01',
        applicationDeadline: '2025-10-15',
        status: 'OPEN'
      })
    });
    const cycle2026Data = await cycle2026Res.json();
    assert(cycle2026Res.status === 201, 'Expected 201 for creating cycle');
    cycleId2026 = cycle2026Data.data.id;

    // 3. Create 2027 cycle -> 201
    log('Testing Create 2027 Cycle...');
    const cycle2027Res = await fetch(`${API_URL}/opportunities/${oppId}/cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycleLabel: '2027',
        status: 'UPCOMING'
      })
    });
    const cycle2027Data = await cycle2027Res.json();
    assert(cycle2027Res.status === 201, 'Expected 201 for creating second cycle');
    cycleId2027 = cycle2027Data.data.id;

    // 4. Get cycles -> 200 and both cycles returned
    log('Testing Get Cycles...');
    const getCyclesRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles`);
    const getCyclesData = await getCyclesRes.json();
    assert(getCyclesRes.status === 200, 'Expected 200');
    assert(getCyclesData.data.length === 2, 'Should return 2 cycles');

    // 5. Get individual cycle -> 200
    log('Testing Get Individual Cycle...');
    const getCycleRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}`);
    const getCycleData = await getCycleRes.json();
    assert(getCycleRes.status === 200, 'Expected 200');
    assert(getCycleData.data.cycleLabel === '2026', 'Cycle label should match');

    // 6. Update cycle -> 200
    log('Testing Update Cycle...');
    const updCycleRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    const updCycleData = await updCycleRes.json();
    assert(updCycleRes.status === 200, 'Expected 200');
    assert(updCycleData.data.status === 'CLOSED', 'Status should be updated');

    // 7. Duplicate cycleLabel for same opportunity -> 409
    log('Testing Duplicate Cycle Label...');
    const dupCycleRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleLabel: '2026' })
    });
    assert(dupCycleRes.status === 409, 'Expected 409 for duplicate cycleLabel');

    // 8. Try accessing cycle through another opportunity ID -> 404
    log('Testing Access Cycle Across Opportunities...');
    const otherOppRes = await fetch(`${API_URL}/opportunities/99999/cycles/${cycleId2026}`);
    assert(otherOppRes.status === 404, 'Expected 404');

    // 11-13. Create Verifications
    log('Testing Create Verification (VERIFIED)...');
    const ver1Res = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}/verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED', verifiedBy: 'admin' })
    });
    assert(ver1Res.status === 201, 'Expected 201 for verification');

    // Small delay to ensure verifiedAt difference
    await new Promise(r => setTimeout(r, 100));

    log('Testing Create Verification (NEEDS_REVIEW)...');
    const ver2Res = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}/verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'NEEDS_REVIEW', verifiedBy: 'system' })
    });
    assert(ver2Res.status === 201, 'Expected 201 for second verification');

    // 14. Get verification history
    log('Testing Get Verification History...');
    const getVerRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}/verifications`);
    const getVerData = await getVerRes.json();
    assert(getVerRes.status === 200, 'Expected 200');
    assert(getVerData.data.length === 2, 'Should have 2 verification records');
    assert(getVerData.data[0].status === 'NEEDS_REVIEW', 'Newest should be NEEDS_REVIEW');

    // 15. Get latest verification
    log('Testing Get Latest Verification...');
    const latestVerRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}/verification`);
    const latestVerData = await latestVerRes.json();
    assert(latestVerRes.status === 200, 'Expected 200');
    assert(latestVerData.data.status === 'NEEDS_REVIEW', 'Latest should be NEEDS_REVIEW');

    // 16. Try accessing verification through another opportunity/cycle -> 404
    const badVerRes = await fetch(`${API_URL}/opportunities/99999/cycles/${cycleId2026}/verification`);
    assert(badVerRes.status === 404, 'Expected 404');

    // 9, 10, 17. Delete cycle
    log('Testing Delete Cycle...');
    const delRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}`, {
      method: 'DELETE'
    });
    assert(delRes.status === 200, 'Expected 200 for deletion');

    const checkDelRes = await fetch(`${API_URL}/opportunities/${oppId}/cycles/${cycleId2026}`);
    assert(checkDelRes.status === 404, 'Expected 404 for deleted cycle');

    log('All Cycle & Verification API tests passed successfully.');

  } catch (err) {
    log(`TEST FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    log('Cleaning up test data...');
    if (oppId) await prisma.opportunity.deleteMany({ where: { id: oppId } });
    await prisma.$disconnect();
    if (server) server.close();
  }
}

runTests();
