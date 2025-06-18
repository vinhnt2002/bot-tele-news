require('dotenv').config();
const connectDB = require('./config/database');
const TelegramService = require('./services/telegramService');
const tweetChecker = require('./scheduler/tweetChecker');
const logger = require('../utils/logger');

// Kiểm tra biến môi trường cần thiết
function checkEnvironmentVariables() {
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'MONGODB_URI',
    'TWITTER_API_KEY',
    'TELEGRAM_CHAT_ID'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error('Thiếu các biến môi trường cần thiết:', missingVars.join(', '));
    logger.error('Vui lòng tạo file .env và cấu hình các biến môi trường cần thiết');
    process.exit(1);
  }
}

// Hàm khởi động ứng dụng
async function startApplication() {
  try {
    logger.info('🚀 Bắt đầu khởi động Twitter Telegram Bot...');

    // Debug environment variables
    logger.info('🔍 Kiểm tra biến môi trường...');
    logger.info(`- TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'OK' : 'MISSING'}`);
    logger.info(`- TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID ? 'OK' : 'MISSING'} (${process.env.TELEGRAM_CHAT_ID})`);
    logger.info(`- MONGODB_URI: ${process.env.MONGODB_URI ? 'OK' : 'MISSING'}`);
    logger.info(`- TWITTER_API_KEY: ${process.env.TWITTER_API_KEY ? 'OK' : 'MISSING'}`);

    // Kiểm tra biến môi trường
    checkEnvironmentVariables();

    // Kết nối database
    await connectDB();
    logger.info('✅ Đã kết nối MongoDB thành công');

    // Khởi tạo Telegram service
    const telegramService = new TelegramService();
    logger.info('✅ Đã khởi tạo Telegram Bot');

    // Đặt Telegram service cho tweet checker
    tweetChecker.setTelegramService(telegramService);

    // Bắt đầu scheduler kiểm tra tweets
    tweetChecker.start();
    logger.info('✅ Đã khởi động tweet checker');

    // Gửi thông báo khởi động
    await telegramService.sendSystemMessage('🎉 Bot đã khởi động thành công và sẵn sàng theo dõi Twitter!');

    logger.info('🎉 Bot đã khởi động hoàn tất!');
    logger.info(`📱 Bot sẽ kiểm tra tweets mỗi ${process.env.CHECK_INTERVAL_MINUTES || 5} phút`);

  } catch (error) {
    logger.error('❌ Lỗi khởi động ứng dụng:', error.message);
    logger.error('📋 Chi tiết lỗi:', error.stack);
    console.error('❌ FULL ERROR:', error);
    process.exit(1);
  }
}

// Xử lý tín hiệu dừng ứng dụng
process.on('SIGINT', () => {
  logger.info('📱 Đang dừng bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('📱 Đang dừng bot...');
  process.exit(0);
});

// Xử lý lỗi không được catch
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Khởi động ứng dụng
startApplication(); 