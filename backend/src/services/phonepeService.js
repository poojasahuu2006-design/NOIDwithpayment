const crypto = require('crypto');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
require('dotenv').config();

const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const PHONEPE_ENVIRONMENT = (process.env.PHONEPE_ENVIRONMENT || 'SANDBOX').toUpperCase();
const UPI_VPA = process.env.UPI_VPA || '8261836404@ibl';
const UPI_PAYEE_NAME = process.env.UPI_PAYEE_NAME || 'POOJA VINOD SAHU';

// In-memory payments for fallback and testing
const memoryPayments = [];

const BASE_URL =
  PHONEPE_ENVIRONMENT === 'PRODUCTION'
    ? 'https://api.phonepe.com/apis/hermes'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

/**
 * Creates a PhonePe payment order for an ID card generation (₹15 / 1500 paise)
 * and saves a PENDING Payment record in MongoDB.
 */
async function initiatePhonePePayment({
  pid,
  amount = 15,
  redirectUrl,
  callbackUrl,
}) {
  const cleanPid = (pid || '').trim().toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  const merchantOrderId = `TXN_${cleanPid}_${Date.now()}_${randomSuffix}`;
  const merchantUserId = `USER_${cleanPid}`;

  // Standard UPI URI format
  const upiUrl = `upi://pay?pa=${encodeURIComponent(UPI_VPA)}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&mc=0000&tr=${merchantOrderId}&tn=NOID%20ID%20Card%20${cleanPid}&am=${amount.toFixed(2)}&cu=INR`;

  // Generate high-resolution QR code
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(upiUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 360,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (qrErr) {
    console.error('Error generating QR code:', qrErr);
  }

  // Attempt official PhonePe PG checkout creation
  let paymentUrl = '';
  const payload = {
    merchantId: PHONEPE_MERCHANT_ID,
    merchantTransactionId: merchantOrderId,
    merchantUserId,
    amount: Math.round(amount * 100), // 1500 paise for ₹15
    redirectUrl: redirectUrl || `http://localhost:5173/?merchantOrderId=${merchantOrderId}&pid=${cleanPid}`,
    redirectMode: 'REDIRECT',
    callbackUrl: callbackUrl || `http://localhost:5000/api/payment/callback`,
    mobileNumber: '9999999999',
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  const bufferObj = Buffer.from(JSON.stringify(payload), 'utf8');
  const base64Payload = bufferObj.toString('base64');
  const stringToSign = base64Payload + '/pg/v1/pay' + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
  const xVerify = `${sha256}###${PHONEPE_SALT_INDEX}`;

  let gatewayCreated = false;
  try {
    const response = await fetch(`${BASE_URL}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        Accept: 'application/json',
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const responseData = await response.json();
    if (responseData.success && responseData.data?.instrumentResponse?.redirectInfo?.url) {
      paymentUrl = responseData.data.instrumentResponse.redirectInfo.url;
      gatewayCreated = true;
    }
  } catch (err) {
    console.debug('PhonePe gateway notice during payment initiation:', err.message);
  }

  const paymentData = {
    merchantOrderId,
    pid: cleanPid,
    amount,
    currency: 'INR',
    status: 'PENDING',
    verified: false,
    usedForGeneration: false,
    paymentUrl: paymentUrl || upiUrl,
    upiUrl,
  };

  // Persist pending payment in MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      await Payment.create(paymentData);
    } catch (dbErr) {
      console.warn('MongoDB error saving pending payment:', dbErr.message);
    }
  }

  // Always keep in memory array as backup
  const existingIdx = memoryPayments.findIndex(p => p.merchantOrderId === merchantOrderId);
  if (existingIdx >= 0) {
    memoryPayments[existingIdx] = paymentData;
  } else {
    memoryPayments.push(paymentData);
  }

  return {
    success: true,
    merchantOrderId,
    amount,
    upiUrl,
    qrCodeDataUrl,
    paymentUrl: gatewayCreated && paymentUrl ? paymentUrl : null,
    isWebGateway: Boolean(gatewayCreated && paymentUrl),
    payeeName: UPI_PAYEE_NAME,
    payeeVpa: UPI_VPA,
    status: 'PENDING',
    message: 'PhonePe payment order created. Status is PENDING.',
  };
}

/**
 * Checks payment status from official PhonePe gateway server-to-server API
 * and updates the Payment record in MongoDB.
 */
async function verifyPhonePeStatus(merchantOrderId) {
  if (!merchantOrderId) {
    return { success: false, isPending: false, message: 'Missing transaction ID' };
  }

  const cleanOrderId = String(merchantOrderId).trim();

  // 1. Fetch current Payment record from MongoDB if available
  let paymentDoc = null;
  if (mongoose.connection.readyState === 1) {
    try {
      paymentDoc = await Payment.findOne({ merchantOrderId: cleanOrderId });
    } catch (err) {
      console.warn('MongoDB error fetching payment:', err.message);
    }
  }

  if (!paymentDoc) {
    paymentDoc = memoryPayments.find(p => p.merchantOrderId === cleanOrderId);
  }

  // If already verified and marked SUCCESS in database, return verified state
  if (paymentDoc && paymentDoc.status === 'SUCCESS' && paymentDoc.verified) {
    return {
      success: true,
      verified: true,
      isPending: false,
      isFailed: false,
      code: 'PAYMENT_SUCCESS',
      message: 'Payment verified successfully.',
      amount: paymentDoc.amount || 15,
      transactionId: paymentDoc.transactionId || cleanOrderId,
      merchantOrderId: cleanOrderId,
      pid: paymentDoc.pid,
      usedForGeneration: paymentDoc.usedForGeneration,
      paymentInstrument: paymentDoc.paymentInstrument,
    };
  }

  // If payment is explicitly marked FAILED in DB
  if (paymentDoc && paymentDoc.status === 'FAILED') {
    return {
      success: false,
      verified: false,
      isPending: false,
      isFailed: true,
      code: 'PAYMENT_FAILED',
      message: 'Payment failed or was cancelled.',
      amount: paymentDoc.amount || 15,
      merchantOrderId: cleanOrderId,
      pid: paymentDoc.pid,
      usedForGeneration: paymentDoc.usedForGeneration,
    };
  }

  // 2. Query PhonePe Gateway S2S Status API
  const endpointPath = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${cleanOrderId}`;
  const stringToSign = endpointPath + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
  const xVerify = `${sha256}###${PHONEPE_SALT_INDEX}`;

  try {
    const response = await fetch(`${BASE_URL}${endpointPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': PHONEPE_MERCHANT_ID,
        Accept: 'application/json',
      },
    });

    const responseData = await response.json();
    const code = responseData.code;
    const isSuccess = responseData.success && (code === 'PAYMENT_SUCCESS' || code === 'SUCCESS');
    
    // Explicit failure codes from PhonePe
    const failureCodes = [
      'PAYMENT_ERROR',
      'PAYMENT_DECLINED',
      'TIMED_OUT',
      'USER_DROPPED',
      'PAYMENT_CANCELLED',
      'AUTHORIZATION_FAILED',
    ];
    const isFailed = failureCodes.includes(code);
    const isPending = !isSuccess && !isFailed;

    const gatewayTxnId = responseData.data?.transactionId || responseData.data?.providerReferenceId || cleanOrderId;
    const paidAmount = responseData.data?.amount ? responseData.data.amount / 100 : (paymentDoc?.amount || 15);

    // Update MongoDB Payment status based strictly on PhonePe gateway response
    if (mongoose.connection.readyState === 1 && paymentDoc) {
      if (isSuccess) {
        paymentDoc.status = 'SUCCESS';
        paymentDoc.verified = true;
        paymentDoc.transactionId = gatewayTxnId;
        paymentDoc.paymentInstrument = responseData.data?.paymentInstrument || null;
        paymentDoc.gatewayResponse = responseData;
        await paymentDoc.save();
      } else if (isFailed) {
        paymentDoc.status = 'FAILED';
        paymentDoc.verified = false;
        paymentDoc.gatewayResponse = responseData;
        await paymentDoc.save();
      }
    }

    return {
      success: isSuccess,
      verified: isSuccess,
      isPending,
      isFailed,
      code,
      message: responseData.message || (isSuccess ? 'Payment confirmed' : isPending ? 'Payment pending' : 'Payment failed'),
      amount: paidAmount,
      transactionId: gatewayTxnId,
      merchantOrderId: cleanOrderId,
      pid: paymentDoc ? paymentDoc.pid : null,
      usedForGeneration: paymentDoc ? paymentDoc.usedForGeneration : false,
      paymentInstrument: responseData.data?.paymentInstrument || null,
      raw: responseData,
    };
  } catch (err) {
    // If gateway is temporarily unreachable, maintain pending state
    return {
      success: false,
      verified: false,
      isPending: true,
      isFailed: false,
      code: 'PENDING',
      message: `Waiting for payment confirmation: ${err.message}`,
      merchantOrderId: cleanOrderId,
      pid: paymentDoc ? paymentDoc.pid : null,
      usedForGeneration: paymentDoc ? paymentDoc.usedForGeneration : false,
    };
  }
}

/**
 * Validates and handles PhonePe webhook / callback payload securely
 */
async function processPhonePeCallback(req) {
  const xVerifyHeader = req.headers['x-verify'];
  const responseBase64 = req.body?.response;

  if (!responseBase64 || !xVerifyHeader) {
    return { success: false, error: 'Missing PhonePe signature or response payload' };
  }

  // Validate X-VERIFY signature
  const stringToSign = responseBase64 + PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
  const expectedVerify = `${sha256}###${PHONEPE_SALT_INDEX}`;

  if (xVerifyHeader !== expectedVerify) {
    return { success: false, error: 'Invalid PhonePe signature verification' };
  }

  try {
    const decodedStr = Buffer.from(responseBase64, 'base64').toString('utf8');
    const callbackData = JSON.parse(decodedStr);

    const merchantOrderId = callbackData.data?.merchantTransactionId;
    const code = callbackData.code;
    const isSuccess = callbackData.success && (code === 'PAYMENT_SUCCESS' || code === 'SUCCESS');
    const isFailed = !isSuccess && code !== 'PAYMENT_PENDING';

    if (merchantOrderId && mongoose.connection.readyState === 1) {
      const paymentDoc = await Payment.findOne({ merchantOrderId });
      if (paymentDoc) {
        if (isSuccess) {
          paymentDoc.status = 'SUCCESS';
          paymentDoc.verified = true;
          paymentDoc.transactionId = callbackData.data?.transactionId || callbackData.data?.providerReferenceId;
          paymentDoc.paymentInstrument = callbackData.data?.paymentInstrument;
          paymentDoc.gatewayResponse = callbackData;
          await paymentDoc.save();
        } else if (isFailed) {
          paymentDoc.status = 'FAILED';
          paymentDoc.verified = false;
          paymentDoc.gatewayResponse = callbackData;
          await paymentDoc.save();
        }
      }
    }

    return {
      success: true,
      merchantOrderId,
      paymentStatus: isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING',
    };
  } catch (parseErr) {
    return { success: false, error: `Error processing callback payload: ${parseErr.message}` };
  }
}

module.exports = {
  PHONEPE_MERCHANT_ID,
  PHONEPE_ENVIRONMENT,
  UPI_VPA,
  UPI_PAYEE_NAME,
  initiatePhonePePayment,
  verifyPhonePeStatus,
  processPhonePeCallback,
  _memoryPayments: memoryPayments,
};
