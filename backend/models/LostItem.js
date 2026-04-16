const mongoose = require('mongoose');

const CATEGORIES = [
  'mobile', 'wallet', 'bag', 'documents', 'electronics',
  'keys', 'jewelry', 'clothing', 'other'
];

const COLORS = [
  'black', 'white', 'red', 'blue', 'green',
  'yellow', 'brown', 'grey', 'other'
];

const lostItemSchema = new mongoose.Schema({
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
  reward: {
    type: Number,
    min: 0,
    default: 0
  },
  location: {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
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

lostItemSchema.index({ location: '2dsphere' });
lostItemSchema.index({ title: 'text', description: 'text', locationName: 'text' });
lostItemSchema.index({ category: 1, status: 1, color: 1 });

module.exports = mongoose.model('LostItem', lostItemSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.COLORS = COLORS;
