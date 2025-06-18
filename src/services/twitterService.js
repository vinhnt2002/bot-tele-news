const axios = require('axios');
const logger = require('../../utils/logger');
const TwitterUser = require('../models/TwitterUser');
const Tweet = require('../models/Tweet');

class TwitterService {
  constructor() {
    this.apiKey = "ad7adae17acf46aa94de3a22da222d05";
    this.baseURL = 'https://api.twitterapi.io';
    this.isMockMode = !this.apiKey || this.apiKey === 'temp_key_for_testing';
    
    if (this.isMockMode) {
      logger.warn('🧪 Twitter Service chạy ở chế độ Mock (không có API key thật)');
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
      isBlueVerified: false,
      createdAt: new Date().toISOString()
    };
  }

  // Lấy thông tin user Twitter bằng username
  async getUserByUsername(username) {
    try {
      // Mock mode cho testing
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: Creating fake user data for ${username}`);
        return this.getMockUserData(username);
      }

      // Sử dụng endpoint đúng theo docs TwitterAPI.io: /twitter/user/info
      const response = await axios.get(`${this.baseURL}/twitter/user/info`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        params: {
          userName: username  // TwitterAPI.io sử dụng userName, không phải username
        }
      });

      // TwitterAPI.io response structure: { data: {...}, status: "success" }
      return response.data.data;
    } catch (error) {
      // Cải thiện error logging
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params
      };
      logger.error(`Lỗi lấy thông tin user ${username}:`, errorDetails);
      throw error;
    }
  }

  // Lấy tweets mới của user
  async getUserTweets(username, cursor = null) {
    try {
      // Mock mode cho testing
      if (this.isMockMode) {
        logger.info(`🧪 Mock mode: No tweets for user ${username}`);
        return { tweets: [] };
      }

      // Sử dụng endpoint đúng theo docs TwitterAPI.io: /twitter/user/last_tweets
      const params = {
        userName: username  // TwitterAPI.io sử dụng userName thống nhất
      };

      // Thêm cursor nếu có để phân trang
      if (cursor) {
        params.cursor = cursor;
      }

      logger.info(`🔍 Getting tweets for user ${username}`, { params });

      const response = await axios.get(`${this.baseURL}/twitter/user/last_tweets`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        params: params
      });

      logger.info(`📊 TwitterAPI response for ${username}:`, {
        status: response.data.status,
        tweetsCount: response.data.data?.tweets?.length || 0,
        hasNextPage: response.data.has_next_page
      });

      // Fix response structure: TwitterAPI.io trả về { data: { tweets: [...] } }
      return {
        tweets: response.data.data?.tweets || [],
        has_next_page: response.data.has_next_page,
        next_cursor: response.data.next_cursor,
        status: response.data.status
      };
    } catch (error) {
      // Cải thiện error logging
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        params: error.config?.params
      };
      logger.error(`Lỗi lấy tweets của user ${username}:`, errorDetails);
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
      
      // Lưu vào database
      const newUser = new TwitterUser({
        username: username.toLowerCase(),
        userId: twitterUser.id,
        displayName: twitterUser.name
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
            
            for (const tweet of sortedTweets) {
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


}

module.exports = new TwitterService(); 