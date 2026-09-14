const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    pid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    course: {
      type: String,
      default: 'B.Tech',
    },
    department: {
      type: String,
      default: 'Information Technology',
    },
    dob: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    contact: {
      type: String,
      default: '',
    },
    photo_url: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);

module.exports = Student;
