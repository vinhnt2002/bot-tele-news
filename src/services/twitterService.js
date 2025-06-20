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
    
    // Rate limiting: TwitterAPI.io supports up to 200 QPS per client
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000 / 150; // 150 requests per second to be safe
    
    if (this.isMockMode) {
      logger.warn('🧪 Twitter Service chạy ở chế độ Mock (không có API key thật)');
    } else {
      logger.info('🚀 Twitter Service initialized with TwitterAPI.io');
      logger.info('📊 Rate limit: 150 requests/second');
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

  // API request wrapper
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
        timeout: 30000
      });

      // Handle TwitterAPI.io response format
      const isSuccessful = response.data.status === 'success' || 
                           response.data.tweets !== undefined || 
                           response.data.data !== undefined;
      
      if (isSuccessful) {
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

  // Mock data cho testing
  getMockUserData(username) {
    return {
      id: `mock_${username}_${Date.now()}`,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      userName: username,
      type: "user",
      profilePicture: `https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png`,
      followers: Math.floor(Math.random() * 1000),
      following: Math.floor(Math.random() * 500),
      statusesCount: Math.floor(Math.random() * 10000),
      isBlueVerified: Math.random() > 0.8,
      isVerified: Math.random() > 0.9,
      description: `Mock bio for ${username}. This is a test account for bot development.`,
      location: "Mock Location",
      url: `https://example.com/${username}`,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // Lấy thông tin user Twitter bằng username
  async getUserByUsername(username) {
    try {
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: Creating fake user data for ${username}`);
        return this.getMockUserData(username);
      }

      const result = await this.makeAPIRequest('/twitter/user/info', {
        userName: username
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

  // Lấy tweets mới của user sử dụng Advanced Search
  async getUserTweetsSince(username, sinceTimestamp = null) {
    try {
      // Calculate since timestamp
      let since = sinceTimestamp;
      if (!since) {
        // Default: get tweets from last 24 hours for initial check
        since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      
      // Format timestamp for TwitterAPI.io: YYYY-MM-DD_HH:MM:SS_UTC
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
        return { tweets: [], status: 'success', method: 'advanced_search' };
      }

      // Use Advanced Search API endpoint
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
        
        // Filter tweets to only include ones after sinceTimestamp
        const filteredTweets = tweets.filter(tweet => {
          const tweetTime = new Date(tweet.createdAt).getTime();
          const sinceTime = since.getTime();
          return tweetTime > sinceTime;
        });
        
        logger.info(`📊 Advanced Search response for ${username}:`, {
          tweetsFound: tweets.length,
          tweetsAfterFilter: filteredTweets.length,
          method: 'advanced_search'
        });

        return {
          tweets: filteredTweets,
          status: 'success',
          method: 'advanced_search'
        };
      } else {
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
      throw error;
    }
  }

  // Check tweets mới cho tất cả users
  async checkNewTweets() {
    try {
      const cycleStartTime = new Date().toISOString();
      logger.info(`🚀 Starting tweet check cycle at ${cycleStartTime}`);
      
      const users = await this.getTrackedUsers();
      logger.info(`👥 Found ${users.length} users to check`);

      if (users.length === 0) {
        logger.info('📭 No users to check');
        return [];
      }

      let totalNewTweets = 0;
      let allNewTweets = [];

      // Process each user
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        logger.info(`👤 Checking user ${i + 1}/${users.length}: ${user.username}`);

        try {
          // Calculate since timestamp from lastTweetId or last check time
          let sinceTimestamp = null;
          
          if (user.lastTweetId) {
            // Get timestamp of last tweet we processed
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

          // Use Advanced Search
          const tweetsData = await this.getUserTweetsSince(user.username, sinceTimestamp);
          
          logger.info(`📨 Found ${tweetsData.tweets?.length || 0} new tweets for ${user.username}`);

          if (tweetsData.tweets && tweetsData.tweets.length > 0) {
            // Sort tweets by creation time (oldest first for processing)
            const sortedTweets = tweetsData.tweets.sort((a, b) => 
              new Date(a.createdAt) - new Date(b.createdAt)
            );

            // Process each tweet
            for (const tweet of sortedTweets) {
              // Check if we already have this tweet
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

          // Small delay between users
          if (i < users.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          logger.error(`❌ Error checking ${user.username}:`, error.message);
        }
      }

      logger.info(`🏁 Check cycle completed:`, {
        cycleEndTime: new Date().toISOString(),
        usersChecked: users.length,
        newTweetsFound: totalNewTweets
      });

      if (totalNewTweets > 0) {
        logger.info(`🎉 Found ${totalNewTweets} new tweets across ${users.length} users`);
        return allNewTweets;
      } else {
        logger.info('📭 No new tweets found');
        return [];
      }

    } catch (error) {
      logger.error('❌ Error in checkNewTweets:', {
        message: error.message,
        stack: error.stack
      });
      return [];
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

      // Lấy thông tin user từ Twitter
      const twitterUser = await this.getUserByUsername(username);
      
      // Lưu vào database
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
      logger.error(`Lỗi thêm user ${username}:`, error.message);
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

  // Advanced search tweets
  async searchTweets(query, options = {}) {
    try {
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: No search results for query "${query}"`);
        return { tweets: [] };
      }

      const params = {
        query: query,
        ...options
      };

      logger.info(`🔍 Searching tweets with query: "${query}"`, { params });

      const result = await this.makeAPIRequest('/twitter/tweet/advanced_search', params);

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

  // Get user followers
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

  // Get tweets by IDs
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

  // Debug method
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
}

module.exports = new TwitterService(); 