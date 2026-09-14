const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDatabase, findStudentByPid, getSamplePids, isDbConnected } = require('./db');
const Payment = require('./models/Payment');
const {
  getMonthlyQuotaInfo,
  getMonthlyGenerationCount,
  hasTransactionBeenUsed,
  recordSuccessfulGeneration,
  getMonthDisplay,
} = require('./services/generationService');
const {
  initiatePhonePePayment,
  verifyPhonePeStatus,
  processPhonePeCallback,
  PHONEPE_ENVIRONMENT,
} = require('./services/phonepeService');
const {
  createRazorpayOrder,
  verifyRazorpaySignature,
  getRazorpayPaymentStatus,
  RAZORPAY_KEY_ID,
} = require('./services/razorpayService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets & student photos
const staticDir = path.join(__dirname, '..', '..', 'frontend', 'static');
const photosDir = path.join(staticDir, 'photos');
const publicDir = path.join(__dirname, '..', '..', 'frontend', 'public');

app.use('/static', express.static(staticDir));
app.use('/photos', express.static(photosDir));
app.use('/photos', express.static(path.join(publicDir, 'photos')));
app.use(express.static(staticDir));
app.use(express.static(publicDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'NOID',
    version: '2.2.0',
    dbConnected: isDbConnected(),
    phonepeEnvironment: PHONEPE_ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

// Sample PIDs
app.get('/api/students/sample', (req, res) => {
  res.json({
    samples: getSamplePids(),
  });
});

// Check Monthly Quota for a PID
app.get('/api/students/quota/:pid', async (req, res) => {
  try {
    const { pid } = req.params;
    const cleanPid = (pid || '').trim().toUpperCase();
    const student = await findStudentByPid(cleanPid);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: `Student with PID "${pid}" not found.`,
      });
    }

    const quota = await getMonthlyQuotaInfo(cleanPid);
    return res.json({
      success: true,
      student,
      quota,
    });
  } catch (err) {
    console.error('Error fetching quota:', err);
    return res.status(500).json({
      success: false,
      error: 'Error retrieving student monthly quota.',
    });
  }
});

// Get student by PID parameter
app.get('/api/students/:pid', async (req, res) => {
  try {
    const { pid } = req.params;
    const student = await findStudentByPid(pid);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: `Student with PID "${pid}" not found. Please verify the PID number.`,
      });
    }

    const quota = await getMonthlyQuotaInfo(student.pid);

    return res.json({
      success: true,
      student,
      quota,
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred while retrieving student data.',
    });
  }
});

/**
 * Initiate PhonePe / UPI Payment (₹15)
 * Requirements:
 * 1. Validate PID.
 * 2. Find student.
 * 3. Calculate this month's successful generation count.
 * 4. Reject payment creation if the PID still has free generations (< 3).
 * 5. If count >= 3, create a PhonePe order for ₹15.
 * 6. Generate a unique merchantOrderId.
 * 7. Store Payment as PENDING.
 * 8. Return ONLY checkout/order information to frontend (status: PENDING).
 */
app.post('/api/payment/create', async (req, res) => {
  try {
    const pid = (req.body.pid || '').trim().toUpperCase();
    const redirectUrl = req.body.redirectUrl;
    const callbackUrl = req.body.callbackUrl;

    if (!pid) {
      return res.status(400).json({
        success: false,
        error: 'PID is required to initiate payment.',
      });
    }

    const student = await findStudentByPid(pid);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: `Student with PID "${pid}" not found.`,
      });
    }

    // Confirm payment is strictly required (count >= 3)
    const currentCount = await getMonthlyGenerationCount(pid);
    if (currentCount < 3) {
      return res.status(400).json({
        success: false,
        message: `Payment not required. You still have ${3 - currentCount} free generation(s) remaining this month.`,
      });
    }

    const paymentResult = await initiatePhonePePayment({
      pid,
      amount: 15,
      redirectUrl,
      callbackUrl,
    });

    if (paymentResult.success) {
      return res.json({
        success: true,
        merchantOrderId: paymentResult.merchantOrderId,
        paymentUrl: paymentResult.paymentUrl,
        isWebGateway: paymentResult.isWebGateway,
        upiUrl: paymentResult.upiUrl,
        qrCodeDataUrl: paymentResult.qrCodeDataUrl,
        amount: paymentResult.amount || 15,
        payeeName: paymentResult.payeeName,
        payeeVpa: paymentResult.payeeVpa,
        environment: PHONEPE_ENVIRONMENT,
        status: 'PENDING',
        message: 'PhonePe payment order created. Complete payment to verify.',
      });
    } else {
      return res.status(502).json({
        success: false,
        error: paymentResult.message || 'Failed to initialize payment gateway.',
      });
    }
  } catch (error) {
    console.error('Error in /api/payment/create:', error);
    return res.status(500).json({
      success: false,
      error: `Server error during payment creation: ${error.message}`,
    });
  }
});

/**
 * Verify PhonePe Payment Status API
 * GET /api/payment/status/:merchantOrderId
 * Returns authentic backend status: PENDING, SUCCESS, FAILED, or CANCELLED.
 * Does NOT generate an ID card on GET.
 */
app.get('/api/payment/status/:merchantOrderId', async (req, res) => {
  try {
    const { merchantOrderId } = req.params;
    const cleanOrderId = (merchantOrderId || '').trim();

    if (!cleanOrderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing merchantOrderId.',
      });
    }

    // Query PhonePe Gateway and update local Payment model
    const verification = await verifyPhonePeStatus(cleanOrderId);
    const pid = verification.pid || (req.query.pid || '').trim().toUpperCase();

    let student = null;
    if (pid) {
      student = await findStudentByPid(pid);
    }

    if (verification.success && verification.verified) {
      return res.json({
        success: true,
        merchantOrderId: cleanOrderId,
        transactionId: verification.transactionId,
        status: 'SUCCESS',
        verified: true,
        amount: verification.amount || 15,
        pid,
        student,
        usedForGeneration: Boolean(verification.usedForGeneration),
        message: 'Payment verified successfully by PhonePe gateway.',
      });
    } else if (verification.isPending) {
      return res.json({
        success: true,
        merchantOrderId: cleanOrderId,
        status: 'PENDING',
        verified: false,
        amount: verification.amount || 15,
        pid,
        student,
        message: 'Payment is pending. Please complete transaction on PhonePe.',
      });
    } else {
      return res.json({
        success: true,
        merchantOrderId: cleanOrderId,
        status: 'FAILED',
        verified: false,
        error: verification.message || 'Payment failed or was cancelled.',
        pid,
        student,
        message: 'Payment failed or was cancelled.',
      });
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      error: `Server error while verifying payment: ${error.message}`,
    });
  }
});

/**
 * PhonePe Server Callback / Webhook
 */
app.post('/api/payment/callback', async (req, res) => {
  try {
    const result = await processPhonePeCallback(req);
    if (result.success) {
      return res.status(200).json({ success: true, message: 'Callback processed successfully.' });
    } else {
      return res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('Error processing PhonePe callback:', err);
    return res.status(500).json({ success: false, error: 'Internal callback processing error' });
  }
});

/**
 * Create Razorpay Order Endpoint
 * POST /api/payment/razorpay/create-order
 * Creates an authentic ₹15 (1500 paise) Razorpay order for students whose free limit >= 3.
 */
app.post('/api/payment/razorpay/create-order', async (req, res) => {
  try {
    const pid = (req.body.pid || req.body.pidNumber || '').trim().toUpperCase();

    if (!pid) {
      return res.status(400).json({
        success: false,
        error: 'Student PID is required to initiate payment.',
      });
    }

    const student = await findStudentByPid(pid);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: `Student with PID "${pid}" not found.`,
      });
    }

    // Confirm payment is required (generation count >= 3)
    const currentCount = await getMonthlyGenerationCount(pid);
    if (currentCount < 3) {
      return res.status(400).json({
        success: false,
        message: `Payment not required. You still have ${3 - currentCount} free generation(s) remaining this month.`,
      });
    }

    const orderData = await createRazorpayOrder({ pid, amount: 15 });

    return res.json({
      success: true,
      orderId: orderData.orderId,
      razorpayOrderId: orderData.razorpayOrderId,
      merchantOrderId: orderData.merchantOrderId,
      amount: orderData.amount,
      amountInPaise: orderData.amountInPaise,
      currency: orderData.currency,
      keyId: orderData.keyId,
      pid: orderData.pid,
      studentName: student.name,
      studentEmail: `${pid.toLowerCase()}@universal.edu.in`,
      studentContact: '9876543210',
      message: 'Razorpay order created successfully.',
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      success: false,
      error: `Server error creating Razorpay order: ${error.message}`,
    });
  }
});

/**
 * Verify Razorpay Signature Endpoint
 * POST /api/payment/razorpay/verify
 * Cryptographically verifies Razorpay payment using HMAC-SHA256.
 */
app.post('/api/payment/razorpay/verify', async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, pid } = req.body;
    const cleanPid = (pid || '').trim().toUpperCase();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: razorpayOrderId, razorpayPaymentId, razorpaySignature are required.',
      });
    }

    const verifyResult = await verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      pid: cleanPid,
    });

    if (!verifyResult.success || !verifyResult.verified) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: verifyResult.error || 'Payment signature verification failed. Untrusted payment source.',
      });
    }

    let student = null;
    if (cleanPid) {
      student = await findStudentByPid(cleanPid);
    }

    return res.json({
      success: true,
      verified: true,
      status: 'SUCCESS',
      merchantOrderId: verifyResult.merchantOrderId,
      razorpayOrderId: verifyResult.razorpayOrderId,
      razorpayPaymentId: verifyResult.razorpayPaymentId,
      transactionId: verifyResult.razorpayPaymentId,
      amount: verifyResult.amount || 15,
      pid: cleanPid,
      student,
      message: 'Payment verified successfully via Razorpay.',
    });
  } catch (error) {
    console.error('Error in /api/payment/razorpay/verify:', error);
    return res.status(500).json({
      success: false,
      error: `Internal server error during signature verification: ${error.message}`,
    });
  }
});

/**
 * Main Generation Endpoint:
 * - Free if < 3 generations in current calendar month
 * - Requires verified ₹15 payment (Razorpay or PhonePe) if >= 3 generations
 * - Prevents duplicate usage of payment transactions
 */
app.post('/api/students/generate', async (req, res) => {
  try {
    const pid = (req.body.pid || req.body.pidNumber || '').trim().toUpperCase();
    const orderId = (
      req.body.merchantOrderId ||
      req.body.razorpayOrderId ||
      req.body.razorpayPaymentId ||
      req.body.transactionId ||
      req.body.merchantTransactionId ||
      ''
    ).trim();

    if (!pid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PID. Please provide a valid student PID.',
      });
    }

    const student = await findStudentByPid(pid);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: `Student with PID "${pid}" not found. Please try again.`,
      });
    }

    const currentMonthlyCount = await getMonthlyGenerationCount(pid);
    const monthInfo = getMonthDisplay();

    // 1. FREE GENERATION (< 3 in calendar month)
    if (currentMonthlyCount < 3) {
      await recordSuccessfulGeneration({
        pid,
        paymentRequired: false,
        amount: 0,
      });

      const newCount = currentMonthlyCount + 1;
      const freeRemaining = Math.max(0, 3 - newCount);

      return res.json({
        success: true,
        paymentRequired: false,
        monthlyGenerationCount: newCount,
        freeGenerationsRemaining: freeRemaining,
        monthName: monthInfo.monthName,
        year: monthInfo.year,
        student,
        message: 'ID card generated successfully.',
      });
    }

    // 2. PAID GENERATION (>= 3 in calendar month)
    // A verified, unconsumed payment order for ₹15 is strictly required
    if (!orderId) {
      return res.status(402).json({
        success: false,
        paymentRequired: true,
        amount: 15,
        monthlyGenerationCount: currentMonthlyCount,
        freeGenerationsRemaining: 0,
        monthName: monthInfo.monthName,
        year: monthInfo.year,
        message: `₹15 payment is required for this generation. Free limit (3/3) reached for ${monthInfo.monthName} ${monthInfo.year}.`,
      });
    }

    // Check if the order has already been consumed
    const alreadyUsed = await hasTransactionBeenUsed(orderId);
    if (alreadyUsed) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate transaction. This payment has already been used to generate an ID card.',
      });
    }

    // First check Razorpay payment records
    let paymentRecord = await getRazorpayPaymentStatus(orderId);
    let verified = false;
    let paymentAmount = 15;
    let paymentTxnId = orderId;
    let paymentPid = pid;

    if (paymentRecord && paymentRecord.status === 'SUCCESS' && paymentRecord.verified) {
      verified = true;
      paymentAmount = paymentRecord.amount || 15;
      paymentTxnId = paymentRecord.transactionId || paymentRecord.razorpayPaymentId || orderId;
      paymentPid = paymentRecord.pid || pid;
    } else {
      // Check PhonePe status
      const phonePeVerify = await verifyPhonePeStatus(orderId);
      if (phonePeVerify.success && phonePeVerify.verified) {
        verified = true;
        paymentAmount = phonePeVerify.amount || 15;
        paymentTxnId = phonePeVerify.transactionId || orderId;
        paymentPid = phonePeVerify.pid || pid;
      } else if (phonePeVerify.isPending) {
        return res.status(202).json({
          success: false,
          paymentPending: true,
          message: 'Payment is still pending. Please complete transaction on payment gateway.',
        });
      }
    }

    // Validate that payment belongs to this PID, has ₹15 amount, and is verified SUCCESS
    if (!verified) {
      return res.status(402).json({
        success: false,
        paymentFailed: true,
        error: 'Payment verification failed. Please complete ₹15 payment with Razorpay.',
      });
    }

    if (paymentPid && paymentPid !== pid) {
      return res.status(403).json({
        success: false,
        error: `This payment order belongs to PID ${paymentPid}, not ${pid}.`,
      });
    }

    if (paymentAmount < 15) {
      return res.status(400).json({
        success: false,
        error: `Invalid payment amount (₹${paymentAmount}). ₹15 is required.`,
      });
    }

    // Atomically record paid generation and mark payment order as consumed
    await recordSuccessfulGeneration({
      pid,
      paymentRequired: true,
      amount: paymentAmount,
      merchantOrderId: orderId,
      transactionId: paymentTxnId,
    });

    const newCount = await getMonthlyGenerationCount(pid);
    const freeRemaining = Math.max(0, 3 - newCount);

    return res.json({
      success: true,
      paymentRequired: true,
      paymentSuccess: true,
      monthlyGenerationCount: newCount,
      freeGenerationsRemaining: freeRemaining,
      monthName: monthInfo.monthName,
      year: monthInfo.year,
      student,
      message: 'Payment verified! ID card generated successfully.',
    });
  } catch (error) {
    console.error('Error generating card:', error);
    return res.status(500).json({
      success: false,
      error: `Server error while generating student ID card: ${error.message}`,
    });
  }
});

// Serve frontend build if dist folder exists
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/photos') || req.path.startsWith('/static')) {
    return next();
  }
  const indexHtml = path.join(distDir, 'index.html');
  if (require('fs').existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  next();
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start Server & Connect MongoDB
async function startServer() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 NOID Express Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
