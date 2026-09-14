const crypto = require('crypto');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
require('dotenv').config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_NOIDKeyDemo';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'noid_secret_key_demo12345';

// In-memory fallback if MongoDB is not connected
const memoryRazorpayPayments = [];

let razorpayInstance = null;
try {
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
} catch (initErr) {
  console.warn('Razorpay initialization warning:', initErr.message);
}

/**
 * Creates a Razorpay order for ₹15 (1500 paise) and records it as PENDING.
 */
async function createRazorpayOrder({ pid, amount = 15 }) {
  const cleanPid = (pid || '').trim().toUpperCase();
  const timestamp = Date.now();
  const receipt = `rcpt_${cleanPid}_${timestamp}`.slice(0, 40);
  const amountInPaise = Math.round(amount * 100);

  let orderId = `order_${cleanPid}_${timestamp}`;
  let razorpayOrderData = null;

  if (razorpayInstance && process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('Demo')) {
    try {
      const order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          pid: cleanPid,
          purpose: 'NOID ID Card Generation Fee',
        },
      });
      if (order && order.id) {
        orderId = order.id;
        razorpayOrderData = order;
      }
    } catch (orderErr) {
      console.warn('Razorpay live order creation notice (using internal order tracking):', orderErr.message);
      orderId = `order_test_${cleanPid}_${timestamp}`;
    }
  } else {
    // Standard mock order ID for development & test suites
    orderId = `order_${cleanPid}_${timestamp}`;
  }

  const paymentData = {
    merchantOrderId: orderId,
    razorpayOrderId: orderId,
    pid: cleanPid,
    amount,
    currency: 'INR',
    status: 'PENDING',
    verified: false,
    usedForGeneration: false,
    provider: 'RAZORPAY',
    gatewayResponse: razorpayOrderData,
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Payment.create(paymentData);
    } catch (dbErr) {
      console.warn('DB create payment warning:', dbErr.message);
    }
  } else {
    memoryRazorpayPayments.push({ ...paymentData, createdAt: new Date() });
  }

  return {
    success: true,
    orderId,
    razorpayOrderId: orderId,
    merchantOrderId: orderId,
    amount,
    amountInPaise,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID,
    pid: cleanPid,
  };
}

/**
 * Cryptographically verifies Razorpay payment using HMAC-SHA256.
 * Formula: HMAC_SHA256(order_id + "|" + razorpay_payment_id, secret) === razorpay_signature
 */
async function verifyRazorpaySignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  pid,
}) {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return {
      success: false,
      verified: false,
      error: 'Missing required Razorpay parameters (order_id, payment_id, signature).',
    };
  }

  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const isMatch =
    generatedSignature.length === razorpaySignature.length &&
    crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(razorpaySignature));

  if (!isMatch) {
    return {
      success: false,
      verified: false,
      error: 'Cryptographic signature mismatch. Payment cannot be verified.',
    };
  }

  const cleanPid = (pid || '').trim().toUpperCase();

  // Update DB status to SUCCESS and verified: true
  if (mongoose.connection.readyState === 1) {
    try {
      const updated = await Payment.findOneAndUpdate(
        {
          $or: [
            { razorpayOrderId: razorpayOrderId },
            { merchantOrderId: razorpayOrderId },
          ],
        },
        {
          $set: {
            status: 'SUCCESS',
            verified: true,
            razorpayPaymentId,
            razorpaySignature,
            transactionId: razorpayPaymentId,
            verifiedAt: new Date(),
          },
        },
        { new: true }
      );

      if (updated) {
        return {
          success: true,
          verified: true,
          status: 'SUCCESS',
          merchantOrderId: updated.merchantOrderId,
          razorpayOrderId: updated.razorpayOrderId,
          razorpayPaymentId,
          amount: updated.amount,
          pid: updated.pid,
        };
      }
    } catch (dbErr) {
      console.warn('DB update payment warning:', dbErr.message);
    }
  }

  // Fallback memory payment update
  const memPayment = memoryRazorpayPayments.find(
    (p) => p.razorpayOrderId === razorpayOrderId || p.merchantOrderId === razorpayOrderId
  );
  if (memPayment) {
    memPayment.status = 'SUCCESS';
    memPayment.verified = true;
    memPayment.razorpayPaymentId = razorpayPaymentId;
    memPayment.razorpaySignature = razorpaySignature;
    memPayment.transactionId = razorpayPaymentId;
    memPayment.verifiedAt = new Date();
  }

  return {
    success: true,
    verified: true,
    status: 'SUCCESS',
    merchantOrderId: razorpayOrderId,
    razorpayOrderId,
    razorpayPaymentId,
    amount: 15,
    pid: cleanPid,
  };
}

/**
 * Gets payment verification status
 */
async function getRazorpayPaymentStatus(orderId) {
  if (!orderId) return null;

  if (mongoose.connection.readyState === 1) {
    try {
      const payment = await Payment.findOne({
        $or: [{ razorpayOrderId: orderId }, { merchantOrderId: orderId }, { transactionId: orderId }],
      });
      return payment;
    } catch (err) {
      console.error('Error fetching Razorpay payment:', err);
    }
  }

  return (
    memoryRazorpayPayments.find(
      (p) =>
        p.razorpayOrderId === orderId ||
        p.merchantOrderId === orderId ||
        p.transactionId === orderId
    ) || null
  );
}

module.exports = {
  createRazorpayOrder,
  verifyRazorpaySignature,
  getRazorpayPaymentStatus,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
};
