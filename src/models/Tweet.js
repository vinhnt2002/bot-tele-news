const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
  tweetId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    required: true
  },
  isPostedToTelegram: {
    type: Boolean,
    default: false
  },
  telegramMessageId: {
    type: String,
    default: null
  },
  media: [{
    type: {
      type: String,
      enum: ['photo', 'video', 'animated_gif', 'url']
    },
    url: String,
    expanded_url: String,
    display_url: String,
    width: Number,
    height: Number
  }],
  retweetCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  quoteCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  bookmarkCount: {
    type: Number,
    default: 0
  },
  isReply: {
    type: Boolean,
    default: false
  },
  lang: String,
  source: String
});

module.exports = mongoose.model('Tweet', tweetSchema); 