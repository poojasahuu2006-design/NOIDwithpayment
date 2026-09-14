const mongoose = require('mongoose');
const http = require('http');
const app = require('./src/server');
const Student = require('./src/models/Student');
const GenerationRecord = require('./src/models/GenerationRecord');
const Payment = require('./src/models/Payment');
const { getMonthlyGenerationCount, recordSuccessfulGeneration, _memoryGenerationRecords } = require('./src/services/generationService');

const { initDatabase } = require('./src/db');

let server;
let baseUrl;

async function runTests() {
  console.log('🧪 Starting NOID Payment & Generation Test Suite...\n');

  await initDatabase();

  // Start express server on a random free port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${name}`);
      failed++;
    }
  }

  try {
    const testPid = 'EU1244004'; // Shamitha Palai in SEED_STUDENTS

    // Clear previous test records for this PID in DB if connected
    if (mongoose.connection.readyState === 1) {
      await GenerationRecord.deleteMany({ pid: testPid });
      await Payment.deleteMany({ pid: testPid });
    }
    _memoryGenerationRecords.length = 0;

    // -------------------------------------------------------------
    // TEST 1: PID with 0 generations -> Free -> Count becomes 1
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Free Generation 1 of 3 ---');
    const res1 = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid }),
    });
    const data1 = await res1.json();
    assert(res1.status === 200 && data1.success === true && data1.paymentRequired === false, 'Test 1: HTTP 200 and paymentRequired=false');
    assert(data1.monthlyGenerationCount === 1, 'Test 1: monthlyGenerationCount is 1');
    assert(data1.freeGenerationsRemaining === 2, 'Test 1: freeGenerationsRemaining is 2');

    // -------------------------------------------------------------
    // TEST 2: PID with 1 generation -> Free -> Count becomes 2
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Free Generation 2 of 3 ---');
    const res2 = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid }),
    });
    const data2 = await res2.json();
    assert(res2.status === 200 && data2.success === true && data2.paymentRequired === false, 'Test 2: HTTP 200 and paymentRequired=false');
    assert(data2.monthlyGenerationCount === 2, 'Test 2: monthlyGenerationCount is 2');
    assert(data2.freeGenerationsRemaining === 1, 'Test 2: freeGenerationsRemaining is 1');

    // -------------------------------------------------------------
    // TEST 3: PID with 2 generations -> Free -> Count becomes 3
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Free Generation 3 of 3 ---');
    const res3 = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid }),
    });
    const data3 = await res3.json();
    assert(res3.status === 200 && data3.success === true && data3.paymentRequired === false, 'Test 3: HTTP 200 and paymentRequired=false');
    assert(data3.monthlyGenerationCount === 3, 'Test 3: monthlyGenerationCount is 3');
    assert(data3.freeGenerationsRemaining === 0, 'Test 3: freeGenerationsRemaining is 0');

    // -------------------------------------------------------------
    // TEST 4: PID with 3 generations -> Payment required -> Create order
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: 4th Generation Requires ₹15 Payment ---');
    const res4Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid }),
    });
    const data4Gen = await res4Gen.json();
    assert(res4Gen.status === 402 && data4Gen.paymentRequired === true, 'Test 4a: Direct generation rejected with 402 paymentRequired');

    // Create payment order
    const res4Pay = await fetch(`${baseUrl}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid }),
    });
    const data4Pay = await res4Pay.json();
    assert(res4Pay.status === 200 && data4Pay.success === true && data4Pay.status === 'PENDING', 'Test 4b: Payment order created as PENDING');
    assert(Boolean(data4Pay.merchantOrderId), 'Test 4c: merchantOrderId returned');
    assert(data4Pay.amount === 15, 'Test 4d: Amount is exactly 15');

    const testOrderId = data4Pay.merchantOrderId;

    // -------------------------------------------------------------
    // TEST 5: User has not paid -> Status is PENDING -> Generation rejected
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Status remains PENDING while unpaid ---');
    const res5Status = await fetch(`${baseUrl}/api/payment/status/${testOrderId}?pid=${testPid}`);
    const data5Status = await res5Status.json();
    assert(data5Status.status === 'PENDING' && data5Status.verified === false, 'Test 5a: Status check returns PENDING, verified=false');

    const res5Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid, merchantOrderId: testOrderId }),
    });
    assert(res5Gen.status === 202 || res5Gen.status === 402, 'Test 5b: Cannot generate card while payment is PENDING');

    // -------------------------------------------------------------
    // TEST 6: User cancels payment / FAILED status
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Failed Payment Handling ---');
    const failedOrderId = `TXN_${testPid}_FAILED_${Date.now()}`;
    if (mongoose.connection.readyState === 1) {
      await Payment.create({
        merchantOrderId: failedOrderId,
        pid: testPid,
        amount: 15,
        status: 'FAILED',
        verified: false,
      });
    }
    const res6Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid, merchantOrderId: failedOrderId }),
    });
    assert(res6Gen.status === 402, 'Test 6: Failed payment cannot be used to generate card');

    // -------------------------------------------------------------
    // TEST 7: PhonePe confirms SUCCESS -> Backend verifies -> Verified SUCCESS
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: PhonePe Verified Payment ---');
    const verifiedOrderId = `TXN_${testPid}_SUCCESS_${Date.now()}`;
    if (mongoose.connection.readyState === 1) {
      await Payment.create({
        merchantOrderId: verifiedOrderId,
        transactionId: `PH_${Date.now()}`,
        pid: testPid,
        amount: 15,
        status: 'SUCCESS',
        verified: true,
        usedForGeneration: false,
      });
    }
    const res7Status = await fetch(`${baseUrl}/api/payment/status/${verifiedOrderId}?pid=${testPid}`);
    const data7Status = await res7Status.json();
    assert(data7Status.status === 'SUCCESS' && data7Status.verified === true, 'Test 7: Backend returns verified SUCCESS');

    // -------------------------------------------------------------
    // TEST 8: Generate ID Card after verified payment -> Count becomes 4
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Successful Paid Generation ---');
    const res8Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid, merchantOrderId: verifiedOrderId }),
    });
    const data8Gen = await res8Gen.json();
    assert(res8Gen.status === 200 && data8Gen.success === true && data8Gen.paymentRequired === true, 'Test 8a: Generation succeeds with verified payment');
    assert(data8Gen.monthlyGenerationCount === 4, 'Test 8b: Generation count increased to 4');

    // -------------------------------------------------------------
    // TEST 9: Duplicate payment usage prevention (Idempotency)
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Reject Duplicate Usage of Payment ---');
    const res9Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid, merchantOrderId: verifiedOrderId }),
    });
    const data9Gen = await res9Gen.json();
    assert(res9Gen.status === 409, 'Test 9: Rejects duplicate payment consumption with 409 Conflict');

    // -------------------------------------------------------------
    // TEST 10: Fake / Tampered Order ID Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Cannot Fake Success via Random Order ID ---');
    const fakeOrderId = `FAKE_ORDER_${Date.now()}`;
    const res10Status = await fetch(`${baseUrl}/api/payment/status/${fakeOrderId}?pid=${testPid}`);
    const data10Status = await res10Status.json();
    assert(data10Status.verified === false, 'Test 10a: Fake order status is not verified');

    const res10Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid, merchantOrderId: fakeOrderId }),
    });
    assert(res10Gen.status !== 200, 'Test 10b: Fake order cannot generate ID card');

    // -------------------------------------------------------------
    // TEST 11: Reject Underpaid / Tampered Amount
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Tampered Amount Rejection ---');
    const underpaidOrderId = `TXN_${testPid}_UNDERPAID_${Date.now()}`;
    if (mongoose.connection.readyState === 1) {
      await Payment.create({
        merchantOrderId: underpaidOrderId,
        pid: testPid,
        amount: 1, // Underpaid
        status: 'SUCCESS',
        verified: true,
      });
    }
    const res11Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid, merchantOrderId: underpaidOrderId }),
    });
    assert(res11Gen.status === 400 || res11Gen.status === 402, 'Test 11: Rejects underpaid amount');

    // -------------------------------------------------------------
    // TEST 12: Manually Sending Fake Payment Status in Body
    // -------------------------------------------------------------
    console.log('\n--- TEST 12: Ignore Client-Sent Fake Status ---');
    const res12Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: testPid, paymentStatus: 'SUCCESS', verified: true }),
    });
    assert(res12Gen.status !== 200, 'Test 12: Server ignores client paymentStatus flag');

    // -------------------------------------------------------------
    // TEST 13: Month Boundary - Previous Month Records Do Not Affect Current Month
    // -------------------------------------------------------------
    console.log('\n--- TEST 13: Calendar Month Reset ---');
    const oldMonthPid = 'EU1244001'; // Manaswi Gharat
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

    if (mongoose.connection.readyState === 1) {
      await GenerationRecord.deleteMany({ pid: oldMonthPid });
      // Insert 5 generations in previous month
      for (let i = 0; i < 5; i++) {
        await GenerationRecord.create({
          pid: oldMonthPid,
          generatedAt: lastMonthDate,
          generationStatus: 'SUCCESS',
        });
      }
    }

    const currentCount = await getMonthlyGenerationCount(oldMonthPid);
    assert(currentCount === 0, 'Test 13a: Current month count for oldMonthPid is 0 despite 5 last month');

    const res13Gen = await fetch(`${baseUrl}/api/students/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: oldMonthPid }),
    });
    const data13Gen = await res13Gen.json();
    assert(res13Gen.status === 200 && data13Gen.paymentRequired === false, 'Test 13b: First generation in new month is FREE');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log(`\n========================================`);
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
