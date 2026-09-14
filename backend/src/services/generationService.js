const mongoose = require('mongoose');
const GenerationRecord = require('../models/GenerationRecord');
const Payment = require('../models/Payment');

// Fallback in-memory storage for offline scenarios
const memoryGenerationRecords = [];

/**
 * Computes the exact UTC boundary for the current calendar month on the server.
 */
function getMonthDateRange(date = new Date()) {
  const startOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const startOfNextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { startOfMonth, startOfNextMonth };
}

/**
 * Formats month name and year for display (e.g. "September 2026")
 */
function getMonthDisplay(date = new Date()) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return {
    monthName: monthNames[date.getUTCMonth()],
    monthIndex: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

/**
 * Gets total successful generation count for the given PID in the current calendar month.
 * Rule:
 * 1st, 2nd, 3rd generations -> FREE
 * 4th onwards -> ₹15
 * Automatic reset at the start of a new calendar month.
 */
async function getMonthlyGenerationCount(pid) {
  if (!pid || typeof pid !== 'string') return 0;
  const cleanPid = pid.trim().toUpperCase();
  const { startOfMonth, startOfNextMonth } = getMonthDateRange();

  if (mongoose.connection.readyState === 1) {
    try {
      const count = await GenerationRecord.countDocuments({
        pid: cleanPid,
        generationStatus: 'SUCCESS',
        generatedAt: {
          $gte: startOfMonth,
          $lt: startOfNextMonth,
        },
      });
      return count;
    } catch (err) {
      console.warn('MongoDB query for generation count failed, using memory fallback:', err.message);
    }
  }

  // Fallback memory count
  const count = memoryGenerationRecords.filter(
    (r) =>
      r.pid === cleanPid &&
      r.generationStatus === 'SUCCESS' &&
      r.generatedAt >= startOfMonth &&
      r.generatedAt < startOfNextMonth
  ).length;

  return count;
}

/**
 * Retrieves monthly quota status for a PID.
 */
async function getMonthlyQuotaInfo(pid) {
  const count = await getMonthlyGenerationCount(pid);
  const FREE_LIMIT = 3;
  const freeRemaining = Math.max(0, FREE_LIMIT - count);
  const paymentRequired = count >= FREE_LIMIT;
  const monthDisplay = getMonthDisplay();

  return {
    pid: (pid || '').trim().toUpperCase(),
    monthlyGenerationCount: count,
    freeLimit: FREE_LIMIT,
    freeGenerationsRemaining: freeRemaining,
    paymentRequired,
    amount: paymentRequired ? 15 : 0,
    monthName: monthDisplay.monthName,
    month: monthDisplay.monthIndex,
    year: monthDisplay.year,
  };
}

/**
 * Checks if a specific merchantOrderId / transactionId has already been consumed for an ID card generation.
 */
async function hasTransactionBeenUsed(merchantOrderId) {
  if (!merchantOrderId) return false;
  const cleanId = String(merchantOrderId).trim();

  if (mongoose.connection.readyState === 1) {
    try {
      // Check Payment model used flag
      const paymentDoc = await Payment.findOne({
        merchantOrderId: cleanId,
        usedForGeneration: true,
      }).lean();
      if (paymentDoc) return true;

      // Also check GenerationRecord
      const genDoc = await GenerationRecord.findOne({
        merchantOrderId: cleanId,
        generationStatus: 'SUCCESS',
      }).lean();
      if (genDoc) return true;

      return false;
    } catch (err) {
      console.warn('MongoDB transaction duplicate check failed:', err.message);
    }
  }

  return memoryGenerationRecords.some(
    (r) => r.merchantOrderId === cleanId && r.generationStatus === 'SUCCESS'
  );
}

/**
 * Atomically records a successful generation in MongoDB and marks payment as consumed.
 */
async function recordSuccessfulGeneration({
  pid,
  paymentRequired = false,
  amount = 0,
  paymentId = null,
  merchantOrderId = null,
  transactionId = null,
  metadata = {},
}) {
  const cleanPid = (pid || '').trim().toUpperCase();
  const cleanMerchantId = merchantOrderId ? String(merchantOrderId).trim() : null;
  const now = new Date();

  // If this was a paid generation, ensure payment has not been consumed and mark as used
  if (paymentRequired && cleanMerchantId) {
    const alreadyUsed = await hasTransactionBeenUsed(cleanMerchantId);
    if (alreadyUsed) {
      throw new Error(`Payment order "${cleanMerchantId}" has already been used to generate an ID card.`);
    }

    if (mongoose.connection.readyState === 1) {
      const updatedPayment = await Payment.findOneAndUpdate(
        {
          merchantOrderId: cleanMerchantId,
          status: 'SUCCESS',
          verified: true,
          usedForGeneration: { $ne: true },
        },
        {
          $set: {
            usedForGeneration: true,
            verifiedAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      if (!updatedPayment) {
        throw new Error(
          `Valid verified payment order "${cleanMerchantId}" was not found or was already consumed.`
        );
      }
      if (!paymentId) {
        paymentId = updatedPayment._id;
      }
      if (!transactionId && updatedPayment.transactionId) {
        transactionId = updatedPayment.transactionId;
      }
    }
  }

  const recordData = {
    pid: cleanPid,
    generatedAt: now,
    paymentRequired,
    amount,
    paymentId: paymentId || null,
    merchantOrderId: cleanMerchantId,
    transactionId: transactionId ? String(transactionId).trim() : null,
    generationStatus: 'SUCCESS',
    metadata,
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const doc = await GenerationRecord.create(recordData);
      return doc.toObject();
    } catch (err) {
      console.warn('MongoDB save error in recordSuccessfulGeneration:', err.message);
      throw err;
    }
  }

  memoryGenerationRecords.push(recordData);
  return recordData;
}

module.exports = {
  getMonthDateRange,
  getMonthDisplay,
  getMonthlyGenerationCount,
  getMonthlyQuotaInfo,
  hasTransactionBeenUsed,
  recordSuccessfulGeneration,
  _memoryGenerationRecords: memoryGenerationRecords,
};
