const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    maxlength: 2000,
    default: ''
  },
  fileUrl: {
    type: String,
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  // Keep backward compat with old read field
  read: {
    type: Boolean,
    default: false
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isDeletedForAll: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Validate: must have either text or file
messageSchema.pre('validate', function(next) {
  if (!this.text && !this.fileUrl) {
    return next(new Error('Message must have text or file'));
  }
  next();
});

// Index for efficient conversation queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
