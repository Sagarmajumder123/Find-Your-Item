const mongoose = require('mongoose');

const CATEGORIES = [
  'mobile', 'wallet', 'bag', 'documents', 'electronics',
  'keys', 'jewelry', 'clothing', 'other'
];

const COLORS = [
  'black', 'white', 'red', 'blue', 'green',
  'yellow', 'brown', 'grey', 'other'
];

const foundItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: 2000
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: { values: CATEGORIES, message: 'Invalid category: {VALUE}' }
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    enum: { values: COLORS, message: 'Invalid color: {VALUE}' }
  },
  brand: {
    type: String,
    trim: true,
    maxlength: 100,
    default: ''
  },
  // NO reward field — only lost item owners can set reward
  location: {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  locationName: {
    type: String,
    trim: true,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  },
  images: [{ type: String }],
  securityQuestion: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ""
  },
  status: {
    type: String,
    enum: ['active', 'claimed', 'resolved'],
    default: 'active'
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

foundItemSchema.index({ location: '2dsphere' });
foundItemSchema.index({ title: 'text', description: 'text', locationName: 'text' });
foundItemSchema.index({ category: 1, status: 1, color: 1 });

module.exports = mongoose.model('FoundItem', foundItemSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.COLORS = COLORS;
