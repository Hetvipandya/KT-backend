const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    title:            { type: String, required: true, trim: true },
    type:             { type: String, enum: ['Intern', 'Full-time'], default: 'Full-time' },
    category:         { type: String, required: true, trim: true },
    desc:             { type: String, default: '', trim: true },
    skills:           [{ type: String, trim: true }],
    responsibilities: [{ type: String, trim: true }],
    exp:              { type: String, default: '', trim: true },
    location:         { type: String, default: 'Ahmedabad (On-site)', trim: true },
    isActive:         { type: Boolean, default: true },
  },
  { timestamps: true },
);
 
module.exports = mongoose.model('Position', positionSchema);
