const mongoose = require('mongoose');

const generationRecordSchema = new mongoose.Schema(
  {
    pid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    generationStatus: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
    paymentRequired: {
      type: Boolean,
      default: false,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    merchantOrderId: {
      type: String,
      sparse: true,
      trim: true,
      index: true,
    },
    transactionId: {
      type: String,
      sparse: true,
      trim: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for high-speed monthly count queries per PID
generationRecordSchema.index({ pid: 1, generationStatus: 1, generatedAt: 1 });

const GenerationRecord =
  mongoose.models.GenerationRecord || mongoose.model('GenerationRecord', generationRecordSchema);

module.exports = GenerationRecord;
