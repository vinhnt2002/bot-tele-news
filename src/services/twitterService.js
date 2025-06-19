const axios = require('axios');
const logger = require('../../utils/logger');
const TwitterUser = require('../models/TwitterUser');
const Tweet = require('../models/Tweet');

class TwitterService {
  constructor() {
    this.apiKey = "ad7adae17acf46aa94de3a22da222d05";
    this.baseURL = 'https://api.twitterapi.io';
    this.isMockMode = !this.apiKey || this.apiKey === 'temp_key_for_testing';
    
    // Rate limiting: TwitterAPI.io supports up to 200 QPS per client
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000 / 150; // 150 requests per second to be safe
    
    // Usage tracking for cost estimation
    this.usageStats = {
      tweets: 0,        // $0.15/1k tweets
      userProfiles: 0,  // $0.18/1k user profiles  
      followers: 0,     // $0.15/1k followers
      requests: 0       // $0.00015 per request minimum
    };
    
    if (this.isMockMode) {
      logger.warn('🧪 Twitter Service chạy ở chế độ Mock (không có API key thật)');
    } else {
      logger.info('🚀 Twitter Service initialized with TwitterAPI.io');
      logger.info('📊 Rate limit: 150 requests/second, Average response: ~700ms');
      logger.info('💰 Pricing: $0.15/1k tweets, $0.18/1k profiles, $0.15/1k followers');
    }
  }

  // Track usage and estimate costs
  trackUsage(type, count = 1) {
    this.usageStats[type] += count;
    this.usageStats.requests += 1;
  }

  // Get usage statistics and cost estimation
  getUsageStats() {
    const costs = {
      tweets: (this.usageStats.tweets / 1000) * 0.15,
      userProfiles: (this.usageStats.userProfiles / 1000) * 0.18,
      followers: (this.usageStats.followers / 1000) * 0.15,
      requests: this.usageStats.requests * 0.00015
    };

    const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);

    return {
      usage: this.usageStats,
      estimatedCosts: costs,
      totalEstimatedCost: totalCost.toFixed(6),
      currency: 'USD'
    };
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
      if (response.data.status === 'success') {
        // Track usage based on endpoint
        this.trackAPIUsage(endpoint, response.data.data);
        
        return {
          success: true,
          data: response.data.data,
          has_next_page: response.data.has_next_page,
          next_cursor: response.data.next_cursor
        };
      } else {
        logger.error('❌ TwitterAPI.io returned error status:', response.data);
        return { success: false, error: response.data.msg || 'Unknown API error' };
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
      case '/twitter/search/advanced':
      case '/twitter/tweets':
        this.trackUsage('tweets', data?.tweets?.length || 0);
        break;
      case '/twitter/user/info':
        this.trackUsage('userProfiles', 1);
        break;
      case '/twitter/user/followers':
      case '/twitter/user/followings':
        this.trackUsage('followers', data?.users?.length || 0);
        break;
      default:
        // Just track as a request
        this.trackUsage('requests', 0); // requests already tracked in trackUsage
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

  // Lấy tweets mới của user - Enhanced with better pagination support
  async getUserTweets(username, cursor = null) {
    try {
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
        
        logger.info(`📊 TwitterAPI response for ${username}:`, {
          tweetsCount: tweets.length,
          hasNextPage: result.has_next_page,
          nextCursor: result.next_cursor ? 'available' : 'none'
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
          status: 'success'
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

  // Check tweets mới cho tất cả users
  async checkNewTweets() {
    try {
      const users = await this.getTrackedUsers();
      let newTweets = [];

      logger.info(`🔍 Checking ${users.length} users for new tweets`);

      for (const user of users) {
        try {
          logger.info(`👤 Checking user: ${user.username} (lastTweetId: ${user.lastTweetId})`);
          
          const tweetsData = await this.getUserTweets(user.username);
          
          // TwitterAPI.io last_tweets endpoint trả về { tweets: [...] }
          if (tweetsData.tweets && tweetsData.tweets.length > 0) {
            logger.info(`📨 Found ${tweetsData.tweets.length} tweets for ${user.username}`);
            
            // Sắp xếp tweets theo thời gian giảm dần (mới nhất trước)
            const sortedTweets = tweetsData.tweets.sort((a, b) => 
              new Date(b.createdAt) - new Date(a.createdAt)
            );

            let hasNewTweets = false;
            
            // DEBUG: Log thông tin lastTweetId hiện tại
            logger.info(`🔍 Debug for ${user.username}:`, {
              lastTweetId: user.lastTweetId,
              totalTweetsFromAPI: sortedTweets.length,
              latestTweetFromAPI: sortedTweets[0]?.id,
              latestTweetCreatedAt: sortedTweets[0]?.createdAt
            });
            
            for (const tweet of sortedTweets) {
              // DEBUG: Log từng tweet đang xử lý
              logger.info(`🔎 Processing tweet:`, {
                tweetId: tweet.id,
                createdAt: tweet.createdAt,
                text: tweet.text?.substring(0, 50) + '...',
                isLastSeenTweet: tweet.id === user.lastTweetId
              });

              // Nếu có lastTweetId, chỉ lấy tweets mới hơn
              if (user.lastTweetId && tweet.id === user.lastTweetId) {
                logger.info(`⏹️ Reached last seen tweet ID for ${user.username}: ${tweet.id}`);
                break;
              }

              // Kiểm tra tweet đã tồn tại trong database chưa
              const existingTweet = await Tweet.findOne({ tweetId: tweet.id });
              if (!existingTweet) {
                logger.info(`✨ New tweet found from ${user.username}: ${tweet.id}`);
                
                // Xử lý media nếu có (hình ảnh, video, v.v.)
                let media = [];
                
                // Xử lý hình ảnh/video từ extendedEntities.media
                if (tweet.extendedEntities?.media && tweet.extendedEntities.media.length > 0) {
                  media = tweet.extendedEntities.media.map(mediaItem => ({
                    type: mediaItem.type || 'photo', // photo, video, animated_gif
                    url: mediaItem.media_url_https || mediaItem.media_url,
                    expanded_url: mediaItem.expanded_url,
                    display_url: mediaItem.display_url,
                    width: mediaItem.original_info?.width,
                    height: mediaItem.original_info?.height
                  }));
                }
                
                // Xử lý URLs khác nếu không có media
                if (media.length === 0 && tweet.entities?.urls && tweet.entities.urls.length > 0) {
                  media = tweet.entities.urls.map(url => ({
                    type: 'url',
                    url: url.expanded_url || url.url,
                    display_url: url.display_url
                  }));
                }

                const newTweet = new Tweet({
                  tweetId: tweet.id,
                  userId: user.userId,
                  username: user.username,
                  displayName: user.displayName,
                  text: tweet.text,
                  createdAt: new Date(tweet.createdAt),
                  media: media,
                  retweetCount: tweet.retweetCount || 0,
                  likeCount: tweet.likeCount || 0,
                  replyCount: tweet.replyCount || 0,
                  quoteCount: tweet.quoteCount || 0,
                  viewCount: tweet.viewCount || 0,
                  bookmarkCount: tweet.bookmarkCount || 0,
                  isReply: tweet.isReply || false,
                  lang: tweet.lang,
                  source: tweet.source
                });

                await newTweet.save();
                newTweets.push(newTweet);
                hasNewTweets = true;
                
                logger.info(`💾 Saved new tweet: ${tweet.id} from ${user.username}`);
              } else {
                logger.info(`⚠️ Tweet already exists in database: ${tweet.id}`);
              }
            }

            // Cập nhật lastTweetId với tweet mới nhất
            if (sortedTweets.length > 0) {
              const latestTweetId = sortedTweets[0].id;
              if (user.lastTweetId !== latestTweetId) {
                user.lastTweetId = latestTweetId;
                await user.save();
                logger.info(`🔄 Updated lastTweetId for ${user.username}: ${latestTweetId}`);
              }
            }

            if (!hasNewTweets) {
              logger.info(`📭 No new tweets for ${user.username}`);
            }
          } else {
            logger.info(`📪 No tweets found for ${user.username}`);
          }
        } catch (error) {
          logger.error(`Lỗi check tweets cho user ${user.username}:`, {
            message: error.message,
            stack: error.stack
          });
        }
      }

      if (newTweets.length > 0) {
        logger.info(`🎉 Found ${newTweets.length} new tweets total!`);
      } else {
        logger.info(`📭 No new tweets found across all users`);
      }

      return newTweets;
    } catch (error) {
      logger.error('Lỗi check new tweets:', error.message);
      return [];
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

}

module.exports = new TwitterService(); 