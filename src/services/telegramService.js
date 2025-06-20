const TelegramBot = require('node-telegram-bot-api');
const logger = require('../../utils/logger');
const twitterService = require('./twitterService');
const moment = require('moment');
const { HttpsProxyAgent } = require('https-proxy-agent');

class TelegramService {
  constructor() {
    // Proxy support
    const proxyUrl = process.env.TELEGRAM_PROXY_URL;
    const botOptions = { polling: true };
    
    if (proxyUrl) {
      logger.info(`🌐 Using proxy for Telegram: ${proxyUrl}`);
      botOptions.request = {
        agent: new HttpsProxyAgent(proxyUrl)
      };
    }
    
    // Enhanced polling configuration with error handling
    botOptions.polling = {
      interval: 300,  // 300ms between polling requests
      autoStart: true,
      params: {
        timeout: 10,  // 10 seconds timeout for long polling
      }
    };
    
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, botOptions);
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    
    // Danh sách admin được phép sử dụng các lệnh quản lý
    this.adminUsers = this.parseAdminUsers(process.env.TELEGRAM_ADMIN_IDS);
    
    // Setup error handlers
    this.setupErrorHandlers();
    this.setupCommands();
  }

  // Setup error handlers for polling issues
  setupErrorHandlers() {
    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      logger.error('🚫 Telegram polling error:', {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Handle specific error types
      if (error.code === 'EFATAL') {
        logger.warn('💀 Fatal Telegram error - attempting to restart polling in 30s...');
        setTimeout(() => {
          this.restartPolling();
        }, 30000);
      } else if (error.code === 'ETIMEDOUT') {
        logger.warn('⏱️ Telegram connection timeout - will retry automatically');
      } else if (error.code === 'ENOTFOUND') {
        logger.error('🌐 Network issue - check internet connection and proxy settings');
      }
    });

    // Handle webhook errors
    this.bot.on('webhook_error', (error) => {
      logger.error('🔗 Telegram webhook error:', error.message);
    });
  }

  // Restart polling with backoff
  async restartPolling() {
    try {
      logger.info('🔄 Attempting to restart Telegram polling...');
      
      // Stop current polling
      await this.bot.stopPolling();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Start polling again
      await this.bot.startPolling();
      
      logger.info('✅ Telegram polling restarted successfully');
    } catch (error) {
      logger.error('❌ Failed to restart polling:', error.message);
      
      // Try again in 60 seconds
      setTimeout(() => {
        this.restartPolling();
      }, 60000);
    }
  }

  // Parse danh sách admin IDs từ environment variable
  parseAdminUsers(adminIds) {
    if (!adminIds) {
      // Nếu không có admin IDs, chỉ cho phép chat ID chính được cấu hình
      const mainChatId = process.env.TELEGRAM_CHAT_ID;
      if (mainChatId) {
        return [mainChatId.toString()];
      }
      return [];
    }
    
    return adminIds.split(',').map(id => id.trim());
  }

  // Kiểm tra quyền admin
  isAuthorized(userId, chatId) {
    const userIdStr = userId.toString();
    const chatIdStr = chatId.toString();
    
    // Admin IDs hoặc chat ID chính
    const isAuthorized = this.adminUsers.includes(userIdStr) || this.adminUsers.includes(chatIdStr);
    
    // Log để theo dõi
    if (!isAuthorized) {
      logger.warn(`Unauthorized access attempt - User ID: ${userId}, Chat ID: ${chatId}`);
    }
    
    return isAuthorized;
  }

  setupCommands() {
    // Command /start
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const isAdmin = this.isAuthorized(userId, chatId);
      
      const welcomeMessage = `
🤖 *Chào mừng bạn đến với Bot Twitter News!*

Bot này sẽ theo dõi các tài khoản Twitter và thông báo khi có tweet mới.

📋 *LỆNH XEM THÔNG TIN (Tất cả user):*
• \`/list\` - Danh sách tài khoản theo dõi
• \`/info username\` - Chi tiết profile user
• \`/status\` - Trạng thái bot
• \`/help\` - Hướng dẫn đầy đủ tất cả lệnh

${isAdmin ? `🔧 *LỆNH QUẢN TRỊ (Chỉ Admin):*
• \`/add username\` - Thêm user theo dõi
• \`/remove username\` - Xóa user khỏi danh sách theo dõi  
• \`/update username\` - Cập nhật profile mới nhất
• \`/check\` - Force check tweets mới tất cả users

📝 *VÍ DỤ SỬ DỤNG:*
\`/add elonmusk\` - Thêm Elon Musk
\`/info elonmusk\` - Xem profile chi tiết  
\`/update elonmusk\` - Cập nhật stats mới
\`/check\` - Kiểm tra tweets ngay

🔑 *QUYỀN TRUY CẬP:* Admin (Full access)` : `🔍 *QUYỀN TRUY CẬP:* Viewer (Chỉ xem)
❗ *Lưu ý:* Các lệnh quản lý chỉ dành cho admin`}

⚡ *TỰ ĐỘNG:* Bot kiểm tra tweets mỗi ${process.env.CHECK_INTERVAL_MINUTES || 5} phút
      `;
      
      this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Command /help
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const isAdmin = this.isAuthorized(userId, chatId);
      
      if (isAdmin) {
        // Help đầy đủ cho Admin
        const adminHelpMessage = `
📚 *HƯỚNG DẪN ADMIN - BOT TWITTER NEWS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 **QUYỀN TRUY CẬP: ADMIN (Full Access)**

👀 *LỆNH XEM THÔNG TIN:*
📋 \`/list\` - Danh sách tài khoản theo dõi
🔍 \`/info username\` - Chi tiết profile & stats user  
📊 \`/status\` - Trạng thái bot
❓ \`/help\` - Hướng dẫn đầy đủ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 *LỆNH QUẢN TRỊ:*
➕ \`/add username\` - Thêm user vào danh sách theo dõi
➖ \`/remove username\` - Xóa user khỏi danh sách
🔄 \`/update username\` - Cập nhật profile mới nhất
⚡ \`/check\` - Force check tweets ngay lập tức

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *VÍ DỤ SỬ DỤNG:*
\`/add elonmusk\`        → Thêm Elon Musk vào theo dõi
\`/info elonmusk\`       → Xem profile chi tiết + avatar
\`/check\`               → Kiểm tra tweets tất cả users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *THÔNG TIN KỸ THUẬT:*
🔄 Tự động: Bot check tweets mỗi ${process.env.CHECK_INTERVAL_MINUTES || 5} phút
📱 Username: Nhập không cần @ (elonmusk, không phải @elonmusk)  
🌍 Hỗ trợ: Chỉ tài khoản Twitter public
💾 Lưu trữ: Full profile + media + text + stats tweets
🚫 Chống spam: Không gửi lại tweets cũ
🔵 Verification: Hiển thị blue check & legacy verification
🖼️ Media: Hỗ trợ ảnh, video, GIF trong tweets
        `;
        
        this.bot.sendMessage(chatId, adminHelpMessage, { parse_mode: 'Markdown' });
      } else {
        // Help giản lược cho User thường
        const userHelpMessage = `
👀 *HƯỚNG DẪN USER - BOT TWITTER NEWS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 **QUYỀN TRUY CẬP: VIEWER (Chỉ xem)**

*LỆNH BẠN CÓ THỂ SỬ DỤNG:*
📋 \`/list\` - Xem danh sách tài khoản theo dõi
🔍 \`/info username\` - Chi tiết profile & stats user
📊 \`/status\` - Trạng thái bot & thống kê  
❓ \`/help\` - Hướng dẫn này

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *VÍ DỤ SỬ DỤNG:*
\`/list\`              → Xem tất cả users đang theo dõi
\`/info elonmusk\`     → Chi tiết profile + avatar Elon Musk  
\`/status\`            → Trạng thái bot + số liệu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *TÍNH NĂNG CHÍNH:*
🔄 **Tự động thông báo:** Tweets mới ngay khi có
📱 **Username:** Nhập không cần @ (ví dụ: elonmusk)
🔵 **Verification:** Hiển thị blue check & legacy verification  
🖼️ **Media:** Hỗ trợ ảnh, video, GIF trong tweets
🚫 **Chống spam:** Không gửi lại tweets cũ
📊 **Full stats:** Retweets, likes, views, replies
💾 **Profile đầy đủ:** Avatar, bio, followers, following
        `;
        
        this.bot.sendMessage(chatId, userHelpMessage, { parse_mode: 'Markdown' });
      }
    });

    // Command /add - Chỉ admin
    this.bot.onText(/\/add (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = match[1].replace('@', '').trim();

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/add elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      const result = await twitterService.addUserToTrack(username);
      
      if (result.success) {
        this.bot.sendMessage(chatId, `✅ ${result.message}`);
      } else {
        this.bot.sendMessage(chatId, `❌ ${result.message}`);
      }
    });

    // Command /remove - Chỉ admin
    this.bot.onText(/\/remove (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = match[1].replace('@', '').trim();

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/remove elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      const result = await twitterService.removeUserFromTrack(username);
      
      if (result.success) {
        this.bot.sendMessage(chatId, `✅ ${result.message}`);
      } else {
        this.bot.sendMessage(chatId, `❌ ${result.message}`);
      }
    });

    // Command /list
    this.bot.onText(/\/list/, async (msg) => {
      const chatId = msg.chat.id;
      
      const users = await twitterService.getTrackedUsers();
      
      if (users.length === 0) {
        this.bot.sendMessage(chatId, '📝 Chưa có tài khoản nào được theo dõi.\nSử dụng `/add username` để thêm tài khoản.', { parse_mode: 'Markdown' });
        return;
      }

      let message = `📋 *Danh sách tài khoản đang theo dõi:*\n\n`;
      users.forEach((user, index) => {
        const verificationBadge = user.isBlueVerified ? '🔵' : user.isVerified ? '✅' : '';
        const followerCount = user.followers ? `👥 ${user.followers.toLocaleString()}` : '';
        
        message += `${index + 1}. **${user.displayName}** ${verificationBadge} (@${user.username})\n`;
        if (followerCount) {
          message += `   ${followerCount} followers\n`;
        }
        if (user.description) {
          const shortDesc = user.description.length > 50 
            ? user.description.substring(0, 50) + '...' 
            : user.description;
          message += `   📝 ${shortDesc}\n`;
        }
        message += `\n`;
      });
      
      message += `*Tổng: ${users.length} tài khoản*`;
      
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // Command /check - Kiểm tra tweets thủ công (Chỉ admin)
    this.bot.onText(/\/check/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }
      
      this.bot.sendMessage(chatId, '⏳ Đang kiểm tra tweets mới...');
      
      const tweetChecker = require('../scheduler/tweetChecker');
      const result = await tweetChecker.manualCheck();
      
      if (result.success) {
        this.bot.sendMessage(chatId, `✅ ${result.message}`);
      } else {
        this.bot.sendMessage(chatId, `❌ ${result.message}`);
      }
    });

    // Command /status - Xem trạng thái bot
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const isAdmin = this.isAuthorized(userId, chatId);
      
      const users = await twitterService.getTrackedUsers();
      const Tweet = require('../models/Tweet');
      const totalTweets = await Tweet.countDocuments();
      const todayTweets = await Tweet.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
      });
      
      let statusMessage = `
📊 *Trạng thái Bot*

👥 Tài khoản theo dõi: ${users.length}
📝 Tổng tweets đã lưu: ${totalTweets}
📅 Tweets hôm nay: ${todayTweets}
⏰ Kiểm tra: Mỗi ${process.env.CHECK_INTERVAL_MINUTES || 5} phút

🔄 Bot đang hoạt động bình thường
${isAdmin ? '🔐 Quyền: **Admin**' : '👀 Quyền: **Chỉ xem**'}`;

      this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
    });

    // Command /info - Xem chi tiết profile user
    this.bot.onText(/\/info (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = match[1].replace('@', '').trim();

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/info elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      this.bot.sendMessage(chatId, `⏳ Đang lấy thông tin @${username}...`);

      try {
        const TwitterUser = require('../models/TwitterUser');
        const user = await TwitterUser.findOne({ username: username.toLowerCase() });

        if (!user) {
          this.bot.sendMessage(chatId, `❌ Không tìm thấy @${username} trong danh sách theo dõi!\nSử dụng \`/add ${username}\` để thêm user này.`, { parse_mode: 'Markdown' });
          return;
        }

        // Format thông tin user
        const verificationBadge = user.isBlueVerified ? '🔵' : user.isVerified ? '✅' : '';
        const joinDate = user.twitterCreatedAt ? moment(user.twitterCreatedAt).format('DD/MM/YYYY') : 'N/A';
        const lastUpdate = user.lastProfileUpdate ? moment(user.lastProfileUpdate).format('DD/MM/YYYY HH:mm') : 'N/A';

        let profileMessage = `
👤 *Profile của ${user.displayName}* ${verificationBadge}
@${user.username}

📝 **Bio:** ${user.description || 'Không có bio'}
📍 **Vị trí:** ${user.location || 'Không rõ'}
🔗 **Website:** ${user.url || 'Không có'}
📅 **Tham gia Twitter:** ${joinDate}

📊 **Thống kê:**
👥 Followers: ${(user.followers || 0).toLocaleString()}
👤 Following: ${(user.following || 0).toLocaleString()}
📝 Tweets: ${(user.statusesCount || 0).toLocaleString()}

🔄 **Cập nhật cuối:** ${lastUpdate}
        `;

        // Gửi ảnh đại diện nếu có
        if (user.profilePicture) {
          try {
            await this.bot.sendPhoto(chatId, user.profilePicture, {
              caption: profileMessage,
              parse_mode: 'Markdown'
            });
          } catch (photoError) {
            // Nếu không gửi được ảnh, chỉ gửi text
            this.bot.sendMessage(chatId, profileMessage, { parse_mode: 'Markdown' });
          }
        } else {
          this.bot.sendMessage(chatId, profileMessage, { parse_mode: 'Markdown' });
        }

      } catch (error) {
        logger.error(`Error getting user info for ${username}:`, error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi khi lấy thông tin @${username}!`);
      }
    });

    // Command /update - Cập nhật profile user (Chỉ admin)
    this.bot.onText(/\/update (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = match[1].replace('@', '').trim();

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/update elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      this.bot.sendMessage(chatId, `⏳ Đang cập nhật profile @${username}...`);

      const result = await twitterService.updateUserProfile(username);
      
      if (result.success) {
        this.bot.sendMessage(chatId, `✅ Đã cập nhật profile @${username}!`);
      } else {
        this.bot.sendMessage(chatId, `❌ ${result.message}`);
      }
    });

    // Command /admin - Thông tin admin (Chỉ admin)
    this.bot.onText(/\/admin/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      const adminMessage = `
🔐 *ADMIN PANEL*

**Cấu hình hiện tại:**
📱 Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}
💬 Chat ID: ${process.env.TELEGRAM_CHAT_ID || 'Chưa cấu hình'}
🐦 Twitter API: ${process.env.TWITTER_API_KEY ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}
🌐 Proxy: ${process.env.TELEGRAM_PROXY_URL ? '✅ Đang sử dụng' : '❌ Không sử dụng'}

**Admin Users:**
${this.adminUsers.length > 0 ? this.adminUsers.join(', ') : 'Chỉ chat ID chính'}

**Interval:**
⏰ Check tweets mỗi: ${process.env.CHECK_INTERVAL_MINUTES || 5} phút
      `;

      this.bot.sendMessage(chatId, adminMessage, { parse_mode: 'Markdown' });
    });
  }

  // Gửi tweet mới lên Telegram
  async sendTweetToTelegram(tweet) {
    try {
      const tweetUrl = `https://twitter.com/${tweet.username}/status/${tweet.tweetId}`;
      const timeAgo = moment(tweet.createdAt).fromNow();
      
      // Làm sạch text bỏ URL ảnh/media tự động
      let cleanText = tweet.text;
      if (tweet.media && tweet.media.length > 0) {
        tweet.media.forEach(media => {
          if (media.display_url) {
            cleanText = cleanText.replace(new RegExp(`https://t\.co/\\w+`, 'g'), '').trim();
          }
        });
      }

      // Tạo caption cho tin tức
      let caption = `
📰 **TIN TỨC MỚI**

👤 **${tweet.displayName}** (@${tweet.username})
🕐 ${timeAgo}

📝 **Nội dung:**
${cleanText}

📊 **Thống kê:**
🔄 ${tweet.retweetCount} Retweets
❤️ ${tweet.likeCount} Likes
💬 ${tweet.replyCount || 0} Replies
👁️ ${tweet.viewCount || 0} Views

🔗 [Xem bài viết gốc](${tweetUrl})
      `.trim();

      let sentMessage;

      // Kiểm tra có media không
      if (tweet.media && tweet.media.length > 0) {
        const photos = tweet.media.filter(media => media.type === 'photo' && media.url);
        const videos = tweet.media.filter(media => media.type === 'video' && media.url);
        
        if (photos.length > 0) {
          if (photos.length === 1) {
            // Gửi 1 ảnh với caption
            sentMessage = await this.bot.sendPhoto(this.chatId, photos[0].url, {
              caption: caption,
              parse_mode: 'Markdown'
            });
          } else {
            // Gửi nhiều ảnh trong album
            const mediaGroup = photos.slice(0, 10).map((photo, index) => ({
              type: 'photo',
              media: photo.url,
              caption: index === 0 ? caption : undefined,
              parse_mode: index === 0 ? 'Markdown' : undefined
            }));
            
            const messages = await this.bot.sendMediaGroup(this.chatId, mediaGroup);
            sentMessage = messages[0]; // Lấy message đầu tiên
          }
        } else if (videos.length > 0) {
          // Gửi video (chỉ gửi video đầu tiên vì Telegram giới hạn)
          try {
            sentMessage = await this.bot.sendVideo(this.chatId, videos[0].url, {
              caption: caption,
              parse_mode: 'Markdown'
            });
          } catch (videoError) {
            // Nếu lỗi video, gửi text với link
            logger.warn(`Không gửi được video, gửi text thay thế: ${videoError.message}`);
            caption += `\n\n🎥 **Video:** [Xem video](${videos[0].url})`;
            sentMessage = await this.bot.sendMessage(this.chatId, caption, { 
              parse_mode: 'Markdown',
              disable_web_page_preview: false
            });
          }
        } else {
          // Có media nhưng không phải ảnh/video, gửi text
          sentMessage = await this.bot.sendMessage(this.chatId, caption, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: false
          });
        }
      } else {
        // Không có media, chỉ gửi text
        sentMessage = await this.bot.sendMessage(this.chatId, caption, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        });
      }

      // Cập nhật trạng thái đã gửi
      tweet.isPostedToTelegram = true;
      tweet.telegramMessageId = sentMessage.message_id.toString();
      await tweet.save();

      logger.info(`Đã gửi tweet ${tweet.tweetId} lên Telegram với ${tweet.media?.length || 0} media`);
      return true;
    } catch (error) {
      logger.error(`Lỗi gửi tweet ${tweet.tweetId} lên Telegram:`, {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return false;
    }
  }

  // Gửi thông báo hệ thống
  async sendSystemMessage(message) {
    try {
      await this.bot.sendMessage(this.chatId, `🤖 ${message}`);
    } catch (error) {
      logger.error('Lỗi gửi system message:', error.message);
    }
  }
}

module.exports = TelegramService; 