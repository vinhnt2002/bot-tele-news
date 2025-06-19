const mongoose = require('mongoose');

const twitterUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  userId: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  // Avatar/Profile Picture
  profilePicture: {
    type: String,
    default: null
  },
  // Stats từ Twitter
  followers: {
    type: Number,
    default: 0
  },
  following: {
    type: Number,
    default: 0
  },
  statusesCount: {
    type: Number,
    default: 0
  },
  // Verification status
  isBlueVerified: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Account type
  type: {
    type: String,
    default: 'user'
  },
  // Bio/Description
  description: {
    type: String,
    default: null
  },
  // Location
  location: {
    type: String,
    default: null
  },
  // Website URL
  url: {
    type: String,
    default: null
  },
  // Twitter account creation date
  twitterCreatedAt: {
    type: Date,
    default: null
  },
  // Bot tracking fields
  isActive: {
    type: Boolean,
    default: true
  },
  lastTweetId: {
    type: String,
    default: null
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Last profile update from Twitter API
  lastProfileUpdate: {
    type: Date,
    default: Date.now
  }
});

twitterUserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TwitterUser', twitterUserSchema); 