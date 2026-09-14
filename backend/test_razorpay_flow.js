/**
 * NOID Razorpay Integration Test Suite
 * Validates Order Creation, Cryptographic HMAC-SHA256 Verification,
 * Anti-Tamper Rejection, and Post-Payment ID Card Generation.
 */

const crypto = require('crypto');
const http = require('http');
const app = require('./src/server');
const { initDatabase } = require('./src/db');
const Payment = require('./src/models/Payment');
const GenerationRecord = require('./src/models/GenerationRecord');
const { RAZORPAY_KEY_SECRET } = require('./src/services/razorpayService');

let server;
let baseUrl;
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
  }
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const body = options.body ? JSON.stringify(options.body) : undefined;

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  return {
    status: res.status,
    ok: res.ok,
    data,
  };
}

async function runTests() {
  console.log('\n🧪 Starting NOID Razorpay Payment & Generation Test Suite...\n');

  await initDatabase();

  // Start temporary server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    const testPid = 'EU1244003'; // Pooja Sahu

    // Reset records for this PID for clean test run
    await GenerationRecord.deleteMany({ pid: testPid });
    await Payment.deleteMany({ pid: testPid });

    // --- TEST 1: Free Generation 1 of 3 ---
    console.log('--- TEST 1: Free Generation 1 of 3 ---');
    const gen1 = await request('/api/students/generate', {
      method: 'POST',
      body: { pid: testPid },
    });
    assert(gen1.status === 200 && gen1.data?.paymentRequired === false, 'Test 1: HTTP 200 and free generation');
    assert(gen1.data?.monthlyGenerationCount === 1, 'Test 1: monthlyGenerationCount is 1');
    assert(gen1.data?.freeGenerationsRemaining === 2, 'Test 1: freeGenerationsRemaining is 2');

    // --- TEST 2: Free Generation 2 of 3 ---
    console.log('\n--- TEST 2: Free Generation 2 of 3 ---');
    const gen2 = await request('/api/students/generate', {
      method: 'POST',
      body: { pid: testPid },
    });
    assert(gen2.status === 200 && gen2.data?.paymentRequired === false, 'Test 2: HTTP 200 and free generation');
    assert(gen2.data?.monthlyGenerationCount === 2, 'Test 2: monthlyGenerationCount is 2');
    assert(gen2.data?.freeGenerationsRemaining === 1, 'Test 2: freeGenerationsRemaining is 1');

    // --- TEST 3: Free Generation 3 of 3 ---
    console.log('\n--- TEST 3: Free Generation 3 of 3 ---');
    const gen3 = await request('/api/students/generate', {
      method: 'POST',
      body: { pid: testPid },
    });
    assert(gen3.status === 200 && gen3.data?.paymentRequired === false, 'Test 3: HTTP 200 and free generation');
    assert(gen3.data?.monthlyGenerationCount === 3, 'Test 3: monthlyGenerationCount is 3');
    assert(gen3.data?.freeGenerationsRemaining === 0, 'Test 3: freeGenerationsRemaining is 0');

    // --- TEST 4: 4th Generation Rejection (Payment Required) ---
    console.log('\n--- TEST 4: 4th Generation Requires ₹15 Payment ---');
    const gen4 = await request('/api/students/generate', {
      method: 'POST',
      body: { pid: testPid },
    });
    assert(gen4.status === 402 && gen4.data?.paymentRequired === true, 'Test 4: Rejected with 402 paymentRequired');
    assert(gen4.data?.amount === 15, 'Test 4: Amount required is exactly ₹15');

    // --- TEST 5: Create Razorpay Order ---
    console.log('\n--- TEST 5: Create Razorpay Order ---');
    const orderRes = await request('/api/payment/razorpay/create-order', {
      method: 'POST',
      body: { pid: testPid },
    });
    assert(orderRes.status === 200 && orderRes.data?.success === true, 'Test 5: Razorpay order created');
    assert(Boolean(orderRes.data?.orderId), 'Test 5: Returns valid orderId');
    assert(orderRes.data?.amountInPaise === 1500, 'Test 5: Order amount is 1500 paise (₹15)');

    const razorpayOrderId = orderRes.data.orderId;
    const razorpayPaymentId = `pay_${Date.now()}_test123`;

    // --- TEST 6: Reject Fake/Tampered HMAC Signature ---
    console.log('\n--- TEST 6: Reject Fake HMAC Signature ---');
    const fakeVerify = await request('/api/payment/razorpay/verify', {
      method: 'POST',
      body: {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: 'fake_signature_abc123',
        pid: testPid,
      },
    });
    assert(fakeVerify.status === 400 && fakeVerify.data?.verified === false, 'Test 6a: Fake signature strictly rejected');

    const fakeGen = await request('/api/students/generate', {
      method: 'POST',
      body: { pid: testPid, merchantOrderId: razorpayOrderId },
    });
    assert(fakeGen.status !== 200, 'Test 6b: Cannot generate card with unverified/fake signature (generation blocked)');

    // --- TEST 7: Accept Valid Cryptographic Signature ---
    console.log('\n--- TEST 7: Accept Authentic Cryptographic Signature ---');
    const validSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const validVerify = await request('/api/payment/razorpay/verify', {
      method: 'POST',
      body: {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: validSignature,
        pid: testPid,
      },
    });
    assert(validVerify.status === 200 && validVerify.data?.verified === true, 'Test 7: Valid HMAC signature successfully verified');
    assert(validVerify.data?.status === 'SUCCESS', 'Test 7: Status marked SUCCESS');

    // --- TEST 8: Successful Paid Generation ---
    console.log('\n--- TEST 8: Generate ID Card with Verified Razorpay Payment ---');
    const paidGen = await request('/api/students/generate', {
      method: 'POST',
      body: {
        pid: testPid,
        merchantOrderId: razorpayOrderId,
      },
    });
    assert(paidGen.status === 200 && paidGen.data?.student?.name === 'Pooja Sahu', 'Test 8a: Card successfully generated for student');
    assert(paidGen.data?.monthlyGenerationCount === 4, 'Test 8b: Generation count incremented to 4');

    // --- TEST 9: Reject Duplicate Reuse of Payment ---
    console.log('\n--- TEST 9: Reject Duplicate Usage of Payment ---');
    const dupGen = await request('/api/students/generate', {
      method: 'POST',
      body: {
        pid: testPid,
        merchantOrderId: razorpayOrderId,
      },
    });
    assert(dupGen.status === 409, 'Test 9: Duplicate usage rejected with 409 Conflict');

    console.log('\n========================================');
    console.log(`📊 Test Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('========================================\n');
  } finally {
    server.close();
    process.exit(failedCount === 0 ? 0 : 1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
