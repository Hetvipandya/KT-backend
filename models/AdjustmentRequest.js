const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userType: {
    type: String,
    enum: ['employee', 'intern', 'tl', 'admin'],
    default: 'employee' // Set default value to avoid validation errors
  },
  date: {
    type: Date,
    required: true
  },
  checkInTime: Date,
  checkOutTime: Date,
  approvedCheckInTime: Date,
  totalBreakTime: {
    type: Number,
    default: 0
  },
  totalWorkTime: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'late'],
    default: 'absent'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  sessions: [{
    checkin: String,
    breakStart: String,
    breakEnd: String,
    checkout: String
  }],
  // ... any other fields
}, {
  timestamps: true
});

module.exports = mongoose.model('Attendance', attendanceSchema);