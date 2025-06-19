const TelegramBot = require('node-telegram-bot-api');
const logger = require('../../utils/logger');
const twitterService = require('./twitterService');
const moment = require('moment');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    
    // Danh sách admin được phép sử dụng các lệnh quản lý
    this.adminUsers = this.parseAdminUsers(process.env.TELEGRAM_ADMIN_IDS);
    
    this.setupCommands();
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

🎯 *LỆNH TỐI ƯU CHI PHÍ (MỚI):*
📊 \`/optimize\` - Dashboard tối ưu hóa real-time
🔄 \`/reset_optimization\` - Reset intervals về mặc định

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *VÍ DỤ SỬ DỤNG:*
\`/add elonmusk\`        → Thêm Elon Musk vào theo dõi
\`/info elonmusk\`       → Xem profile chi tiết + avatar
\`/optimize\`            → Dashboard chi phí & intervals  
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
⏰ Kiểm tra mỗi: ${process.env.CHECK_INTERVAL_MINUTES || 5} phút

🔄 Bot đang hoạt động bình thường
${isAdmin ? '🔐 Quyền: **Admin**' : '👀 Quyền: **Chỉ xem**'}`;

      // Add optimization stats for admin
      if (isAdmin) {
        const stats = twitterService.getUsageStats();
        statusMessage += `

💰 *Tối ưu & Chi phí:*
💸 Chi phí ước tính: $${stats.totalEstimatedCost}
💾 Tiết kiệm được: $${stats.savedCost}
📊 API calls: ${stats.usage.requests}
⚡ Calls saved: ${stats.usage.savedByOptimization}`;
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

💰 **CHI PHÍ & TIẾT KIỆM:**
• Tổng chi phí: $${stats.totalEstimatedCost}
• Đã tiết kiệm: $${stats.savedCost}
• API calls: ${stats.usage.requests}
• Calls saved: ${stats.usage.savedByOptimization}

📊 **PHÂN BỐ USERS:**
${Array.from(activityStats.entries()).map(([level, count]) => {
  const icons = { active: '🔥', normal: '⚡', inactive: '🐌', dead: '😴' };
  const names = { active: 'Active (5 min)', normal: 'Normal (15 min)', inactive: 'Inactive (1 hour)', dead: 'Dead (6 hours)' };
  return `• ${icons[level]} ${names[level]}: ${count} users`;
}).join('\n')}

⚙️ **CÀI ĐẶT TỐI ƯU:**
• Cache TTL: 8 phút
• Delay giữa users: 1 giây
• Empty check threshold: 3/8 lần

💡 **HIỆU QUẢ DỰ KIẾN:**
Với 20 users, từ 5,760 → ~1,500 requests/ngày
Tiết kiệm: ~70-75% chi phí API

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
• Intervals: Reset về normal (15 min)

🔄 **Kết quả:**
Tất cả users sẽ được check với interval normal.
Optimization sẽ tự động học lại activity patterns.
      `;
      
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
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