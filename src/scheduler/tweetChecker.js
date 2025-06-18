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
    const interval = process.env.CHECK_INTERVAL_MINUTES || 5;
    const cronExpression = `*/${interval} * * * *`; // Chạy mỗi X phút

    logger.info(`Bắt đầu theo dõi tweets, kiểm tra mỗi ${interval} phút`);

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
      logger.info('Bắt đầu kiểm tra tweets mới...');

      const newTweets = await twitterService.checkNewTweets();

      if (newTweets.length === 0) {
        logger.info('Không có tweets mới');
        return;
      }

      logger.info(`Tìm thấy ${newTweets.length} tweets mới`);

      // Gửi từng tweet lên Telegram
      for (const tweet of newTweets) {
        if (this.telegramService) {
          await this.telegramService.sendTweetToTelegram(tweet);
          
          // Delay nhỏ giữa các message để tránh spam
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Đã gửi ${newTweets.length} tweets lên Telegram`);

    } catch (error) {
      logger.error('Lỗi khi kiểm tra tweets mới:', error.message);
      
      // Gửi thông báo lỗi nếu có Telegram service
      if (this.telegramService) {
        await this.telegramService.sendSystemMessage(
          `⚠️ Lỗi khi kiểm tra tweets: ${error.message}`
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
      const newTweets = await twitterService.checkNewTweets();
      
      for (const tweet of newTweets) {
        if (this.telegramService) {
          await this.telegramService.sendTweetToTelegram(tweet);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.isRunning = false;
      return { 
        success: true, 
        message: `Đã kiểm tra và gửi ${newTweets.length} tweets mới` 
      };
    } catch (error) {
      this.isRunning = false;
      logger.error('Lỗi manual check:', error.message);
      return { success: false, message: `Lỗi: ${error.message}` };
    }
  }
}

module.exports = new TweetChecker(); 