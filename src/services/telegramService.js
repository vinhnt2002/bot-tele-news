const TelegramBot = require('node-telegram-bot-api');
const logger = require('../../utils/logger');
const twitterService = require('./twitterService');
const moment = require('moment');
const { HttpsProxyAgent } = require('https-proxy-agent');

class TelegramService {
  constructor() {
    // 🚀 PROXY SUPPORT: Check if proxy is needed
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

  // NEW: Setup error handlers for polling issues
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
        // Don't restart immediately for timeout, let it retry naturally
      } else if (error.code === 'ENOTFOUND') {
        logger.error('🌐 Network issue - check internet connection and proxy settings');
      }
    });

    // Handle webhook errors
    this.bot.on('webhook_error', (error) => {
      logger.error('🔗 Telegram webhook error:', error.message);
    });
  }

  // NEW: Restart polling with backoff
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

Bot này sẽ theo dõi các tài khoản Twitter và thông báo khi có tweet mới với đầy đủ thông tin profile, media và thống kê.

📋 *LỆNH XEM THÔNG TIN (Tất cả user):*
• \`/list\` - Danh sách tài khoản theo dõi với badges & stats
• \`/info username\` - Chi tiết profile + avatar user
• \`/status\` - Trạng thái bot & thống kê tweets
• \`/help\` - Hướng dẫn đầy đủ tất cả lệnh

${isAdmin ? `🔧 *LỆNH QUẢN TRỊ (Chỉ Admin):*
• \`/add username\` - Thêm user với full profile từ Twitter
• \`/remove username\` - Xóa user khỏi danh sách theo dõi  
• \`/update username\` - Cập nhật profile + stats mới nhất
• \`/check\` - Force check tweets mới tất cả users
• \`/admin\` - Quản lý quyền admin & config

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

    // Command /help - Hiển thị help khác nhau cho từng đối tượng
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
📊 \`/status\` - Trạng thái bot + optimization stats
❓ \`/help\` - Hướng dẫn đầy đủ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 *LỆNH QUẢN TRỊ:*
➕ \`/add username\` - Thêm user vào danh sách theo dõi
➖ \`/remove username\` - Xóa user khỏi danh sách
🔄 \`/update username\` - Cập nhật profile mới nhất
⚡ \`/check\` - Force check tweets ngay lập tức
🔐 \`/admin\` - Thông tin admin & cấu hình

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 *LỆNH TỐI ƯU CHI PHÍ:*
📊 \`/optimize\` - Dashboard tối ưu hóa real-time
🔄 \`/reset_optimization\` - Reset intervals về mặc định

🚀 *ADVANCED SEARCH OPTIMIZATION (MỚI):*
🎯 \`/migrate_advanced\` - Migrate sang Advanced Search (89% savings!)
🔄 \`/toggle_advanced\` - Bật/tắt Advanced Search mode
⚡ \`/force_advanced\` - Chạy Advanced Search ngay lập tức
📊 \`/cost_report\` - Chi tiết cost analysis & savings
🧪 \`/test_advanced username\` - Test Advanced Search cho user

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 *LỆNH BASELINE - CHỈ TWEETS MỚI:*
📌 \`/baseline username\` - Set baseline cho 1 user
📌 \`/baseline_all\` - Set baseline cho tất cả users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 *LỆNH DEBUG & FORCE:*
⚡ \`/force_check username\` - Force check ngay lập tức 1 user
🔍 \`/debug_users\` - Debug user activity & intervals
🧹 \`/maintenance\` - Manual maintenance (fix tăng dần)
🔄 \`/reset_user username\` - Reset activity cho 1 user

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *VÍ DỤ SỬ DỤNG:*
\`/add elonmusk\`        → Thêm Elon Musk vào theo dõi
\`/info elonmusk\`       → Xem profile chi tiết + avatar
\`/optimize\`            → Dashboard chi phí & intervals  
\`/baseline elonmusk\`   → Chỉ thông báo tweets mới của Elon
\`/baseline_all\`        → Set baseline cho tất cả users
\`/force_check elonmusk\` → Force check Elon ngay lập tức
\`/check\`               → Kiểm tra tweets tất cả users
\`/reset_optimization\`  → Reset optimization về normal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 *TỐI ƯU CHI PHÍ TỰ ĐỘNG:*
🔥 **Active users:** Check mỗi 5 phút (có tweets gần đây)
⚡ **Normal users:** Check mỗi 15 phút (hoạt động bình thường)  
🐌 **Inactive users:** Check mỗi 1 giờ (ít hoạt động)
😴 **Dead users:** Check mỗi 6 giờ (không tweet)
💾 **Smart caching:** Cache 8 phút để tránh duplicate API calls

💰 **HIỆU QUẢ:** Tiết kiệm 70-75% chi phí API so với check liên tục!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *THÔNG TIN KỸ THUẬT:*
🔄 Tự động: Bot tự điều chỉnh interval theo activity của user
📱 Username: Nhập không cần @ (elonmusk, không phải @elonmusk)  
🌍 Hỗ trợ: Chỉ tài khoản Twitter public
💾 Lưu trữ: Full profile + media + text + stats tweets
🚫 Chống spam: Không gửi lại tweets cũ
🔵 Verification: Hiển thị blue check & legacy verification
🖼️ Media: Hỗ trợ ảnh, video, GIF trong tweets

🆘 *HỖ TRỢ ADMIN:*
Bot đã được tối ưu hóa thông minh để tiết kiệm chi phí. Dùng \`/optimize\` để monitor!
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

🎯 *BOT THÔNG MINH - TỐI ƯU CHI PHÍ:*
🔥 **Users active:** Bot check mỗi 5 phút
⚡ **Users normal:** Bot check mỗi 15 phút  
🐌 **Users ít hoạt động:** Bot check mỗi 1 giờ
😴 **Users không hoạt động:** Bot check mỗi 6 giờ

💡 **Tự động:** Bot tự học và điều chỉnh tần suất check dựa trên activity của từng user!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *TÍNH NĂNG CHÍNH:*
🔄 **Tự động thông báo:** Tweets mới ngay khi có
📱 **Username:** Nhập không cần @ (ví dụ: elonmusk)
🔵 **Verification:** Hiển thị blue check & legacy verification  
🖼️ **Media:** Hỗ trợ ảnh, video, GIF trong tweets
🚫 **Chống spam:** Không gửi lại tweets cũ
📊 **Full stats:** Retweets, likes, views, replies
💾 **Profile đầy đủ:** Avatar, bio, followers, following

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

      this.bot.sendMessage(chatId, `⏳ Đang thêm @${username}...`);

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
⏰ Smart checking: Every 1 minute with intelligent filtering

🔄 Bot đang hoạt động bình thường
${isAdmin ? '🔐 Quyền: **Admin**' : '👀 Quyền: **Chỉ xem**'}`;

      // Add optimization stats for admin
      if (isAdmin) {
        const stats = twitterService.getUsageStats();
        statusMessage += `

📊 *Thống kê API (Session):*
🔥 API calls: ${stats.session.apiCalls}
💾 Calls saved: ${stats.session.savedCalls} 
⚡ Optimization: ${stats.session.optimizationRate}
⏱️ Calls/hour: ${stats.session.callsPerHour}

🎯 *Endpoints:*
📝 Tweets: ${stats.endpoints.tweetsEndpoint}
👤 UserInfo: ${stats.endpoints.userInfoEndpoint}
👥 Followers: ${stats.endpoints.followersEndpoint}`;
      }
      
      this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
    });

    // NEW: Command /optimize - Xem optimization stats và controls (Chỉ admin)
    this.bot.onText(/\/optimize/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      const stats = twitterService.getUsageStats();
      const activityStats = new Map();
      
      // Analyze user activity levels
      for (const [username, activity] of twitterService.userActivity.entries()) {
        const intervalMinutes = Math.floor(activity.interval / 60000);
        let level = 'normal';
        
        if (activity.interval === twitterService.intervals.active) level = 'active';
        else if (activity.interval === twitterService.intervals.inactive) level = 'inactive';
        else if (activity.interval === twitterService.intervals.dead) level = 'dead';
        
        if (!activityStats.has(level)) activityStats.set(level, 0);
        activityStats.set(level, activityStats.get(level) + 1);
      }

      const optimizeMessage = `
🎯 *OPTIMIZATION DASHBOARD*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 **API USAGE (SESSION):**
• API calls made: ${stats.session.apiCalls}
• Calls saved: ${stats.session.savedCalls}
• Optimization rate: ${stats.session.optimizationRate}
• Calls per hour: ${stats.session.callsPerHour}

🎯 **ENDPOINTS BREAKDOWN:**
• 📝 Tweets endpoint: ${stats.endpoints.tweetsEndpoint}
• 👤 UserInfo endpoint: ${stats.endpoints.userInfoEndpoint}
• 👥 Followers endpoint: ${stats.endpoints.followersEndpoint}

📊 **PHÂN BỐ USERS:**
${Array.from(activityStats.entries()).map(([level, count]) => {
  const icons = { active: '🔥', normal: '⚡', inactive: '🐌', dead: '😴' };
  const names = { active: 'Active (5 min)', normal: 'Normal (15 min)', inactive: 'Inactive (1 hour)', dead: 'Dead (6 hours)' };
  return `• ${icons[level]} ${names[level]}: ${count} users`;
}).join('\n')}

⚙️ **CÀI ĐẶT TỐI ƯU (EXTENDED):**
• Active users: 5 phút (có tweets <1h)
• Normal users: 30 phút (tweets <4h) 
• Inactive users: 2 giờ (tweets <24h)
• Dead users: 12 giờ (no recent tweets)
• Cache TTL: 8 phút
• Empty check threshold: 3/8 lần

💡 **OPTIMIZATION INSIGHT:**
Smart scheduling & caching giúp giảm ~70-75% API calls
Check TwitterAPI.io dashboard để xem actual costs

💰 **CHI PHÍ THỰC TẾ:**
${stats.note}

🔧 Dùng \`/reset_optimization\` để reset tất cả intervals
      `;
      
      this.bot.sendMessage(chatId, optimizeMessage, { parse_mode: 'Markdown' });
    });

    // NEW: Command /reset_optimization - Reset optimization settings (Chỉ admin)
    this.bot.onText(/\/reset_optimization/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      // Reset activity tracking
      const beforeCount = twitterService.userActivity.size;
      twitterService.userActivity.clear();
      twitterService.cache.clear();
      
      const message = `
🔄 *Optimization Reset!*

✅ **Đã reset:**
• User activity tracking: ${beforeCount} users
• Cache: Cleared all
• Intervals: Reset về normal (30 min)

🔄 **Kết quả:**
Tất cả users sẽ được check với interval normal.
Optimization sẽ tự động học lại activity patterns.
      `;
      
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // NEW: Command /baseline - Set baseline cho users (chỉ lấy tweets mới) (Chỉ admin)
    this.bot.onText(/\/baseline (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = match[1].replace('@', '').trim();

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/baseline elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      this.bot.sendMessage(chatId, `⏳ Đang set baseline cho @${username}...`);

      try {
        const result = await twitterService.setBaseline(username);
        
        if (result.success) {
          const message = `
✅ *Baseline đã được set cho @${username}*

📊 **Chi tiết:**
• Old lastTweetId: ${result.oldLastTweetId || 'null'}
• New lastTweetId: ${result.newLastTweetId || 'null'}

🎯 **Kết quả:**
Bot sẽ chỉ thông báo tweets mới từ bây giờ.
Không thông báo lại những tweets cũ.
          `;
          
          this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          this.bot.sendMessage(chatId, `❌ ${result.message}`);
        }
      } catch (error) {
        logger.error(`Error setting baseline for ${username}:`, error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi set baseline cho @${username}: ${error.message}`);
      }
    });

    // NEW: Command /baseline_all - Set baseline cho tất cả users (Chỉ admin)
    this.bot.onText(/\/baseline_all/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      this.bot.sendMessage(chatId, '⏳ Đang set baseline cho tất cả users...');

      try {
        const users = await twitterService.getTrackedUsers();
        let successCount = 0;
        let failCount = 0;
        
        for (const user of users) {
          try {
            const result = await twitterService.setBaseline(user.username);
            if (result.success) {
              successCount++;
              logger.info(`✅ Set baseline for ${user.username}`);
            } else {
              failCount++;
              logger.error(`❌ Failed to set baseline for ${user.username}: ${result.message}`);
            }
            
            // Small delay để tránh overwhelm API
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            failCount++;
            logger.error(`❌ Error setting baseline for ${user.username}:`, error.message);
          }
        }
        
        const message = `
✅ *Baseline All Complete!*

📊 **Kết quả:**
• Thành công: ${successCount} users
• Thất bại: ${failCount} users
• Tổng: ${users.length} users

🎯 **Hiệu ứng:**
Tất cả users sẽ chỉ thông báo tweets mới từ bây giờ.
        `;
        
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        logger.error('Error in baseline_all:', error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi khi set baseline cho tất cả: ${error.message}`);
      }
    });

    // NEW: Command /force_check - Force check specific user ngay lập tức (Chỉ admin)
    this.bot.onText(/\/force_check (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = match[1].replace('@', '').trim();

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/force_check elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      this.bot.sendMessage(chatId, `⏳ Đang force check @${username}...`);

      try {
        // Reset activity để force immediate check
        const activity = {
          lastTweetTime: 0,
          emptyChecks: 0,
          interval: twitterService.intervals.normal,
          lastCheckTime: 0 // Force immediate check
        };
        twitterService.userActivity.set(username, activity);

        // Manual check cho user này
        const TwitterUser = require('../models/TwitterUser');
        const user = await TwitterUser.findOne({ username: username.toLowerCase() });
        
        if (!user) {
          this.bot.sendMessage(chatId, `❌ User @${username} không tồn tại trong danh sách theo dõi!`);
          return;
        }

        // Manually check this user
        const tweetsData = await twitterService.getUserTweets(username);
        twitterService.updateUserActivity(username, tweetsData.tweets || []);
        
        if (tweetsData.tweets && tweetsData.tweets.length > 0) {
          let newTweetsCount = 0;
          const sortedTweets = tweetsData.tweets.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
          );

          // Check for new tweets
          for (const tweet of sortedTweets) {
            if (user.lastTweetId && tweet.id === user.lastTweetId) {
              break;
            }

            const Tweet = require('../models/Tweet');
            const existingTweet = await Tweet.findOne({ tweetId: tweet.id });
            
            if (!existingTweet) {
              newTweetsCount++;
              
              // Save and send tweet
              const newTweet = new Tweet({
                tweetId: tweet.id,
                userId: user.userId,
                username: user.username,
                displayName: user.displayName,
                text: tweet.text,
                createdAt: new Date(tweet.createdAt),
                media: [],
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
              
              // Send to telegram
              await this.sendTweetToTelegram(newTweet);
            }
          }

          // Update lastTweetId
          if (sortedTweets.length > 0) {
            user.lastTweetId = sortedTweets[0].id;
            await user.save();
          }

          const message = `
✅ *Force Check Complete!*

👤 **User:** @${username}
📊 **Tweets found:** ${tweetsData.tweets.length}
✨ **New tweets:** ${newTweetsCount}
🔄 **Cache:** ${tweetsData.fromCache ? 'Hit' : 'Miss'}

${newTweetsCount > 0 ? '🎉 New tweets have been sent!' : '📭 No new tweets found.'}
          `;
          
          this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          this.bot.sendMessage(chatId, `📭 Không tìm thấy tweets cho @${username}`);
        }

      } catch (error) {
        logger.error(`Error force checking ${username}:`, error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi force check @${username}: ${error.message}`);
      }
    });

    // NEW: Command /debug_users - Show detailed user activity tracking (Chỉ admin)
    this.bot.onText(/\/debug_users/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      const now = Date.now();
      let debugMessage = `🔧 *USER ACTIVITY DEBUG*\n\n`;

      if (twitterService.userActivity.size === 0) {
        debugMessage += '📭 No users in activity tracking yet.';
      } else {
        Array.from(twitterService.userActivity.entries()).forEach(([username, activity], index) => {
          const timeSinceLastCheck = now - activity.lastCheckTime;
          const nextCheckIn = Math.max(0, activity.interval - timeSinceLastCheck);
          const intervalName = Object.entries(twitterService.intervals).find(([key, val]) => val === activity.interval)?.[0] || 'custom';
          
          debugMessage += `**${index + 1}. @${username}**\n`;
          debugMessage += `📊 Interval: ${Math.floor(activity.interval/60000)}min (${intervalName})\n`;
          debugMessage += `⏰ Last check: ${Math.floor(timeSinceLastCheck/60000)}min ago\n`;
          debugMessage += `⏳ Next check: ${Math.floor(nextCheckIn/60000)}min\n`;
          debugMessage += `📭 Empty checks: ${activity.emptyChecks}/12\n`;
          debugMessage += `🕐 Last tweet: ${activity.lastTweetTime ? new Date(activity.lastTweetTime).toLocaleString() : 'Never'}\n\n`;
        });
      }

      debugMessage += `\n🎯 **INTERVALS CONFIG:**\n`;
      debugMessage += `🔥 Active: ${Math.floor(twitterService.intervals.active/60000)}min\n`;
      debugMessage += `⚡ Normal: ${Math.floor(twitterService.intervals.normal/60000)}min\n`;
      debugMessage += `🐌 Inactive: ${Math.floor(twitterService.intervals.inactive/60000)}min\n`;
      debugMessage += `😴 Dead: ${Math.floor(twitterService.intervals.dead/60000)}min\n`;

      this.bot.sendMessage(chatId, debugMessage, { parse_mode: 'Markdown' });
    });

    // NEW: Command /maintenance - Manual maintenance operations (Chỉ admin)
    this.bot.onText(/\/maintenance/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      // Thực hiện maintenance
      const beforeStats = {
        userActivitySize: twitterService.userActivity.size,
        cacheSize: twitterService.cache.size,
        sessionHours: ((Date.now() - twitterService.usageStats.sessionStartTime) / (1000 * 60 * 60)).toFixed(2)
      };

      twitterService.performPeriodicMaintenance();
      
      const afterStats = {
        userActivitySize: twitterService.userActivity.size,
        cacheSize: twitterService.cache.size
      };

      const message = `
🧹 *MANUAL MAINTENANCE COMPLETED*

**Before:**
• Users tracked: ${beforeStats.userActivitySize}
• Cache entries: ${beforeStats.cacheSize}
• Session hours: ${beforeStats.sessionHours}h

**After:**
• Users tracked: ${afterStats.userActivitySize}
• Cache entries: ${afterStats.cacheSize}

✅ **Actions performed:**
• Reset users with high empty checks (>10)
• Cleared expired cache entries
• Automatic optimizations applied

🔄 Use \`/reset_optimization\` for full reset if needed.
      `;
      
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // NEW: Command /reset_user - Reset specific user activity (Chỉ admin)
    this.bot.onText(/\/reset_user (.+)/, (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = match[1].replace('@', '').trim();

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/reset_user elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      const success = twitterService.resetUserActivity(username);
      
      if (success) {
        const message = `
✅ *User Activity Reset*

👤 **User:** @${username}
🔄 **Actions:**
• Empty checks: Reset to 0
• Interval: Reset to normal (15 min)
• Next check: Immediate

🎯 **Result:** User will be checked normally on next cycle.
        `;
        
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } else {
        this.bot.sendMessage(chatId, `❌ User @${username} không tồn tại trong activity tracking!`);
      }
    });

    // Command /admin - Xem thông tin admin (Chỉ admin)
    this.bot.onText(/\/admin/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const userName = msg.from.username || msg.from.first_name || 'Unknown';
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }
      
      const adminMessage = `
🔐 *Thông tin Admin*

👤 User hiện tại: ${userName} (ID: ${userId})
💬 Chat ID: ${chatId}

📋 *Danh sách Admin IDs:*
${this.adminUsers.map(id => `• ${id}`).join('\n')}

*Hướng dẫn cấu hình:*
Thêm \`TELEGRAM_ADMIN_IDS=id1,id2,id3\` vào file .env để cấu hình nhiều admin.
      `;
      
      this.bot.sendMessage(chatId, adminMessage, { parse_mode: 'Markdown' });
    });

    // Command /update - Cập nhật thông tin profile user (Chỉ admin)
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

      this.bot.sendMessage(chatId, `⏳ Đang cập nhật thông tin @${username}...`);

      const result = await twitterService.updateUserProfile(username);
      
      if (result.success) {
        this.bot.sendMessage(chatId, `✅ ${result.message}`);
      } else {
        this.bot.sendMessage(chatId, `❌ ${result.message}`);
      }
    });

    // Command /info - Xem thông tin chi tiết của user
    this.bot.onText(/\/info (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = match[1].replace('@', '').trim();

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/info elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      try {
        const TwitterUser = require('../models/TwitterUser');
        const user = await TwitterUser.findOne({ username: username.toLowerCase() });
        
        if (!user) {
          this.bot.sendMessage(chatId, `❌ Không tìm thấy user @${username} trong danh sách theo dõi!`);
          return;
        }

        const verificationBadge = user.isBlueVerified ? '🔵' : user.isVerified ? '✅' : '⚪';
        const lastUpdate = user.lastProfileUpdate ? moment(user.lastProfileUpdate).fromNow() : 'Chưa cập nhật';
        const twitterAge = user.twitterCreatedAt ? moment(user.twitterCreatedAt).fromNow() : 'Không rõ';

        const infoMessage = `
👤 **Thông tin chi tiết ${user.displayName}** ${verificationBadge}

🔗 **Username:** @${user.username}
🆔 **Twitter ID:** ${user.userId}
📝 **Bio:** ${user.description || 'Không có bio'}
📍 **Vị trí:** ${user.location || 'Không rõ'}
🌐 **Website:** ${user.url || 'Không có'}

📊 **Thống kê:**
👥 **Followers:** ${user.followers?.toLocaleString() || 0}
👤 **Following:** ${user.following?.toLocaleString() || 0}
📝 **Tweets:** ${user.statusesCount?.toLocaleString() || 0}

⏰ **Thời gian:**
🐦 **Tham gia Twitter:** ${twitterAge}
🤖 **Theo dõi từ:** ${moment(user.createdAt).fromNow()}
🔄 **Cập nhật gần nhất:** ${lastUpdate}

🏷️ **Loại tài khoản:** ${user.type || 'user'}
🎯 **Tweet cuối:** ${user.lastTweetId || 'Chưa có'}
        `;

        // Gửi thông tin dạng text
        await this.bot.sendMessage(chatId, infoMessage, { parse_mode: 'Markdown' });

        // Gửi avatar nếu có
        if (user.profilePicture) {
          try {
            await this.bot.sendPhoto(chatId, user.profilePicture, {
              caption: `🖼️ Avatar của **${user.displayName}**`,
              parse_mode: 'Markdown'
            });
          } catch (photoError) {
            logger.warn(`Không gửi được avatar cho ${username}: ${photoError.message}`);
          }
        }

      } catch (error) {
        logger.error(`Error getting user info for ${username}:`, error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi khi lấy thông tin user @${username}!`);
      }
    });

    // NEW: Command /migrate_advanced - Migrate to Advanced Search optimization (Chỉ admin)
    this.bot.onText(/\/migrate_advanced/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      this.bot.sendMessage(chatId, '🚀 Đang migrate sang Advanced Search optimization...');

      try {
        const result = await twitterService.migrateToOptimizedChecking();
        
        if (result.success) {
          const message = `
🎉 *MIGRATION COMPLETED!*

📊 **Kết quả:**
• Thành công: ${result.successCount} users
• Thất bại: ${result.failCount} users

🚀 **Advanced Search ACTIVATED!**
• Cost giảm từ 270 → ~30 credits/check
• Chỉ lấy tweets mới từ baseline
• Tiết kiệm ~89% chi phí!

🎯 **Next Steps:**
Sử dụng \`/cost_report\` để xem savings estimate
          `;
          
          this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
          this.bot.sendMessage(chatId, `❌ Migration failed: ${result.message}`);
        }
      } catch (error) {
        logger.error('Error in migrate_advanced:', error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi migration: ${error.message}`);
      }
    });

    // NEW: Command /cost_report - Show detailed cost analysis (Chỉ admin)
    this.bot.onText(/\/cost_report/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      try {
        const report = twitterService.generateCostReport();
        
        const message = `
📊 *ADVANCED SEARCH COST REPORT*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 **DAILY COST COMPARISON:**

🔴 **Old Method:**
• Method: ${report.estimatedDailyCosts.oldMethod.name}
• Cost/check: ${report.estimatedDailyCosts.oldMethod.costPerCheck} credits
• Daily total: ${report.estimatedDailyCosts.oldMethod.dailyCredits} credits
• Monthly: ${report.estimatedDailyCosts.oldMethod.monthlyCredits} credits

🟢 **Advanced Search:**  
• Method: ${report.estimatedDailyCosts.optimizedMethod.name}
• Cost/check: ${report.estimatedDailyCosts.optimizedMethod.costPerCheck} credits
• Daily total: ${report.estimatedDailyCosts.optimizedMethod.dailyCredits} credits
• Monthly: ${report.estimatedDailyCosts.optimizedMethod.monthlyCredits} credits

💎 **MONTHLY SAVINGS:**
• Credits saved: ${report.monthlySavings.creditsSaved}
• Percentage: ${report.monthlySavings.percentage}%
• ${report.monthlySavings.description}

📈 **CURRENT SESSION:**
• API calls: ${report.currentSession.session.apiCalls}
• Calls saved: ${report.currentSession.session.savedCalls}
• Optimization: ${report.currentSession.session.optimizationRate}

🎯 **KEY BENEFITS:**
✅ Only fetches NEW tweets since last check
✅ No waste on old/duplicate data  
✅ Scales perfectly with user activity
✅ 80-95% cost reduction vs old method

💡 Advanced Search is the future of cost-efficient Twitter monitoring!
        `;
        
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        logger.error('Error generating cost report:', error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi tạo cost report: ${error.message}`);
      }
    });

    // NEW: Command /test_advanced - Test Advanced Search for specific user (Chỉ admin)
    this.bot.onText(/\/test_advanced (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = match[1].replace('@', '').trim();

      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      if (!username) {
        this.bot.sendMessage(chatId, '❌ Vui lòng nhập username!\nVí dụ: `/test_advanced elonmusk`', { parse_mode: 'Markdown' });
        return;
      }

      this.bot.sendMessage(chatId, `🧪 Testing Advanced Search cho @${username}...`);

      try {
        // Test with 6 hours ago timestamp
        const sinceTimestamp = new Date(Date.now() - 6 * 60 * 60 * 1000);
        
        const result = await twitterService.getUserTweetsSince(username, sinceTimestamp);
        
        const message = `
🧪 *ADVANCED SEARCH TEST*

👤 **User:** @${username}
📅 **Since:** ${sinceTimestamp.toISOString()}

📊 **Results:**
• Method: ${result.method}
• Tweets found: ${result.tweets?.length || 0}
• Estimated cost: ${result.cost} credits
• Old method cost: 270 credits
• Savings: ${result.savings}%

${result.tweets?.length > 0 ? 
`🎉 **Latest tweets found:**
${result.tweets.slice(0, 3).map(t => `• ${t.text?.substring(0, 60)}...`).join('\n')}` : 
'📭 No new tweets in timeframe'}

💡 **Insight:** ${result.savings > 70 ? 'EXCELLENT savings!' : result.savings > 0 ? 'Good optimization' : 'Consider checking intervals'}
        `;
        
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        logger.error(`Error testing advanced search for ${username}:`, error.message);
        this.bot.sendMessage(chatId, `❌ Test failed for @${username}: ${error.message}`);
      }
    });

    // NEW: Command /force_advanced - Force run Advanced Search now (Chỉ admin)
    this.bot.onText(/\/force_advanced/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      this.bot.sendMessage(chatId, '🚀 Đang chạy Advanced Search cho tất cả users...');

      try {
        const tweetChecker = require('../scheduler/tweetChecker');
        const twitterService = require('./twitterService');
        
        // Force the Advanced Search to run immediately
        twitterService.forceAdvancedSearch = true;
        
        // Run the Advanced Search
        const result = await twitterService.checkNewTweetsOptimized();
        
        // Reset the flag
        twitterService.forceAdvancedSearch = false;
        
        // Update last run time
        tweetChecker.lastAdvancedRunTime = Date.now();
        
        // Parse results
        let newTweets = [];
        if (Array.isArray(result)) {
          newTweets = result;
        } else if (result && typeof result === 'object') {
          newTweets = result.tweets || result.newTweets || [];
        }
        
        const message = `
✅ *Advanced Search Run Complete!*

📊 **Results:**
• Total users checked: ${twitterService.userActivity.size || 0}
• New tweets found: ${newTweets.length}
• Last run time: ${new Date().toLocaleString()}

🎯 Advanced Search is now set to run automatically every 30 minutes
regardless of user activity intervals.
`;
        
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
      } catch (error) {
        logger.error('❌ Error forcing Advanced Search:', error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi chạy Advanced Search: ${error.message}`);
      }
    });

    // NEW: Command /toggle_advanced - Toggle Advanced Search mode (Chỉ admin)
    this.bot.onText(/\/toggle_advanced/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      
      // Kiểm tra quyền admin
      if (!this.isAuthorized(userId, chatId)) {
        this.bot.sendMessage(chatId, '🚫 Bạn không có quyền sử dụng lệnh này!');
        return;
      }

      try {
        const tweetChecker = require('../scheduler/tweetChecker');
        const currentMode = tweetChecker.useAdvancedSearch;
        
        // Toggle mode
        tweetChecker.useAdvancedSearch = !currentMode;
        
        const message = `
🔄 *ADVANCED SEARCH MODE TOGGLED*

📊 **Mode Changes:**
• Before: ${currentMode ? 'Advanced Search' : 'Regular last_tweets'}
• After: ${!currentMode ? 'Advanced Search' : 'Regular last_tweets'}

${!currentMode ? `🚀 **Advanced Search ACTIVATED!**
✅ ~89% cost reduction
✅ Only new tweets since baseline
✅ Smart timestamp filtering

🎯 Expected cost: 15-45 credits vs 270 credits` : 
`⚠️ **Back to Regular Mode**
❌ Higher costs (270 credits/check)
❌ Fetches all recent tweets
💡 Consider switching back for savings`}

📝 **Note:** Changes take effect on next check cycle
        `;
        
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
        logger.info(`🔄 Advanced Search mode toggled: ${currentMode} → ${!currentMode}`);
      } catch (error) {
        logger.error('Error toggling advanced search mode:', error.message);
        this.bot.sendMessage(chatId, `❌ Lỗi toggle mode: ${error.message}`);
      }
    });

    // Error handling
    this.bot.on('error', (error) => {
      logger.error('Telegram Bot Error:', error.message);
    });

    logger.info('Telegram Bot đã khởi động thành công!');
    logger.info(`🔐 Admin Users: ${this.adminUsers.length > 0 ? this.adminUsers.join(', ') : 'Chỉ Chat ID chính'}`);
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