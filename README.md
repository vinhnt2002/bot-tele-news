# Twitter Telegram Bot 🤖

Bot tự động theo dõi tài khoản Twitter và thông báo lên Telegram khi có bài viết mới.

## ✨ Tính năng

- 🐦 Theo dõi nhiều tài khoản Twitter cùng lúc
- 📱 Thông báo tự động lên Telegram khi có tweet mới
- 🗃️ Lưu trữ dữ liệu vào MongoDB
- ⚙️ Quản lý danh sách theo dõi qua bot commands
- 📰 **Format tin tức chuyên nghiệp** với tiêu đề và thống kê đầy đủ
- 🖼️ **Gửi hình ảnh/video** trực tiếp từ tweets (album nhiều ảnh)
- 📊 Hiển thị thông tin engagement đầy đủ (likes, retweets, replies, views)
- 🔗 Link trực tiếp đến tweet gốc
- 🧹 Tự động làm sạch text (bỏ URL media thừa)
- ⏰ Kiểm tra định kỳ có thể tùy chỉnh
- 🚫 Tránh duplicate tweets với database tracking

## 🚀 Cài đặt

### 1. Clone repository

\`\`\`bash
git clone <your-repo-url>
cd bot-news-tele
\`\`\`

### 2. Cài đặt dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Thiết lập môi trường

Tạo file \`.env\` từ template:

\`\`\`bash
# Telegram Bot Token (từ @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# MongoDB Connection String
MONGODB_URI=mongodb://localhost:27017/twitter-telegram-bot

# TwitterAPI.io API Key (từ twitterapi.io)
TWITTER_API_KEY=your_twitter_api_key_here

# Telegram Chat ID nơi bot sẽ đăng tin (có thể lấy từ @userinfobot)
TELEGRAM_CHAT_ID=your_chat_id_here

# Thời gian check Twitter (phút)
CHECK_INTERVAL_MINUTES=5

# Port cho webhook (tùy chọn)
PORT=3000

# Node Environment
NODE_ENV=development
\`\`\`

### 4. Thiết lập các dịch vụ

#### 📱 Telegram Bot
1. Nhắn tin cho [@BotFather](https://t.me/BotFather) trên Telegram
2. Tạo bot mới bằng lệnh \`/newbot\`
3. Lấy token và điền vào \`TELEGRAM_BOT_TOKEN\`
4. Để lấy Chat ID, nhắn tin cho [@userinfobot](https://t.me/userinfobot)

#### 🐦 Twitter API
1. Đăng ký tài khoản tại [TwitterAPI.io](https://twitterapi.io)
2. Lấy API key và điền vào \`TWITTER_API_KEY\`

#### 🗄️ MongoDB
1. Cài đặt MongoDB local hoặc sử dụng MongoDB Atlas
2. Cập nhật connection string trong \`MONGODB_URI\`

### 5. Chạy ứng dụng

\`\`\`bash
# Development mode
npm run dev

# Production mode
npm start
\`\`\`

## 📖 Sử dụng

### Bot Commands

- \`/start\` - Khởi động bot và xem hướng dẫn
- \`/help\` - Xem danh sách lệnh và hướng dẫn chi tiết
- \`/add username\` - Thêm tài khoản Twitter để theo dõi
- \`/remove username\` - Xóa tài khoản khỏi danh sách
- \`/list\` - Xem danh sách tài khoản đang theo dõi
- \`/check\` - Kiểm tra tweets mới ngay lập tức
- \`/status\` - Xem trạng thái bot và thống kê chi tiết

### Ví dụ

\`\`\`
/add elonmusk
/add VitalikButerin
/add naval
/list
/remove elonmusk
\`\`\`

## 📁 Cấu trúc project

\`\`\`
bot-news-tele/
├── src/
│   ├── config/
│   │   └── database.js          # Cấu hình MongoDB
│   │   └── config.js            # Cấu hình các dịch vụ
│   ├── models/
│   │   ├── TwitterUser.js       # Model người dùng Twitter
│   │   └── Tweet.js             # Model tweet
│   ├── services/
│   │   ├── twitterService.js    # Service Twitter API
│   │   └── telegramService.js   # Service Telegram Bot
│   ├── scheduler/
│   │   └── tweetChecker.js      # Scheduler kiểm tra tweets
│   └── index.js                 # Entry point
├── utils/
│   └── logger.js                # Winston logger
├── logs/                        # Log files
├── package.json
├── .env.example
├── .gitignore
└── README.md
\`\`\`

## 🔧 Cấu hình

### Thời gian kiểm tra

Thay đổi \`CHECK_INTERVAL_MINUTES\` trong file \`.env\` để điều chỉnh tần suất kiểm tra tweets.

### Logs

Logs được lưu trong thư mục \`logs/\`:
- \`combined.log\` - Tất cả logs
- \`error.log\` - Chỉ error logs

## 🚦 Deployment

### PM2 (Production)

\`\`\`bash
npm install -g pm2
pm2 start src/index.js --name "twitter-bot"
pm2 startup
pm2 save
\`\`\`

### Docker

\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

## 🐛 Troubleshooting

### Lỗi thường gặp

1. **Bot không nhận được tin nhắn**
   - Kiểm tra token Telegram
   - Đảm bảo đã start chat với bot

2. **Không lấy được tweets**
   - Kiểm tra Twitter API key
   - Đảm bảo tài khoản public
   - Kiểm tra rate limits

3. **Lỗi kết nối MongoDB**
   - Kiểm tra connection string
   - Đảm bảo MongoDB đang chạy

### Debug mode

Đặt \`NODE_ENV=development\` để xem logs chi tiết.

## 📰 Tính năng Tin tức Nâng cao

### Format Tin tức Telegram

Bot gửi tweets dưới dạng tin tức chuyên nghiệp:

```
📰 TIN TỨC MỚI

👤 Elon Musk (@elonmusk)
🕐 5 minutes ago

📝 Nội dung:
Mars colony will be self-sustaining

📊 Thống kê:
🔄 1.2K Retweets
❤️ 5.3K Likes
💬 234 Replies
👁️ 50K Views

🔗 Xem bài viết gốc
```

### Media Support

- 🖼️ **Hình ảnh**: Gửi trực tiếp với caption
- 📸 **Album**: Tối đa 10 ảnh trong 1 message group
- 🎥 **Video**: Gửi video hoặc link nếu lỗi
- 🔗 **Links**: Hiển thị preview tự động

### Database Schema

#### Tweet Model
```javascript
{
  tweetId: String,      // ID duy nhất của tweet
  userId: String,       // ID của user Twitter
  username: String,     // Username (@elonmusk)
  displayName: String,  // Tên hiển thị (Elon Musk)
  text: String,         // Nội dung tweet
  createdAt: Date,      // Thời gian tạo
  media: [{             // Media đính kèm
    type: String,       // photo, video, animated_gif, url
    url: String,        // URL media
    expanded_url: String,
    display_url: String,
    width: Number,
    height: Number
  }],
  retweetCount: Number,
  likeCount: Number,
  replyCount: Number,
  quoteCount: Number,
  viewCount: Number,
  bookmarkCount: Number,
  isReply: Boolean,
  lang: String,         // Ngôn ngữ tweet
  source: String,       // Nguồn đăng (Twitter for iPhone, etc.)
  isPostedToTelegram: Boolean,
  telegramMessageId: String
}
```

## 🔄 Version History & Update Notes

### v2.0.0 - News Format Enhancement
**Ngày**: 2025-06-18

#### ✨ Tính năng mới:
- 📰 Format tin tức chuyên nghiệp với tiêu đề và thống kê
- 🖼️ Hỗ trợ gửi hình ảnh/video trực tiếp
- 📊 Thống kê engagement đầy đủ (views, bookmarks, quotes)
- 🧹 Tự động làm sạch text (bỏ URL media thừa)

#### 🔧 Technical Updates:
- Cập nhật Tweet model với các field mới
- Xử lý `extendedEntities.media` từ Twitter API
- Cải thiện error handling cho media
- Tối ưu database queries

#### 📝 Files Changed:
- `src/models/Tweet.js` - Thêm fields mới
- `src/services/twitterService.js` - Xử lý media + thống kê
- `src/services/telegramService.js` - Format tin tức + gửi media
- `README.md` - Cập nhật documentation

#### 🎯 Breaking Changes:
- Không có (backward compatible)

### v1.0.0 - Initial Release
**Ngày**: 2025-06-15

#### ✨ Core Features:
- Theo dõi multiple Twitter accounts
- Auto post to Telegram
- MongoDB storage
- Basic bot commands
- Simple tweet notifications

---

## 📋 TODO & Future Updates

### Phase 3 - Advanced Features
- [ ] Tweet thread support (chuỗi tweets)
- [ ] Hashtag/keyword filtering
- [ ] Custom notification times
- [ ] Multiple Telegram channels
- [ ] User permission system

### Phase 4 - Analytics
- [ ] Tweet performance analytics
- [ ] Popular content detection
- [ ] Engagement trends
- [ ] Export reports

### Phase 5 - AI Integration
- [ ] Content categorization
- [ ] Sentiment analysis
- [ ] Auto-summary for long threads
- [ ] Smart filtering

---

## 📄 License

MIT License

## 🤝 Contributing

Mọi đóng góp đều được chào đón! Hãy tạo pull request hoặc issue.

### Development Guidelines:
1. Fork repo và tạo feature branch
2. Commit với message rõ ràng
3. Test kỹ trước khi PR
4. Cập nhật README nếu cần
5. Follow coding conventions hiện tại

## 📧 Support

Nếu gặp vấn đề, hãy tạo issue trên GitHub hoặc liên hệ qua email. #   b o t - t e l e - n e w s  
 