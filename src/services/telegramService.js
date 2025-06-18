const TelegramBot = require('node-telegram-bot-api');
const logger = require('../../utils/logger');
const twitterService = require('./twitterService');
const moment = require('moment');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.setupCommands();
  }

  setupCommands() {
    // Command /start
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `
🤖 *Chào mừng bạn đến với Bot Twitter News!*

Bot này sẽ theo dõi các tài khoản Twitter và thông báo khi có tweet mới.

*Các lệnh có sẵn:*
/add @username - Thêm tài khoản Twitter để theo dõi
/remove @username - Xóa tài khoản khỏi danh sách theo dõi
/list - Xem danh sách tài khoản đang theo dõi
/check - Kiểm tra tweets mới ngay lập tức
/status - Xem trạng thái bot
/help - Xem hướng dẫn

*Ví dụ:*
\`/add elonmusk\`
\`/remove elonmusk\`
\`/check\`
      `;
      
      this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Command /help
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;
      const helpMessage = `
*🔧 Hướng dẫn sử dụng Bot Twitter News*

*Quản lý theo dõi:*
\`/add username\` - Thêm tài khoản Twitter
\`/remove username\` - Xóa tài khoản
\`/list\` - Xem danh sách theo dõi

*Kiểm tra và theo dõi:*
\`/check\` - Kiểm tra tweets mới ngay
\`/status\` - Xem trạng thái bot

*Lưu ý:*
• Username không cần có dấu @
• Bot sẽ tự động kiểm tra tweets mới mỗi ${process.env.CHECK_INTERVAL_MINUTES || 5} phút
• Chỉ các tài khoản Twitter public mới có thể theo dõi được
• Bot sẽ lưu lại tweets để tránh spam trùng lặp
      `;
      
      this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // Command /add
    this.bot.onText(/\/add (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = match[1].replace('@', '').trim();

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

    // Command /remove
    this.bot.onText(/\/remove (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = match[1].replace('@', '').trim();

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
        message += `${index + 1}. ${user.displayName} (@${user.username})\n`;
      });
      
      message += `\n*Tổng: ${users.length} tài khoản*`;
      
      this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });

    // Command /check - Kiểm tra tweets thủ công
    this.bot.onText(/\/check/, async (msg) => {
      const chatId = msg.chat.id;
      
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
      
      const users = await twitterService.getTrackedUsers();
      const Tweet = require('../models/Tweet');
      const totalTweets = await Tweet.countDocuments();
      const todayTweets = await Tweet.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
      });
      
      const statusMessage = `
📊 *Trạng thái Bot*

👥 Tài khoản theo dõi: ${users.length}
📝 Tổng tweets đã lưu: ${totalTweets}
📅 Tweets hôm nay: ${todayTweets}
⏰ Kiểm tra mỗi: ${process.env.CHECK_INTERVAL_MINUTES || 5} phút

🔄 Bot đang hoạt động bình thường
      `;
      
      this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
    });



    // Error handling
    this.bot.on('error', (error) => {
      logger.error('Telegram Bot Error:', error.message);
    });

    logger.info('Telegram Bot đã khởi động thành công!');
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