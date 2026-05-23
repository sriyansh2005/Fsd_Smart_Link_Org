const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  domain: {
    type: String,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  previewImage: {
    type: String,
    default: ''
  },
  favicon: {
    type: String,
    default: ''
  },
  opens: {
    type: Number,
    default: 0
  },
  processing: {
    type: Boolean,
    default: false
  },
  lastOpenedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const collectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  links: [linkSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});



const User = mongoose.model('User', userSchema);
const Collection = mongoose.model('Collection', collectionSchema);

module.exports = { User, Collection };
