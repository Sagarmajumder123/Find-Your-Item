const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  lostItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LostItem',
    required: true
  },
  foundItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoundItem',
    required: true
  },
  claimer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  finder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answer: {
    type: String,
    required: [true, 'An answer is required to submit a claim'],
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Prevent multiple PENDING claims for the same user/foundItem pair
claimSchema.index({ claimer: 1, foundItem: 1, status: 1 });

module.exports = mongoose.model('Claim', claimSchema);
