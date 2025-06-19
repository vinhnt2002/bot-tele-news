const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');
const logger = require('../../utils/logger');
const TwitterUser = require('../models/TwitterUser');
const Tweet = require('../models/Tweet');

class TwitterService {
  constructor() {
    this.apiKey = process.env.TWITTER_API_KEY;
    this.baseURL = 'https://api.twitterapi.io';
    this.isMockMode = !this.apiKey || this.apiKey === 'temp_key_for_testing';
    
    // Force flag for Advanced Search
    this.forceAdvancedSearch = false;
    
    // Rate limiting: TwitterAPI.io supports up to 200 QPS per client
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000 / 150; // 150 requests per second to be safe
    
    // Usage tracking for cost estimation
    this.usageStats = {
      tweets: 0,        // $0.15/1k tweets
      userProfiles: 0,  // $0.18/1k user profiles  
      followers: 0,     // $0.15/1k followers
      requests: 0,      // $0.00015 per request minimum
      savedByOptimization: 0, // Track API calls saved
      sessionStartTime: Date.now(), // Initialize session start time
      session: {
        apiCalls: 0,
        savedCalls: 0,
        optimizationRate: '0%',
        callsPerHour: 0
      },
      endpoints: {}
    };

    // PRACTICAL OPTIMIZATION: Simple user activity tracking
    this.userActivity = new Map(); // username -> { lastTweetTime, emptyChecks, interval }
    
    // PRACTICAL OPTIMIZATION: Simple cache with TTL
    this.cache = new Map(); // key -> { data, expiry }
    
    // PRACTICAL OPTIMIZATION: Dynamic intervals based on activity - EXTENDED for cost optimization
    this.intervals = {
      active: 5 * 60 * 1000,       // 5 phút cho users có tweets gần đây
      normal: 30 * 60 * 1000,      // INCREASED: 30 phút cho users bình thường (was 15min)
      inactive: 2 * 60 * 60 * 1000, // INCREASED: 2 giờ cho users không hoạt động (was 1h)
      dead: 12 * 60 * 60 * 1000    // INCREASED: 12 giờ cho users "chết" (was 6h)
    };
    
    if (this.isMockMode) {
      logger.warn('🧪 Twitter Service chạy ở chế độ Mock (không có API key thật)');
    } else {
      logger.info('🚀 Twitter Service initialized with TwitterAPI.io + Smart Optimization');
      logger.info('📊 Rate limit: 150 requests/second, Average response: ~700ms');
      logger.info('💰 Pricing: $0.15/1k tweets, $0.18/1k profiles, $0.15/1k followers');
      logger.info('🎯 Optimization: Smart intervals, caching, empty check detection');
    }
  }

  // PRACTICAL OPTIMIZATION: Simple cache helpers
  setCache(key, data, ttlMinutes = 10) {
    const expiry = Date.now() + (ttlMinutes * 60 * 1000);
    this.cache.set(key, { data, expiry });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    this.usageStats.savedByOptimization++;
    return cached.data;
  }

  // PRACTICAL OPTIMIZATION: Update user activity và tính toán interval
  updateUserActivity(username, tweets = []) {
    const now = Date.now();
    const activity = this.userActivity.get(username) || {
      lastTweetTime: 0,
      emptyChecks: 0,
      interval: this.intervals.normal,
      lastCheckTime: 0
    };

    if (tweets.length > 0) {
      // User có tweets mới
      const latestTweet = tweets[0];
      const tweetTime = new Date(latestTweet.createdAt).getTime();
      
      activity.lastTweetTime = tweetTime;
      activity.emptyChecks = 0;
      
      // Tính toán interval dựa trên activity
      const hoursSinceLastTweet = (now - tweetTime) / (1000 * 60 * 60);
      
      if (hoursSinceLastTweet < 4) {
        activity.interval = this.intervals.active; // Very active
      } else if (hoursSinceLastTweet < 24) {
        activity.interval = this.intervals.normal; // Normal activity
      } else {
        activity.interval = this.intervals.inactive; // Low activity
      }
      
    } else {
      // Empty check
      activity.emptyChecks++;
      
      // Tăng interval nếu quá nhiều empty checks
      if (activity.emptyChecks >= 3) {
        activity.interval = this.intervals.inactive;
      }
      if (activity.emptyChecks >= 8) {
        activity.interval = this.intervals.dead;
      }
    }

    activity.lastCheckTime = now;
    this.userActivity.set(username, activity);
    
    logger.debug(`📊 ${username}: interval=${Math.floor(activity.interval/60000)}min, empty=${activity.emptyChecks}`);
  }

  // PRACTICAL OPTIMIZATION: Check if user should be checked now
  shouldCheckUser(username) {
    // If force flag is set, always check the user
    if (this.forceAdvancedSearch) {
      logger.info(`⚡ Force checking ${username} (Advanced Search mode)`);
      return true;
    }
    
    const activity = this.userActivity.get(username);
    if (!activity) return true; // First time checking
    
    const timeSinceLastCheck = Date.now() - activity.lastCheckTime;
    const shouldCheck = timeSinceLastCheck >= activity.interval;
    
    if (!shouldCheck) {
      this.usageStats.savedByOptimization++;
      this.usageStats.session.savedCalls++; // Track in session stats too
      logger.debug(`⏰ Skip ${username} (${Math.floor(timeSinceLastCheck/60000)}/${Math.floor(activity.interval/60000)} min)`);
    }
    
    return shouldCheck;
  }

  // Track usage and estimate costs
  trackUsage(type, count = 1) {
    this.usageStats.session.apiCalls += 1;
    this.usageStats.endpoints[type] = (this.usageStats.endpoints[type] || 0) + 1;
  }

  // Get usage statistics and cost estimation
  getUsageStats() {
    const sessionHours = (Date.now() - this.usageStats.sessionStartTime) / (1000 * 60 * 60);
    const callsPerHour = sessionHours > 0 ? Math.round(this.usageStats.session.apiCalls / sessionHours) : 0;
    
    // Calculate optimization rate
    const totalPossibleCalls = this.usageStats.session.apiCalls + this.usageStats.session.savedCalls;
    const optimizationRate = totalPossibleCalls > 0 ? 
      `${Math.round((this.usageStats.session.savedCalls / totalPossibleCalls) * 100)}%` : '0%';

    return {
      session: {
        apiCalls: this.usageStats.session.apiCalls,
        savedCalls: this.usageStats.session.savedCalls,
        optimizationRate: optimizationRate,
        callsPerHour: callsPerHour
      },
      endpoints: this.usageStats.endpoints,
      note: "Check TwitterAPI.io dashboard for real costs. This tracks API calls made, not data volume."
    };
  }

  // NEW: Initialize user activities from database
  async initializeUserActivities(users) {
    try {
      logger.info(`🔄 Initializing user activities for ${users.length} users...`);
      
      for (const user of users) {
        if (!this.userActivity.has(user.username)) {
          // Initialize with normal interval
          this.userActivity.set(user.username, {
            lastTweetTime: 0,
            emptyChecks: 0,
            interval: this.intervals.normal,
            lastCheckTime: 0
          });
        }
      }
      
      logger.info(`✅ Initialized ${this.userActivity.size} user activities`);
    } catch (error) {
      logger.error('❌ Error initializing user activities:', error.message);
    }
  }

  // NEW: Periodic maintenance to prevent metric drift
  performPeriodicMaintenance() {
    try {
      // Reset users with too many empty checks
      let resetCount = 0;
      for (const [username, activity] of this.userActivity.entries()) {
        if (activity.emptyChecks > 10) {
          activity.emptyChecks = 0;
          activity.interval = this.intervals.normal;
          resetCount++;
        }
      }
      
      // Clear old cache entries
      const cacheCleared = this.cache.size;
      this.cache.clear();
      
      if (resetCount > 0 || cacheCleared > 0) {
        logger.info(`🧹 Maintenance: Reset ${resetCount} users, cleared ${cacheCleared} cache entries`);
      }
    } catch (error) {
      logger.error('❌ Error in periodic maintenance:', error.message);
    }
  }

  // NEW: Reset user activity
  resetUserActivity(username) {
    try {
      if (this.userActivity.has(username)) {
        this.userActivity.set(username, {
          lastTweetTime: 0,
          emptyChecks: 0,
          interval: this.intervals.normal,
          lastCheckTime: 0
        });
        logger.info(`🔄 Reset activity for ${username}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`❌ Error resetting activity for ${username}:`, error.message);
      return false;
    }
  }

  // Rate limiting helper
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      logger.debug(`⏱️ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Enhanced API request with usage tracking
  async makeAPIRequest(endpoint, params = {}) {
    try {
      await this.enforceRateLimit();
      
      logger.debug(`🔗 API Request: ${endpoint}`, { params });
      
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        params: params,
        timeout: 30000 // 30 second timeout
      });

      // Handle TwitterAPI.io response format
      // Check for successful response - different endpoints have different formats
      const isSuccessful = response.data.status === 'success' || 
                           response.data.tweets !== undefined || 
                           response.data.data !== undefined;
      
      if (isSuccessful) {
        // Track usage based on endpoint
        this.trackAPIUsage(endpoint, response.data.data || response.data);
        
        return {
          success: true,
          data: response.data.data || response.data,
          has_next_page: response.data.has_next_page || false,
          next_cursor: response.data.next_cursor || null
        };
      } else {
        logger.error('❌ TwitterAPI.io returned error status:', response.data);
        return { success: false, error: response.data.msg || response.data.error || 'Unknown API error' };
      }
    } catch (error) {
      // Enhanced error handling based on status codes
      const errorInfo = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      };

      // Handle specific error codes
      if (error.response?.status === 401) {
        logger.error('🔐 Authentication failed - Invalid API key');
      } else if (error.response?.status === 429) {
        logger.error('🚫 Rate limit exceeded - Need to slow down requests');
      } else if (error.response?.status === 403) {
        logger.error('🔒 Forbidden - API key may not have required permissions');
      } else if (error.response?.status >= 500) {
        logger.error('🏥 Server error - TwitterAPI.io may be experiencing issues');
      }

      logger.error(`❌ API Request failed for ${endpoint}:`, errorInfo);
      return { success: false, error: errorInfo };
    }
  }

  // Track usage based on endpoint and response data
  trackAPIUsage(endpoint, data) {
    switch (endpoint) {
      case '/twitter/user/last_tweets':
        this.trackUsage('tweetsEndpoint');
        break;
      case '/twitter/tweet/advanced_search':
        this.trackUsage('advancedSearchEndpoint');
        break;
      case '/twitter/tweets':
        this.trackUsage('tweetsEndpoint');
        break;
      case '/twitter/user/info':
        this.trackUsage('userInfoEndpoint');
        break;
      case '/twitter/user/followers':
      case '/twitter/user/followings':
        this.trackUsage('followersEndpoint');
        break;
      default:
        this.trackUsage('otherEndpoint');
    }
  }

  // Mock data cho testing
  getMockUserData(username) {
    return {
      id: `mock_${username}_${Date.now()}`,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      userName: username,  // TwitterAPI.io sử dụng userName
      type: "user",
      profilePicture: `https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png`,
      followers: Math.floor(Math.random() * 1000),
      following: Math.floor(Math.random() * 500),
      statusesCount: Math.floor(Math.random() * 10000),
      isBlueVerified: Math.random() > 0.8, // 20% chance of blue verification
      isVerified: Math.random() > 0.9, // 10% chance of legacy verification
      description: `Mock bio for ${username}. This is a test account for bot development.`,
      location: "Mock Location",
      url: `https://example.com/${username}`,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString() // Random date within last year
    };
  }

  // Lấy thông tin user Twitter bằng username - Updated according to TwitterAPI.io docs
  async getUserByUsername(username) {
    try {
      // Mock mode cho testing
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: Creating fake user data for ${username}`);
        return this.getMockUserData(username);
      }

      // Sử dụng enhanced API request
      const result = await this.makeAPIRequest('/twitter/user/info', {
        userName: username  // TwitterAPI.io sử dụng userName theo docs
      });

      if (result.success) {
        logger.info(`✅ Successfully got user info for ${username}`);
        return result.data;
      } else {
        throw new Error(result.error.message || 'Failed to get user info');
      }
    } catch (error) {
      logger.error(`❌ Error getting user info for ${username}:`, error.message);
      throw error;
    }
  }

  // Lấy tweets mới của user - Enhanced with smart caching
  async getUserTweets(username, cursor = null) {
    try {
      // PRACTICAL OPTIMIZATION: Check cache first (only for first page)
      if (!cursor) {
        const cacheKey = `tweets_${username}`;
        const cached = this.getCache(cacheKey);
        if (cached) {
          logger.debug(`⚡ Cache hit for ${username} tweets`);
          return { tweets: cached, status: 'success', fromCache: true };
        }
      }

      // Mock mode cho testing
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: No tweets for user ${username}`);
        return { tweets: [] };
      }

      // Prepare parameters
      const params = {
        userName: username  // TwitterAPI.io sử dụng userName thống nhất
      };

      // Thêm cursor nếu có để phân trang
      if (cursor) {
        params.cursor = cursor;
      }

      logger.info(`🔍 Getting tweets for user ${username}`, { params });

      // Sử dụng enhanced API request
      const result = await this.makeAPIRequest('/twitter/user/last_tweets', params);

      if (result.success) {
        const tweets = result.data?.tweets || [];
        
        // PRACTICAL OPTIMIZATION: Cache results (only first page)
        if (!cursor && tweets.length > 0) {
          this.setCache(`tweets_${username}`, tweets, 8); // Cache 8 phút
        }
        
        logger.info(`📊 TwitterAPI response for ${username}:`, {
          tweetsCount: tweets.length,
          hasNextPage: result.has_next_page,
          nextCursor: result.next_cursor ? 'available' : 'none',
          fromCache: false
        });

        // DEBUG: Log từng tweet để debug (chỉ trong debug mode)
        if (process.env.NODE_ENV === 'development' && tweets.length > 0) {
          tweets.forEach((tweet, index) => {
            logger.debug(`📝 Tweet ${index + 1}:`, {
              id: tweet.id,
              text: tweet.text?.substring(0, 100) + '...',
              createdAt: tweet.createdAt,
              retweetCount: tweet.retweetCount,
              likeCount: tweet.likeCount
            });
          });
        }

        return {
          tweets: tweets,
          has_next_page: result.has_next_page,
          next_cursor: result.next_cursor,
          status: 'success',
          fromCache: false
        };
      } else {
        throw new Error(result.error.message || 'Failed to get tweets');
      }
    } catch (error) {
      logger.error(`❌ Error getting tweets for ${username}:`, error.message);
      throw error;
    }
  }

  // Thêm user mới để theo dõi
  async addUserToTrack(username) {
    try {
      // Kiểm tra user đã tồn tại chưa
      const existingUser = await TwitterUser.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return { success: false, message: 'User đã được theo dõi rồi!' };
      }

      // Lấy thông tin user từ Twitter (hoặc mock)
      const twitterUser = await this.getUserByUsername(username);
      
      // Lưu vào database với đầy đủ thông tin
      const newUser = new TwitterUser({
        username: username.toLowerCase(),
        userId: twitterUser.id,
        displayName: twitterUser.name,
        profilePicture: twitterUser.profilePicture || null,
        followers: twitterUser.followers || 0,
        following: twitterUser.following || 0,
        statusesCount: twitterUser.statusesCount || 0,
        isBlueVerified: twitterUser.isBlueVerified || false,
        isVerified: twitterUser.isVerified || false,
        type: twitterUser.type || 'user',
        description: twitterUser.description || null,
        location: twitterUser.location || null,
        url: twitterUser.url || null,
        twitterCreatedAt: twitterUser.createdAt ? new Date(twitterUser.createdAt) : null,
        lastProfileUpdate: new Date()
      });

      await newUser.save();
      logger.info(`Đã thêm user ${username} vào danh sách theo dõi`);
      
      const mockWarning = this.isMockMode ? ' (Mock Mode)' : '';
      return { 
        success: true, 
        message: `Đã thêm ${twitterUser.name} (@${username}) vào danh sách theo dõi!${mockWarning}` 
      };
    } catch (error) {
      // Cải thiện error logging để debug tốt hơn
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status
      };
      logger.error(`Lỗi thêm user ${username}:`, errorDetails);
      return { success: false, message: `Không thể thêm user ${username}. Vui lòng kiểm tra username!` };
    }
  }

  // Xóa user khỏi danh sách theo dõi
  async removeUserFromTrack(username) {
    try {
      const result = await TwitterUser.findOneAndDelete({ username: username.toLowerCase() });
      if (result) {
        logger.info(`Đã xóa user ${username} khỏi danh sách theo dõi`);
        return { success: true, message: `Đã xóa @${username} khỏi danh sách theo dõi!` };
      } else {
        return { success: false, message: `Không tìm thấy user @${username} trong danh sách theo dõi!` };
      }
    } catch (error) {
      logger.error(`Lỗi xóa user ${username}:`, error.message);
      return { success: false, message: `Lỗi khi xóa user @${username}!` };
    }
  }

  // Lấy danh sách user đang theo dõi
  async getTrackedUsers() {
    try {
      const users = await TwitterUser.find({ isActive: true }).sort({ createdAt: -1 });
      return users;
    } catch (error) {
      logger.error('Lỗi lấy danh sách user:', error.message);
      return [];
    }
  }

  // 🚀 NEW OPTIMIZED METHOD: Get tweets since last check using Advanced Search
  // This replaces getUserTweets() for much better cost efficiency
  async getUserTweetsSince(username, sinceTimestamp = null) {
    try {
      // Calculate since timestamp
      let since = sinceTimestamp;
      if (!since) {
        // Default: get tweets from last 24 hours for initial check
        since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      
      // Format timestamp for TwitterAPI.io: YYYY-MM-DD_HH:MM:SS_UTC
      // Example from docs: since:2021-12-31_23:59:59_UTC
      const year = since.getUTCFullYear();
      const month = String(since.getUTCMonth() + 1).padStart(2, '0');
      const day = String(since.getUTCDate()).padStart(2, '0');
      const hours = String(since.getUTCHours()).padStart(2, '0');
      const minutes = String(since.getUTCMinutes()).padStart(2, '0');
      const seconds = String(since.getUTCSeconds()).padStart(2, '0');
      const sinceFormatted = `${year}-${month}-${day}_${hours}:${minutes}:${seconds}_UTC`;
      
      // Build advanced search query
      const query = `from:${username} since:${sinceFormatted}`;
      
      logger.info(`🔍 Advanced Search for ${username} since ${since.toISOString()}`, { 
        query: query,
        sinceTimestamp: since.toISOString()
      });

      // Mock mode cho testing
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: No new tweets for user ${username} since ${since.toISOString()}`);
        return { tweets: [], cost: 15, fromCache: false, method: 'advanced_search' };
      }

      // Use Advanced Search API endpoint with proper parameters (GET request with query params)
      logger.info(`🔍 Making Advanced Search API call with query: "${query}"`);
      
      const result = await this.makeAPIRequest('/twitter/tweet/advanced_search', {
        query: query,
        queryType: 'Latest'
      });
      
      logger.info(`📡 Advanced Search API response:`, {
        success: result.success,
        dataExists: !!result.data,
        tweetsCount: result.data?.tweets?.length || 0
      });

      if (result.success) {
        const tweets = result.data?.tweets || [];
        
        // Filter tweets to only include ones after sinceTimestamp (extra safety)
        const filteredTweets = tweets.filter(tweet => {
          const tweetTime = new Date(tweet.createdAt).getTime();
          const sinceTime = since.getTime();
          return tweetTime > sinceTime;
        });
        
        // Calculate actual cost (15 credits base + 15 per tweet)
        const actualCost = 15 + (filteredTweets.length * 15);
        
        logger.info(`📊 Advanced Search response for ${username}:`, {
          tweetsFound: tweets.length,
          tweetsAfterFilter: filteredTweets.length,
          estimatedCost: actualCost,
          oldMethodCost: 270,
          savings: `${Math.round((1 - actualCost/270) * 100)}%`,
          method: 'advanced_search'
        });

        return {
          tweets: filteredTweets,
          cost: actualCost,
          savings: Math.round((1 - actualCost/270) * 100),
          status: 'success',
          fromCache: false,
          method: 'advanced_search'
        };
      } else {
        // More detailed error logging
        logger.error('❌ Advanced Search API failed:', {
          endpoint: '/twitter/tweet/advanced_search',
          error: result.error,
          query: query,
          username: username
        });
        throw new Error(result.error?.message || result.error || 'Failed to get tweets via Advanced Search');
      }
    } catch (error) {
      logger.error(`❌ Error getting tweets via Advanced Search for ${username}:`, error.message);
      
      // Fallback to regular method if Advanced Search fails
      logger.warn(`🔄 Falling back to regular getUserTweets for ${username}`);
      const fallbackResult = await this.getUserTweets(username);
      return {
        ...fallbackResult,
        cost: 270, // Regular method cost
        savings: 0,
        method: 'fallback_last_tweets'
      };
    }
  }

  // 🚀 OPTIMIZED checkNewTweets method using Advanced Search
  async checkNewTweetsOptimized() {
    try {
      const cycleStartTime = new Date().toISOString();
      logger.info(`🚀 Starting optimized check cycle at ${cycleStartTime}`);
      
      const users = await this.getTrackedUsers();
      logger.info(`👥 Found ${users.length} total users in database`);

      if (users.length === 0) {
        logger.info('📭 No users to check');
        return { success: true, message: 'No users to check' };
      }

      // Initialize user activities from database if needed
      if (this.userActivity.size === 0) {
        await this.initializeUserActivities(users);
      }

      logger.info(`🔍 Checking ${users.length} users for new tweets (with ADVANCED SEARCH optimization enabled)`);

      // Filter users yang perlu di-check berdasarkan smart intervals
      const usersToCheck = [];
      const usersSkipped = [];

      for (const user of users) {
        if (this.shouldCheckUser(user.username)) {
          usersToCheck.push(user);
        } else {
          usersSkipped.push(user);
        }
      }

      logger.info(`🎯 Smart filtering result:`, {
        totalUsers: users.length,
        usersToCheck: usersToCheck.length,
        usersSkipped: usersSkipped.length,
        usersToCheckList: usersToCheck.map(u => u.username)
      });

      if (usersToCheck.length === 0) {
        logger.info(`⏰ Smart scheduling: checking 0/${users.length} users (saved ${usersSkipped.length} API calls)`);
        logger.info('📭 No users need checking right now');
        return { success: true, message: 'No users need checking (smart optimization working)' };
      }

      logger.info(`⏰ Smart scheduling: checking ${usersToCheck.length}/${users.length} users (saved ${usersSkipped.length} API calls)`);

      let totalNewTweets = 0;
      let totalCostSavings = 0;
      let totalAdvancedSearchCalls = 0;
      let allNewTweets = []; // Collection of actual Tweet objects for Telegram

      // Process each user
      for (let i = 0; i < usersToCheck.length; i++) {
        const user = usersToCheck[i];
        
        logger.info(`👤 Checking user ${i + 1}/${usersToCheck.length}: ${user.username} (lastTweetId: ${user.lastTweetId || 'none'})`);

        try {
          // Calculate since timestamp from lastTweetId or last check time
          let sinceTimestamp = null;
          
          if (user.lastTweetId) {
            // Get timestamp of last tweet we processed
            const Tweet = require('../models/Tweet');
            const lastTweet = await Tweet.findOne({ 
              tweetId: user.lastTweetId 
            }).sort({ createdAt: -1 });
            
            if (lastTweet) {
              sinceTimestamp = new Date(lastTweet.createdAt.getTime() + 1000); // Add 1 second to avoid duplicates
              logger.info(`📌 Using lastTweetId timestamp: ${sinceTimestamp.toISOString()}`);
            }
          }
          
          if (!sinceTimestamp) {
            // No lastTweetId, use 24 hours ago for safety
            sinceTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000);
            logger.info(`📅 Using 24h fallback timestamp: ${sinceTimestamp.toISOString()}`);
          }

          // 🚀 USE ADVANCED SEARCH instead of getUserTweets
          logger.info(`📡 Calling Advanced Search for ${user.username} with timestamp: ${sinceTimestamp.toISOString()}`);
          
          const tweetsData = await this.getUserTweetsSince(user.username, sinceTimestamp);
          
          logger.info(`📊 Advanced Search result for ${user.username}:`, {
            method: tweetsData.method,
            tweetsFound: tweetsData.tweets?.length || 0,
            cost: tweetsData.cost,
            savings: tweetsData.savings
          });
          
          // Track cost savings
          totalAdvancedSearchCalls++;
          if (tweetsData.savings) {
            totalCostSavings += (270 - tweetsData.cost); // Savings vs old method
          }

          // Update user activity tracking
          this.updateUserActivity(user.username, tweetsData.tweets || []);

          logger.info(`📨 Found ${tweetsData.tweets?.length || 0} new tweets for ${user.username} (cost: ${tweetsData.cost}, savings: ${tweetsData.savings}%)`);

          if (tweetsData.tweets && tweetsData.tweets.length > 0) {
            // Sort tweets by creation time (oldest first for processing)
            const sortedTweets = tweetsData.tweets.sort((a, b) => 
              new Date(a.createdAt) - new Date(b.createdAt)
            );

            logger.info(`🔍 Debug for ${user.username}:`, {
              totalTweetsFromAPI: tweetsData.tweets.length,
              latestTweetFromAPI: sortedTweets[sortedTweets.length - 1]?.id,
              latestTweetCreatedAt: sortedTweets[sortedTweets.length - 1]?.createdAt,
              method: tweetsData.method
            });

            // Process each tweet
            for (const tweet of sortedTweets) {
              logger.info(`🔎 Processing tweet:`, {
                tweetId: tweet.id,
                createdAt: tweet.createdAt,
                text: tweet.text?.substring(0, 50) + '...',
                method: tweetsData.method
              });

              // Check if we already have this tweet
              const Tweet = require('../models/Tweet');
              const existingTweet = await Tweet.findOne({ tweetId: tweet.id });
              
              if (existingTweet) {
                logger.info(`⏭️ Tweet ${tweet.id} already exists, skipping`);
                continue;
              }

              // Save new tweet
                const newTweet = new Tweet({
                  tweetId: tweet.id,
                  userId: user.userId,
                  username: user.username,
                  displayName: user.displayName,
                  text: tweet.text,
                  createdAt: new Date(tweet.createdAt),
                media: tweet.media || [],
                  retweetCount: tweet.retweetCount || 0,
                  likeCount: tweet.likeCount || 0,
                  replyCount: tweet.replyCount || 0,
                  quoteCount: tweet.quoteCount || 0,
                  viewCount: tweet.viewCount || 0,
                  bookmarkCount: tweet.bookmarkCount || 0,
                  isReply: tweet.isReply || false,
                  lang: tweet.lang,
                source: tweet.source,
                isPostedToTelegram: false
                });

                await newTweet.save();
              logger.info(`💾 Saved new tweet ${tweet.id} for ${user.username}`);

              // Add to collection for scheduler to handle
              allNewTweets.push(newTweet);
              totalNewTweets++;
            }

            // Update user's lastTweetId to latest tweet
            if (sortedTweets.length > 0) {
              const latestTweet = sortedTweets[sortedTweets.length - 1];
              user.lastTweetId = latestTweet.id;
                await user.save();
              logger.info(`📌 Updated lastTweetId for ${user.username}: ${latestTweet.id}`);
              }
          } else {
            logger.info(`📭 No new tweets for ${user.username}`);
            }

          // Small delay between users to be nice to the API
          if (i < usersToCheck.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
          logger.error(`❌ Error checking ${user.username}:`, error.message);
        }
      }

      // Periodic maintenance
      this.performPeriodicMaintenance();

      // Get final stats
      const stats = this.getUsageStats();

      // Enhanced logging with cost analysis
      logger.info(`🏁 Optimized check cycle completed:`, {
        cycleEndTime: new Date().toISOString(),
        usersChecked: usersToCheck.length,
        usersSkipped: usersSkipped.length,
        newTweetsFound: totalNewTweets,
        advancedSearchCalls: totalAdvancedSearchCalls,
        totalCostSavings: totalCostSavings,
        sessionStats: stats.session,
        userActivityMapSize: this.userActivity.size,
        cacheSize: this.cache.size
      });

      logger.info(`📊 Session summary:`, {
        usersChecked: usersToCheck.length,
        usersSkipped: usersSkipped.length,
        sessionApiCalls: stats.session.apiCalls,
        callsSaved: stats.session.savedCalls,
        optimizationRate: stats.session.optimizationRate,
        newTweetsFound: totalNewTweets,
        advancedSearchSavings: totalCostSavings,
        method: 'advanced_search'
      });

      if (totalNewTweets > 0) {
        logger.info(`🎉 Found ${totalNewTweets} new tweets across ${usersToCheck.length} users (saved ${totalCostSavings} credits)`);
        
        // Return actual Tweet objects for scheduler compatibility
        return allNewTweets;
      } else {
        logger.info('📭 No new tweets found (Advanced Search optimization working)');
        
        // Return empty array for scheduler compatibility
        return [];
      }

    } catch (error) {
      logger.error('❌ Error in checkNewTweetsOptimized:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return []; // Return empty array on error for scheduler compatibility
    }
  }

  // NEW: Advanced search tweets - Based on TwitterAPI.io docs
  async searchTweets(query, options = {}) {
    try {
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: No search results for query "${query}"`);
        return { tweets: [] };
      }

      const params = {
        query: query,
        ...options // date_since, date_until, lang, etc.
      };

      logger.info(`🔍 Searching tweets with query: "${query}"`, { params });

      const result = await this.makeAPIRequest('/twitter/search/advanced', params);

      if (result.success) {
        const tweets = result.data?.tweets || [];
        logger.info(`📊 Search results: ${tweets.length} tweets found`);
        
        return {
          tweets: tweets,
          has_next_page: result.has_next_page,
          next_cursor: result.next_cursor,
          status: 'success'
        };
      } else {
        throw new Error(result.error.message || 'Search failed');
      }
    } catch (error) {
      logger.error(`❌ Error searching tweets with query "${query}":`, error.message);
      throw error;
    }
  }

  // NEW: Get user followers - Based on TwitterAPI.io docs
  async getUserFollowers(username, cursor = null) {
    try {
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: No followers for user ${username}`);
        return { users: [] };
      }

      const params = { userName: username };
      if (cursor) params.cursor = cursor;

      logger.info(`👥 Getting followers for user ${username}`);

      const result = await this.makeAPIRequest('/twitter/user/followers', params);

      if (result.success) {
        const users = result.data?.users || [];
        logger.info(`📊 Found ${users.length} followers for ${username}`);
        
        return {
          users: users,
          has_next_page: result.has_next_page,
          next_cursor: result.next_cursor,
          status: 'success'
        };
      } else {
        throw new Error(result.error.message || 'Failed to get followers');
      }
    } catch (error) {
      logger.error(`❌ Error getting followers for ${username}:`, error.message);
      throw error;
    }
  }

  // NEW: Get multiple tweets by IDs - Based on TwitterAPI.io docs
  async getTweetsByIds(tweetIds) {
    try {
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: No tweets for IDs ${tweetIds.join(', ')}`);
        return { tweets: [] };
      }

      const params = {
        ids: Array.isArray(tweetIds) ? tweetIds.join(',') : tweetIds
      };

      logger.info(`🔍 Getting tweets by IDs: ${params.ids}`);

      const result = await this.makeAPIRequest('/twitter/tweets', params);

      if (result.success) {
        const tweets = result.data?.tweets || [];
        logger.info(`📊 Found ${tweets.length} tweets by IDs`);
        
        return {
          tweets: tweets,
          status: 'success'
        };
      } else {
        throw new Error(result.error.message || 'Failed to get tweets by IDs');
      }
    } catch (error) {
      logger.error(`❌ Error getting tweets by IDs:`, error.message);
      throw error;
    }
  }

  // Enhanced debug method with new API wrapper
  async debugGetTweets(username) {
    try {
      logger.info(`🔧 DEBUG: Testing API directly for ${username}`);
      
      if (this.isMockMode) {
        logger.warn('🧪 Cannot debug in mock mode!');
        return { error: 'Mock mode enabled' };
      }

      const result = await this.makeAPIRequest('/twitter/user/last_tweets', {
        userName: username
      });

      logger.info(`🔧 DEBUG API Response:`, {
        success: result.success,
        tweetsCount: result.success ? result.data?.tweets?.length || 0 : 0,
        hasNextPage: result.has_next_page,
        error: result.error
      });

      return result.success ? result.data : { error: result.error };
    } catch (error) {
      logger.error(`🔧 DEBUG API Error:`, error.message);
      return { error: error.message };
    }
  }

  // Cập nhật thông tin profile của user từ Twitter API
  async updateUserProfile(username) {
    try {
      const user = await TwitterUser.findOne({ username: username.toLowerCase() });
      if (!user) {
        return { success: false, message: `User ${username} not found` };
      }

      // Lấy thông tin mới từ Twitter API
      const twitterUser = await this.getUserByUsername(username);
      
      // Cập nhật thông tin
      user.displayName = twitterUser.name;
      user.profilePicture = twitterUser.profilePicture || user.profilePicture;
      user.followers = twitterUser.followers || user.followers;
      user.following = twitterUser.following || user.following;
      user.statusesCount = twitterUser.statusesCount || user.statusesCount;
      user.isBlueVerified = twitterUser.isBlueVerified || false;
      user.isVerified = twitterUser.isVerified || false;
      user.type = twitterUser.type || user.type;
      user.description = twitterUser.description || user.description;
      user.location = twitterUser.location || user.location;
      user.url = twitterUser.url || user.url;
      user.twitterCreatedAt = twitterUser.createdAt ? new Date(twitterUser.createdAt) : user.twitterCreatedAt;
      user.lastProfileUpdate = new Date();

      await user.save();
      
      logger.info(`✅ Updated profile for ${username}`);
      return { 
        success: true, 
        message: `Updated profile for ${username}`,
        user: user
      };
    } catch (error) {
      logger.error(`Error updating profile for ${username}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // DEBUG: Phương thức reset lastTweetId để test lại
  async resetLastTweetId(username) {
    try {
      const user = await TwitterUser.findOne({ username: username.toLowerCase() });
      if (user) {
        const oldLastTweetId = user.lastTweetId;
        user.lastTweetId = null;
        await user.save();
        logger.info(`🔄 Reset lastTweetId for ${username}: ${oldLastTweetId} -> null`);
        return { success: true, message: `Reset lastTweetId for ${username}` };
      } else {
        return { success: false, message: `User ${username} not found` };
      }
    } catch (error) {
      logger.error(`Error resetting lastTweetId for ${username}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // Set baseline for user - only process tweets from now on
  async setBaseline(username) {
    try {
      const TwitterUser = require('../models/TwitterUser');
      const user = await TwitterUser.findOne({ username: username.toLowerCase() });
      if (!user) {
        return { success: false, message: `User ${username} not found` };
      }

      const oldLastTweetId = user.lastTweetId;
      
      // Get latest tweet to set as baseline
      const tweetsData = await this.getUserTweets(username);
      
      if (tweetsData.tweets && tweetsData.tweets.length > 0) {
        // Sort by creation time and get the latest
        const sortedTweets = tweetsData.tweets.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        const latestTweet = sortedTweets[0];
        user.lastTweetId = latestTweet.id;
        await user.save();
        
        logger.info(`📌 Set baseline for ${username}: ${latestTweet.id} at ${latestTweet.createdAt}`);
        
        return {
          success: true,
          message: `Set baseline for ${username}`,
          oldLastTweetId: oldLastTweetId,
          newLastTweetId: latestTweet.id
        };
      } else {
        // No tweets found, just update timestamp
        await user.save();
        
        return {
          success: true,
          message: `Set time-based baseline for ${username} (no tweets found)`,
          oldLastTweetId: oldLastTweetId,
          newLastTweetId: null
        };
      }
    } catch (error) {
      logger.error(`Error setting baseline for ${username}:`, error.message);
      return { success: false, message: error.message };
    }
  }



  // 🎯 NEW METHOD: Set baseline for new optimized checking
  async setBaselineOptimized(username) {
    try {
      const user = await TwitterUser.findOne({ username: username.toLowerCase() });
      if (!user) {
        return { success: false, message: `User ${username} not found` };
      }

      const oldLastTweetId = user.lastTweetId;
      
      // Get latest tweet to set as baseline
      const tweetsData = await this.getUserTweets(username);
      
      if (tweetsData.tweets && tweetsData.tweets.length > 0) {
        // Sort by creation time and get the latest
        const sortedTweets = tweetsData.tweets.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        
        const latestTweet = sortedTweets[0];
        user.lastTweetId = latestTweet.id;
        user.baselineTimestamp = new Date(latestTweet.createdAt);
        await user.save();
        
        logger.info(`📌 Set optimized baseline for ${username}: ${latestTweet.id} at ${latestTweet.createdAt}`);
        
        return {
          success: true,
          message: `Set optimized baseline for ${username}`,
          oldLastTweetId: oldLastTweetId,
          newLastTweetId: latestTweet.id,
          baselineTimestamp: latestTweet.createdAt
        };
      } else {
        // No tweets found, set baseline to current time
        user.baselineTimestamp = new Date();
        await user.save();
        
        return {
          success: true,
          message: `Set time-based baseline for ${username} (no tweets found)`,
          oldLastTweetId: oldLastTweetId,
          newLastTweetId: null,
          baselineTimestamp: user.baselineTimestamp
        };
      }
    } catch (error) {
      logger.error(`Error setting optimized baseline for ${username}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  // 🚀 Method to migrate to optimized checking for all users
  async migrateToOptimizedChecking() {
    try {
      const users = await this.getTrackedUsers();
      let successCount = 0;
      let failCount = 0;
      
      logger.info(`🔄 Starting migration to optimized checking for ${users.length} users`);
      
      for (const user of users) {
        try {
          const result = await this.setBaselineOptimized(user.username);
          if (result.success) {
            successCount++;
            logger.info(`✅ Migrated ${user.username} to optimized checking`);
          } else {
            failCount++;
            logger.error(`❌ Failed to migrate ${user.username}: ${result.message}`);
          }
          
          // Small delay to be nice to API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          failCount++;
          logger.error(`❌ Error migrating ${user.username}:`, error.message);
        }
      }
      
      logger.info(`🎉 Migration completed: ${successCount} success, ${failCount} failed`);
      
      return {
        success: true,
        message: `Migration completed: ${successCount} success, ${failCount} failed`,
        successCount,
        failCount
      };
    } catch (error) {
      logger.error('❌ Error in migration:', error.message);
      return { success: false, message: error.message };
    }
  }

  // 📊 Generate cost analysis report
  generateCostReport() {
    const stats = this.getUsageStats();
    
    // Estimate costs for different scenarios
    const scenarios = {
      oldMethod: {
        name: 'Old Method (last_tweets)',
        costPerCheck: 270,
        description: 'Always fetches ~20 tweets'
      },
      optimizedMethod: {
        name: 'Advanced Search (Optimized)',
        costPerCheck: 30, // Estimated average for users with occasional tweets
        description: 'Only fetches new tweets since last check'
      }
    };
    
    const usersCount = this.userActivity.size || 1;
    const checksPerDay = 48; // Based on 30min normal intervals
    
    const report = {
      currentSession: stats,
      estimatedDailyCosts: {},
      monthlySavings: {}
    };
    
    Object.entries(scenarios).forEach(([key, scenario]) => {
      const dailyCost = scenario.costPerCheck * usersCount * checksPerDay;
      report.estimatedDailyCosts[key] = {
        ...scenario,
        dailyCredits: dailyCost,
        monthlyCredits: dailyCost * 30
      };
    });
    
    // Calculate savings
    const oldMonthlyCost = report.estimatedDailyCosts.oldMethod.monthlyCredits;
    const newMonthlyCost = report.estimatedDailyCosts.optimizedMethod.monthlyCredits;
    const monthlySavings = oldMonthlyCost - newMonthlyCost;
    const savingsPercentage = Math.round((monthlySavings / oldMonthlyCost) * 100);
    
    report.monthlySavings = {
              creditsSaved: monthlySavings,
      percentage: savingsPercentage,
      description: `Save ${monthlySavings} credits/month (${savingsPercentage}% reduction)`
    };
    
    return report;
  }

}

module.exports = new TwitterService(); 