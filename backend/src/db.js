const mongoose = require('mongoose');
const Student = require('./models/Student');
const { SEED_STUDENTS } = require('./seedData');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/noid_db';

let isDbAvailable = false;

async function initDatabase() {
  try {
    // Attempt connecting to MongoDB with a short timeout so app boots immediately
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });

    isDbAvailable = true;
    console.log('✅ Connected to MongoDB database successfully.');

    // Seed database if empty or sync seed students
    const count = await Student.countDocuments();
    if (count === 0) {
      await Student.insertMany(SEED_STUDENTS);
      console.log(`✅ Seeded ${SEED_STUDENTS.length} students into MongoDB.`);
    } else {
      for (const s of SEED_STUDENTS) {
        await Student.findOneAndUpdate(
          { pid: s.pid.toUpperCase() },
          { ...s, pid: s.pid.toUpperCase() },
          { upsert: true }
        );
      }
      console.log('✅ Synced student records in MongoDB.');
    }

    // Safely sync GenerationRecord and Payment indexes
    try {
      const GenerationRecord = require('./models/GenerationRecord');
      const genIndexes = await GenerationRecord.collection.indexes();
      const hasOldTxnIndex = genIndexes.some(idx => idx.name === 'transactionId_1');
      if (hasOldTxnIndex) {
        await GenerationRecord.collection.dropIndex('transactionId_1');
        console.log('✅ Dropped legacy transactionId_1 index from GenerationRecord.');
      }
      await GenerationRecord.syncIndexes();
      const Payment = require('./models/Payment');
      await Payment.syncIndexes();
    } catch (idxErr) {
      console.debug('Index sync notice:', idxErr.message);
    }

    return true;
  } catch (err) {
    console.warn(`⚠️ MongoDB connection unavailable (${err.message}). Application is running with in-memory dataset fallback.`);
    isDbAvailable = false;
    return false;
  }
}

async function findStudentByPid(pid) {
  if (!pid || typeof pid !== 'string') return null;
  const cleanPid = pid.trim().toUpperCase();

  // 1. Try MongoDB if connected
  if (isDbAvailable && mongoose.connection.readyState === 1) {
    try {
      const doc = await Student.findOne({ pid: cleanPid }).lean();
      if (doc) {
        return formatStudent(doc);
      }
    } catch (err) {
      console.warn('MongoDB query failed, falling back to in-memory:', err.message);
    }
  }

  // 2. Fallback in-memory dataset search
  const found = SEED_STUDENTS.find(s => s.pid.toUpperCase() === cleanPid);
  if (found) {
    return formatStudent(found);
  }

  return null;
}

function formatStudent(student) {
  let photo = student.photo_url || '';
  if (photo && !photo.startsWith('http') && !photo.startsWith('/')) {
    if (!photo.startsWith('photos/')) {
      photo = `/photos/${photo}`;
    } else {
      photo = `/${photo}`;
    }
  }
  return {
    pid: student.pid,
    name: student.name,
    course: student.course,
    department: student.department,
    dob: student.dob || '',
    email: student.email || '',
    contact: student.contact || '',
    photo_url: photo,
  };
}

function getSamplePids() {
  return [
    { pid: 'EU1244001', name: 'Manaswi Gharat' },
    { pid: 'EU1244003', name: 'Pooja Sahu' },
    { pid: 'EU1244004', name: 'Shamitha Palai' },
    { pid: 'EU1244051', name: 'Vidhisha Sonar' },
    { pid: 'EU1244010', name: 'Bhargavi Ahire' },
    { pid: 'EU1244017', name: 'Saanj Bari' },
    { pid: 'EU1244033', name: 'Shubham Kini' },
    { pid: 'EU1244049', name: 'Sanskar Agre' },
  ];
}

module.exports = {
  initDatabase,
  findStudentByPid,
  getSamplePids,
  isDbConnected: () => isDbAvailable && mongoose.connection.readyState === 1,
};
