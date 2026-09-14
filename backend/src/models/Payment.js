const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    merchantOrderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    transactionId: {
      type: String,
      sparse: true,
      trim: true,
    },
    pid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 15, // in INR (₹15)
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    usedForGeneration: {
      type: Boolean,
      default: false,
      index: true,
    },
    paymentUrl: {
      type: String,
      default: '',
    },
    upiUrl: {
      type: String,
      default: '',
    },
    provider: {
      type: String,
      enum: ['PHONEPE', 'RAZORPAY'],
      default: 'RAZORPAY',
    },
    razorpayOrderId: {
      type: String,
      sparse: true,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      trim: true,
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    paymentInstrument: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast lookups and security checks
paymentSchema.index({ pid: 1, status: 1, usedForGeneration: 1 });
paymentSchema.index({ merchantOrderId: 1, pid: 1 });

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

module.exports = Payment;
