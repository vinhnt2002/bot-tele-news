# Twitter Telegram Bot 🤖

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4+-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/username/bot-news-tele.svg)](https://github.com/username/bot-news-tele/stargazers)

> 🚀 Bot tự động theo dõi tài khoản Twitter và thông báo lên Telegram khi có bài viết mới với format tin tức chuyên nghiệp

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

# 🔐 Telegram Admin IDs (cách nhau bởi dấu phẩy, tùy chọn)
TELEGRAM_ADMIN_IDS=123456789,987654321

# Thời gian check Twitter (phút)
CHECK_INTERVAL_MINUTES=5

# Port cho webhook (tùy chọn)
PORT=3000

# Node Environment
NODE_ENV=development
\`\`\`

> **🔑 Cấu hình Admin:**
> - Nếu **không** cấu hình `TELEGRAM_ADMIN_IDS`, `TELEGRAM_CHAT_ID` tự động thành admin
> - Nếu **có** cấu hình `TELEGRAM_ADMIN_IDS`, chỉ những user trong danh sách mới có quyền admin
> - Để lấy User ID, nhắn tin cho [@userinfobot](https://t.me/userinfobot)

### 4. Thiết lập các dịch vụ

#### 📱 Telegram Bot
| Bước | Hành động | Ghi chú |
|------|-----------|---------|
| 1 | Nhắn tin cho [@BotFather](https://t.me/BotFather) | Tạo bot Telegram |
| 2 | Gửi lệnh `/newbot` và làm theo hướng dẫn | Đặt tên bot |
| 3 | Copy **Bot Token** → `TELEGRAM_BOT_TOKEN` | Giữ bí mật token |
| 4 | Nhắn tin cho [@userinfobot](https://t.me/userinfobot) | Lấy Chat ID |
| 5 | Copy **Chat ID** → `TELEGRAM_CHAT_ID` | Nơi nhận notifications |

#### 🐦 Twitter API
| Bước | Hành động | Liên kết |
|------|-----------|----------|
| 1 | Đăng ký tại TwitterAPI.io | [🔗 twitterapi.io](https://twitterapi.io) |
| 2 | Lấy API Key | Dashboard → API Keys |
| 3 | Copy key → `TWITTER_API_KEY` | Rate limit: 300 requests/hour |

#### 🗄️ MongoDB
| Tùy chọn | Hướng dẫn | Link |
|----------|-----------|------|
| **Local** | Cài MongoDB Community | [🔗 MongoDB Download](https://www.mongodb.com/try/download/community) |
| **Cloud** | Sử dụng MongoDB Atlas (Free) | [🔗 MongoDB Atlas](https://www.mongodb.com/atlas) |
| **Docker** | `docker run -p 27017:27017 mongo` | [🔗 Docker Hub](https://hub.docker.com/_/mongo) |

### 5. Chạy ứng dụng

| Mode | Command | Mô tả |
|------|---------|-------|
| 🔧 **Development** | `npm run dev` | Hot reload với nodemon |
| 🚀 **Production** | `npm start` | Stable production mode |
| 📊 **PM2** | `pm2 start src/index.js --name twitter-bot` | Process manager |

\`\`\`bash
# Development mode (recommended for testing)
npm run dev

# Production mode
npm start
\`\`\`

> 🎉 **Thành công!** Bot sẽ báo trong console khi kết nối thành công tới các dịch vụ.

## 📖 Sử dụng

### 🎯 Bot Commands

#### 👥 Commands Công Khai (Tất cả user)
| Command | Mô tả | Ví dụ |
|---------|-------|-------|
| `/start` | Khởi động bot và xem hướng dẫn | `/start` |
| `/help` | Xem danh sách lệnh và hướng dẫn chi tiết | `/help` |
| `/list` | Xem danh sách tài khoản đang theo dõi | `/list` |
| `/status` | Xem trạng thái bot và thống kê chi tiết | `/status` |

#### 🔐 Commands Admin (Chỉ admin)
| Command | Mô tả | Ví dụ |
|---------|-------|-------|
| `/add username` | Thêm tài khoản Twitter để theo dõi | `/add elonmusk` |
| `/remove username` | Xóa tài khoản khỏi danh sách | `/remove elonmusk` |
| `/check` | Kiểm tra tweets mới ngay lập tức | `/check` |
| `/admin` | Xem thông tin quyền truy cập | `/admin` |

### 🛡️ **BẢNG TỔNG KẾT QUYỀN**

| Command | 👑 Admin | 👤 User Thường | 📝 Ghi chú |
|---------|:--------:|:--------------:|-------------|
| `/start` | ✅ | ✅ | Welcome message |
| `/help` | ✅ | ✅ | Hướng dẫn sử dụng |
| `/list` | ✅ | ✅ | Xem danh sách theo dõi |
| `/status` | ✅ | ✅ | Xem trạng thái bot |
| `/add` | ✅ | ❌ | Thêm tài khoản Twitter |
| `/remove` | ✅ | ❌ | Xóa tài khoản Twitter |
| `/check` | ✅ | ❌ | Kiểm tra tweets thủ công |
| `/admin` | ✅ | ❌ | Xem thông tin admin |

> **⚡ Quan trọng:** 
> - User thường chỉ có thể **xem thông tin**, không thể quản lý
> - Tweet notifications gửi tới `TELEGRAM_CHAT_ID` duy nhất
> - Mỗi user có conversation **riêng tư** với bot
> - Nếu không cấu hình `TELEGRAM_ADMIN_IDS`, `TELEGRAM_CHAT_ID` tự động thành admin

### 💻 Ví dụ sử dụng

\`\`\`bash
# Admin thêm tài khoản theo dõi
/add elonmusk
/add VitalikButerin
/add naval

# Kiểm tra danh sách
/list

# Xóa tài khoản
/remove elonmusk

# Kiểm tra tweets thủ công
/check

# Xem trạng thái
/status
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

## 🔧 Cấu hình Nâng cao

### ⏰ Thời gian kiểm tra

| Biến môi trường | Mặc định | Mô tả |
|-----------------|----------|-------|
| `CHECK_INTERVAL_MINUTES` | `5` | Tần suất check tweets (phút) |

\`\`\`bash
# Kiểm tra mỗi 2 phút (nhanh hơn)
CHECK_INTERVAL_MINUTES=2

# Kiểm tra mỗi 10 phút (tiết kiệm API calls)
CHECK_INTERVAL_MINUTES=10
\`\`\`

### 📝 Logs

| File | Nội dung | Vị trí |
|------|----------|--------|
| `combined.log` | Tất cả logs | `logs/combined.log` |
| `error.log` | Chỉ error logs | `logs/error.log` |
| Console | Real-time logs | Terminal output |

## 🚦 Deployment

### 🔄 PM2 (Production - Khuyến nghị)

\`\`\`bash
# Cài đặt PM2 globally
npm install -g pm2

# Start bot với PM2
pm2 start src/index.js --name "twitter-bot"

# Auto start khi boot
pm2 startup

# Lưu cấu hình
pm2 save

# Các lệnh quản lý hữu ích
pm2 list                    # Xem danh sách process
pm2 restart twitter-bot     # Restart bot
pm2 stop twitter-bot        # Dừng bot
pm2 logs twitter-bot        # Xem logs
pm2 monit                   # Monitor dashboard
\`\`\`

### 🐳 Docker

\`\`\`dockerfile
FROM node:18-alpine

# Cài thêm timezone data
RUN apk add --no-cache tzdata

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "console.log('Health check OK')" || exit 1

# Start app
CMD ["npm", "start"]
\`\`\`

\`\`\`bash
# Build image
docker build -t twitter-telegram-bot .

# Run container
docker run -d \
  --name twitter-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  twitter-telegram-bot
\`\`\`

### ☁️ Docker Compose

\`\`\`yaml
version: '3.8'
services:
  twitter-bot:
    build: .
    container_name: twitter-telegram-bot
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./logs:/app/logs
    depends_on:
      - mongodb

  mongodb:
    image: mongo:6.0
    container_name: twitter-bot-db
    restart: unless-stopped
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: twitter-telegram-bot

volumes:
  mongodb_data:
\`\`\`

## 🐛 Troubleshooting & FAQ

### ❗ Lỗi thường gặp

| 🚨 Vấn đề | 🔍 Nguyên nhân | ✅ Giải pháp |
|-----------|----------------|--------------|
| Bot không nhận tin nhắn | Token sai hoặc chưa start chat | Check `TELEGRAM_BOT_TOKEN`, gửi `/start` cho bot |
| Không lấy được tweets | API key sai hoặc rate limit | Verify `TWITTER_API_KEY`, chờ reset rate limit |
| Kết nối MongoDB lỗi | Connection string sai | Check `MONGODB_URI`, đảm bảo DB chạy |
| User không có quyền admin | Chưa config admin IDs | Set `TELEGRAM_ADMIN_IDS` hoặc dùng `TELEGRAM_CHAT_ID` |
| Bot không gửi notifications | Chat ID sai | Verify `TELEGRAM_CHAT_ID` bằng [@userinfobot](https://t.me/userinfobot) |

### 🔧 Debug Mode

\`\`\`bash
# Bật debug mode để xem logs chi tiết
NODE_ENV=development npm run dev

# Hoặc trong .env
NODE_ENV=development
\`\`\`

### 📞 Support Commands

| Command | Mô tả | Khi nào dùng |
|---------|-------|--------------|
| `/admin` | Xem thông tin admin | Check quyền và user IDs |
| `/status` | Trạng thái bot | Check kết nối và thống kê |
| `/check` | Kiểm tra manual | Test API Twitter |

## 📰 Tính năng Tin tức Nâng cao

### 📱 Format Tin tức Telegram

Bot gửi tweets dưới dạng tin tức chuyên nghiệp:

<details>
<summary>🎨 <strong>Xem Preview Message</strong></summary>

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

</details>

### 🎬 Media Support

| Loại Media | Xử lý | Giới hạn |
|------------|-------|----------|
| 🖼️ **Ảnh đơn** | Gửi trực tiếp với caption | 20MB |
| 📸 **Album ảnh** | Media group (tối đa 10 ảnh) | 10 ảnh/group |
| 🎥 **Video** | Upload trực tiếp hoặc link fallback | 50MB |
| 🔗 **Link** | Auto preview với thumbnail | Không giới hạn |
| 🎭 **GIF** | Gửi dưới dạng animation | 20MB |

> 💡 **Smart Processing:** Bot tự động làm sạch URLs media thừa khỏi text content.

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

---

## 🤝 Contributing

Chào mừng mọi đóng góp! 🎉

### 🚀 Quick Start cho Contributors

| Bước | Hành động | Command |
|------|-----------|---------|
| 1 | Fork repo | GitHub UI |
| 2 | Clone project | `git clone <your-fork>` |
| 3 | Create branch | `git checkout -b feature/amazing-feature` |
| 4 | Make changes | Code với ❤️ |
| 5 | Test kỹ | `npm test` (if available) |
| 6 | Commit | `git commit -m "Add amazing feature"` |
| 7 | Push | `git push origin feature/amazing-feature` |
| 8 | Pull Request | GitHub UI |

### 📋 Development Guidelines

- ✅ **Code Style**: Follow existing conventions
- 📝 **Commit Messages**: Clear and descriptive
- 🧪 **Testing**: Test thoroughly before PR
- 📚 **Documentation**: Update README if needed
- 🔍 **Review**: Respond to review comments

### 💡 Contribution Ideas

- 🐛 Bug fixes
- ✨ New features  
- 📖 Documentation improvements
- 🎨 UI/UX enhancements
- 🔧 Performance optimizations

## 📧 Support & Community

| Hỗ trợ | Link | Mô tả |
|--------|------|-------|
| 🐛 **Issues** | [GitHub Issues](https://github.com/username/bot-news-tele/issues) | Bug reports, feature requests |
| 💬 **Discussions** | [GitHub Discussions](https://github.com/username/bot-news-tele/discussions) | Q&A, ideas, general chat |
| 📖 **Wiki** | [GitHub Wiki](https://github.com/username/bot-news-tele/wiki) | Detailed guides |
| ⭐ **Star us** | [GitHub Star](https://github.com/username/bot-news-tele) | Show your support! |

## 📄 License

**MIT License** - Sử dụng tự do cho cả mục đích thương mại và cá nhân.

---

<div align="center">

### 🌟 Nếu project này hữu ích, hãy cho chúng tôi 1 star! ⭐

**Made with ❤️ by Vietnamese Developers**

</div>