const cron = require('node-cron');
const twitterService = require('../services/twitterService');
const TelegramService = require('../services/telegramService');
const logger = require('../../utils/logger');

class TweetChecker {
  constructor() {
    this.telegramService = null;
    this.isRunning = false;
    this.useAdvancedSearch = true; // Always enable Advanced Search
    this.lastAdvancedRunTime = 0; // Track last successful run
    this.advancedRunInterval = 2 * 60 * 1000; // Run Advanced Search every 2 minutes (FOR TESTING)
  }

  // FIXED: Khởi động scheduler với smart intervals
  start() {
    // CHANGED: Chạy mỗi 1 phút để check nhanh, nhưng smart filtering sẽ quyết định users nào cần check
    const checkInterval = 1; // Check mỗi 1 phút
    const cronExpression = `*/${checkInterval} * * * *`;

    logger.info(`🚀 Smart scheduler started: Check every ${checkInterval} minute(s) with intelligent filtering`);
    logger.info(`🎯 Users will be checked based on their activity patterns (5min/15min/1h/6h)`);

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

  // IMPROVED: Kiểm tra và đăng tweets mới với smart filtering và forced Advanced Search
  async checkAndPostNewTweets() {
    try {
      logger.info('🔍 Smart check cycle started...');
      
      let result;
      const now = Date.now();
      const timeSinceLastAdvancedRun = now - this.lastAdvancedRunTime;
      const shouldRunAdvanced = timeSinceLastAdvancedRun >= this.advancedRunInterval;
      
      if (shouldRunAdvanced) {
        logger.info(`🚀 Running FORCED Advanced Search check (${Math.floor(timeSinceLastAdvancedRun/60000)}min since last run)`);
        
        // Set a flag to force-run Advanced Search regardless of intervals
        twitterService.forceAdvancedSearch = true;
        
        // 🚀 Use Advanced Search method (force run)
        result = await twitterService.checkNewTweetsOptimized();
        
        // Reset flag and update last run time
        twitterService.forceAdvancedSearch = false;
        this.lastAdvancedRunTime = now;
        logger.info(`✅ Completed forced Advanced Search run`);
      } else {
        // Regular optimized check with smart intervals
        result = await twitterService.checkNewTweetsOptimized();
      }

      // Handle different return formats
      let newTweets = [];
      if (Array.isArray(result)) {
        // Old format returns array directly
        newTweets = result;
             } else if (result && result.success) {
         // New format returns object with success flag
         newTweets = result.newTweets || result.tweets || [];
         if (result.message) {
           logger.info(`📊 ${result.message}`);
         }
      } else if (result && typeof result === 'object') {
        // Handle other object formats
        newTweets = result.tweets || result.newTweets || [];
      }

      if (!Array.isArray(newTweets) || newTweets.length === 0) {
        logger.info('📭 No new tweets found (smart optimization working)');
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
      logger.error('❌ Error during smart check:', error.message);
      
      // Gửi thông báo lỗi nếu có Telegram service
      if (this.telegramService) {
        await this.telegramService.sendSystemMessage(
          `⚠️ Smart check error: ${error.message}`
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
      
      // Enable force flag for Advanced Search
      twitterService.forceAdvancedSearch = true;
      
      // 🚀 Use Advanced Search method for manual check
      const result = await twitterService.checkNewTweetsOptimized();
      
      // Reset force flag
      twitterService.forceAdvancedSearch = false;
      
      // Update last run time
      this.lastAdvancedRunTime = Date.now();

      // Handle different return formats for manual check
      let newTweets = [];
      if (Array.isArray(result)) {
        newTweets = result;
             } else if (result && result.success) {
         newTweets = result.newTweets || result.tweets || [];
       } else if (result && typeof result === 'object') {
        newTweets = result.tweets || result.newTweets || [];
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