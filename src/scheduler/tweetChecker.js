const cron = require('node-cron');
const twitterService = require('../services/twitterService');
const TelegramService = require('../services/telegramService');
const logger = require('../../utils/logger');

class TweetChecker {
  constructor() {
    this.telegramService = null;
    this.isRunning = false;
  }

  // Khởi động scheduler
  start() {
    const checkInterval = process.env.CHECK_INTERVAL_MINUTES || 5;
    const cronExpression = `*/${checkInterval} * * * *`;

    logger.info(`🚀 Tweet checker started: Check every ${checkInterval} minute(s)`);

    cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        logger.warn('Tweet checker đang chạy, bỏ qua lần check này');
        return;
      }

      this.isRunning = true;
      await this.checkAndPostNewTweets();
      this.isRunning = false;
    });

    // Chạy check đầu tiên ngay lập tức
    setTimeout(() => {
      this.checkAndPostNewTweets();
    }, 10000); // Delay 10 giây để các service khởi động hoàn tất
  }

  // Đặt Telegram Service
  setTelegramService(telegramService) {
    this.telegramService = telegramService;
  }

  // Kiểm tra và đăng tweets mới
  async checkAndPostNewTweets() {
    try {
      logger.info('🔍 Starting tweet check cycle...');
      
      // Sử dụng method checkNewTweets đã được cleanup
      const newTweets = await twitterService.checkNewTweets();

      if (!Array.isArray(newTweets) || newTweets.length === 0) {
        logger.info('📭 No new tweets found');
        return;
      }

      logger.info(`🎉 Found ${newTweets.length} new tweets!`);

      // Gửi từng tweet lên Telegram
      for (const tweet of newTweets) {
        if (this.telegramService) {
          await this.telegramService.sendTweetToTelegram(tweet);
          
          // Delay nhỏ giữa các message để tránh spam
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`✅ Sent ${newTweets.length} tweets to Telegram`);

    } catch (error) {
      logger.error('❌ Error during tweet check:', error.message);
      
      // Gửi thông báo lỗi nếu có Telegram service
      if (this.telegramService) {
        await this.telegramService.sendSystemMessage(
          `⚠️ Tweet check error: ${error.message}`
        );
      }
    }
  }

  // Kiểm tra thủ công (có thể gọi từ command)
  async manualCheck() {
    if (this.isRunning) {
      return { success: false, message: 'Đang có quá trình check khác chạy' };
    }

    this.isRunning = true;
    try {
      logger.info('🔧 Manual check triggered');
      
      // Sử dụng method checkNewTweets đã được cleanup
      const newTweets = await twitterService.checkNewTweets();
      
      if (!Array.isArray(newTweets)) {
        this.isRunning = false;
        return { success: false, message: 'Invalid response from Twitter service' };
      }
      
      for (const tweet of newTweets) {
        if (this.telegramService) {
          await this.telegramService.sendTweetToTelegram(tweet);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.isRunning = false;
      return { 
        success: true, 
        message: `✅ Manual check completed: ${newTweets.length} new tweets sent` 
      };
    } catch (error) {
      this.isRunning = false;
      logger.error('❌ Manual check error:', error.message);
      return { success: false, message: `❌ Error: ${error.message}` };
    }
  }
}

module.exports = new TweetChecker(); 