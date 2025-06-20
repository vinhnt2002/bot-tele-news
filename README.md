# Twitter Telegram Bot 🤖

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4+-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> 🚀 Bot tự động theo dõi tài khoản Twitter và thông báo lên Telegram khi có tweet mới với Advanced Search API

## ✨ Tính năng

- 🐦 **Theo dõi nhiều tài khoản Twitter** - Thêm/xóa users dễ dàng
- 📱 **Thông báo tự động lên Telegram** - Real-time notifications
- 🔍 **Advanced Search API** - Tìm tweets mới hiệu quả và tiết kiệm
- 🗃️ **Lưu trữ MongoDB** - Database đầy đủ với user profiles và tweets
- ⚙️ **Quản lý qua bot commands** - Interface thân thiện
- 📰 **Format tin tức chuyên nghiệp** - Hiển thị đẹp với stats đầy đủ
- 🖼️ **Hỗ trợ media** - Ảnh, video, GIF trực tiếp từ tweets
- 📊 **Thống kê engagement** - Likes, retweets, replies, views
- 🔗 **Link trực tiếp** - Đến tweet gốc
- 🚫 **Chống duplicate** - Không gửi lại tweets cũ
- 🔵 **Verification badges** - Blue check và legacy verification
- 👥 **Profile đầy đủ** - Avatar, bio, followers, following

## 🚀 Cài đặt

### 1. Clone repository

```bash
git clone <your-repo-url>
cd bot-tele-news
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Thiết lập môi trường

Tạo file `.env` từ template:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_ADMIN_IDS=123456789,987654321

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/twitter-telegram-bot

# Twitter API (TwitterAPI.io)
TWITTER_API_KEY=your_twitter_api_key_here

# Bot Settings
CHECK_INTERVAL_MINUTES=5
NODE_ENV=development
PORT=3000
```

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
| 3 | Copy key → `TWITTER_API_KEY` | Advanced Search support |

#### 🗄️ MongoDB
| Tùy chọn | Hướng dẫn | Link |
|----------|-----------|------|
| **Local** | Cài MongoDB Community | [🔗 MongoDB Download](https://www.mongodb.com/try/download/community) |
| **Cloud** | Sử dụng MongoDB Atlas (Free) | [🔗 MongoDB Atlas](https://www.mongodb.com/atlas) |
| **Docker** | `docker run -p 27017:27017 mongo` | [🔗 Docker Hub](https://hub.docker.com/_/mongo) |

### 5. Chạy ứng dụng

```bash
# Development mode (khuyến nghị cho testing)
npm run dev

# Production mode
npm start

# PM2 (production)
pm2 start src/index.js --name twitter-bot
```

## 📖 Sử dụng

### 🎯 Bot Commands

#### 👥 Commands Công Khai (Tất cả user)
| Command | Mô tả | Ví dụ |
|---------|-------|-------|
| `/start` | Khởi động bot và xem hướng dẫn | `/start` |
| `/help` | Xem danh sách lệnh chi tiết | `/help` |
| `/list` | Xem danh sách tài khoản đang theo dõi | `/list` |
| `/info username` | Xem chi tiết profile user | `/info elonmusk` |
| `/status` | Xem trạng thái bot và thống kê | `/status` |

#### 🔐 Commands Admin (Chỉ admin)
| Command | Mô tả | Ví dụ |
|---------|-------|-------|
| `/add username` | Thêm tài khoản Twitter để theo dõi | `/add elonmusk` |
| `/remove username` | Xóa tài khoản khỏi danh sách | `/remove elonmusk` |
| `/update username` | Cập nhật profile user mới nhất | `/update elonmusk` |
| `/check` | Kiểm tra tweets mới ngay lập tức | `/check` |
| `/admin` | Xem thông tin quyền admin | `/admin` |

### 🛡️ **QUYỀN TRUY CẬP**

| Command | 👑 Admin | 👤 User Thường | 📝 Ghi chú |
|---------|:--------:|:--------------:|-------------|
| `/start` | ✅ | ✅ | Welcome message |
| `/help` | ✅ | ✅ | Hướng dẫn sử dụng |
| `/list` | ✅ | ✅ | Xem danh sách theo dõi |
| `/info` | ✅ | ✅ | Chi tiết profile user |
| `/status` | ✅ | ✅ | Trạng thái bot |
| `/add` | ✅ | ❌ | Thêm tài khoản Twitter |
| `/remove` | ✅ | ❌ | Xóa tài khoản Twitter |
| `/update` | ✅ | ❌ | Cập nhật profile |
| `/check` | ✅ | ❌ | Kiểm tra tweets thủ công |
| `/admin` | ✅ | ❌ | Xem thông tin admin |

> **⚡ Quan trọng:** 
> - Nếu không cấu hình `TELEGRAM_ADMIN_IDS`, `TELEGRAM_CHAT_ID` tự động thành admin
> - Tweet notifications gửi tới `TELEGRAM_CHAT_ID` 
> - Admin IDs được phân cách bằng dấu phẩy

### 💻 Ví dụ sử dụng

```bash
# Admin thêm tài khoản theo dõi
/add elonmusk
/add VitalikButerin
/add naval

# Xem chi tiết profile
/info elonmusk

# Kiểm tra danh sách
/list

# Xóa tài khoản
/remove elonmusk

# Kiểm tra tweets thủ công
/check

# Xem trạng thái
/status
```

## 📁 Cấu trúc project

```
bot-tele-news/
├── src/
│   ├── config/
│   │   └── database.js          # Cấu hình MongoDB
│   ├── models/
│   │   ├── TwitterUser.js       # Model người dùng Twitter
│   │   └── Tweet.js             # Model tweet
│   ├── services/
│   │   ├── twitterService.js    # Service Twitter API (Advanced Search)
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
```

## 🔧 Core Functionality

### 🔍 Advanced Search API
- **Endpoint**: `/twitter/tweet/advanced_search`
- **Query format**: `from:username since:YYYY-MM-DD_HH:MM:SS_UTC`
- **Tính năng**: Chỉ lấy tweets mới từ timestamp cụ thể
- **Hiệu quả**: Tiết kiệm API calls, chỉ fetch dữ liệu cần thiết

### ⏰ Tweet Checking Process
1. **Scheduler**: Chạy mỗi `CHECK_INTERVAL_MINUTES` phút
2. **Advanced Search**: Tìm tweets từ `lastTweetId` timestamp
3. **Filter**: Loại bỏ duplicates và tweets cũ
4. **Save**: Lưu vào MongoDB
5. **Notify**: Gửi lên Telegram với format tin tức

### 📱 Telegram Integration
- **Bot Commands**: Quản lý users và xem thông tin
- **Media Support**: Ảnh, video, GIF trực tiếp
- **News Format**: Professional layout với stats
- **Error Handling**: Graceful degradation và retry logic

## 📰 Format Tin tức

### 📱 Preview Message Telegram

```
📰 TIN TỨC MỚI

👤 Elon Musk 🔵 (@elonmusk)  
🕐 5 minutes ago

📝 Nội dung:
Mars colony will be self-sustaining by 2050

📊 Thống kê:
🔄 1.2K Retweets
❤️ 5.3K Likes  
💬 234 Replies
👁️ 50K Views

🔗 Xem bài viết gốc
```

### 🎬 Media Support

| Loại Media | Xử lý | Giới hạn |
|------------|-------|----------|
| 🖼️ **Ảnh đơn** | Gửi trực tiếp với caption | 20MB |
| 📸 **Album ảnh** | Media group (tối đa 10 ảnh) | 10 ảnh/group |
| 🎥 **Video** | Upload trực tiếp hoặc link fallback | 50MB |
| 🔗 **Link** | Auto preview với thumbnail | Không giới hạn |
| 🎭 **GIF** | Gửi dưới dạng animation | 20MB |

### 🔵 Verification Badges
- **Blue Check** 🔵: Twitter Blue verified
- **Legacy Check** ✅: Old verification system
- **No badge**: Regular account

## 🔄 Database Schema

### TwitterUser Model
```javascript
{
  username: String,         // Username (@elonmusk)
  userId: String,           // Twitter user ID
  displayName: String,      // Display name (Elon Musk)
  profilePicture: String,   // Avatar URL
  followers: Number,        // Follower count
  following: Number,        // Following count
  statusesCount: Number,    // Tweet count
  isBlueVerified: Boolean,  // Twitter Blue verified
  isVerified: Boolean,      // Legacy verified
  description: String,      // Bio
  location: String,         // Location
  url: String,             // Website
  twitterCreatedAt: Date,   // Account creation date
  lastTweetId: String,      // Last processed tweet ID
  lastProfileUpdate: Date,  // Last profile sync
  isActive: Boolean         // Tracking status
}
```

### Tweet Model
```javascript
{
  tweetId: String,          // Twitter tweet ID
  userId: String,           // Twitter user ID
  username: String,         // Username
  displayName: String,      // Display name
  text: String,             // Tweet content
  createdAt: Date,          // Tweet creation time
  media: [{                 // Media attachments
    type: String,           // photo, video, animated_gif
    url: String,            // Media URL
    width: Number,
    height: Number
  }],
  retweetCount: Number,     // Retweet count
  likeCount: Number,        // Like count
  replyCount: Number,       // Reply count
  quoteCount: Number,       // Quote tweet count
  viewCount: Number,        // View count
  bookmarkCount: Number,    // Bookmark count
  isReply: Boolean,         // Is reply tweet
  lang: String,             // Language
  source: String,           // Tweet source
  isPostedToTelegram: Boolean,
  telegramMessageId: String
}
```

## 🚦 Deployment

### 🔄 PM2 (Production - Khuyến nghị)

```bash
# Cài đặt PM2 globally
npm install -g pm2

# Start bot với PM2
pm2 start src/index.js --name "twitter-bot"

# Auto start khi boot
pm2 startup

# Lưu cấu hình
pm2 save

# Các lệnh quản lý
pm2 list                    # Xem danh sách process
pm2 restart twitter-bot     # Restart bot
pm2 stop twitter-bot        # Dừng bot
pm2 logs twitter-bot        # Xem logs
pm2 monit                   # Monitor dashboard
```

### 🐳 Docker

```dockerfile
FROM node:18-alpine

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

# Start app
CMD ["npm", "start"]
```

```bash
# Build và chạy
docker build -t twitter-telegram-bot .
docker run -d \
  --name twitter-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  twitter-telegram-bot
```

## 🐛 Troubleshooting

### ❗ Lỗi thường gặp

| 🚨 Vấn đề | 🔍 Nguyên nhân | ✅ Giải pháp |
|-----------|----------------|--------------|
| Bot không nhận tin nhắn | Token sai hoặc chưa start chat | Check `TELEGRAM_BOT_TOKEN`, gửi `/start` |
| Không lấy được tweets | API key sai hoặc rate limit | Verify `TWITTER_API_KEY`, check rate limit |
| Kết nối MongoDB lỗi | Connection string sai | Check `MONGODB_URI`, đảm bảo DB chạy |
| User không có quyền admin | Chưa config admin IDs | Set `TELEGRAM_ADMIN_IDS` |
| Advanced Search lỗi | Query format sai | Check timestamp format |

### 🔧 Debug Commands

```bash
# Bật debug mode
NODE_ENV=development npm run dev

# Check logs
tail -f logs/combined.log

# Test commands
/admin    # Check permissions
/status   # Check connections
/check    # Test Twitter API
```

## ⚙️ Configuration

### Environment Variables

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `CHECK_INTERVAL_MINUTES` | `5` | Tần suất check tweets (phút) |
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `TELEGRAM_PROXY_URL` | - | Proxy cho Telegram (optional) |

### Thời gian kiểm tra

```bash
# Check mỗi 2 phút (real-time)
CHECK_INTERVAL_MINUTES=2

# Check mỗi 10 phút (tiết kiệm)
CHECK_INTERVAL_MINUTES=10
```

## 📋 Version History

### v2.1.0 - Cleanup & Optimization
**Ngày**: 2025-01-XX

#### ✨ Cải tiến:
- 🧹 **Code cleanup** - Loại bỏ optimization phức tạp
- 🔍 **Focus Advanced Search** - Tập trung vào core functionality
- 📱 **Simplified commands** - Commands dễ hiểu và sử dụng
- 🚀 **Better performance** - Ít complexity hơn, ổn định hơn

#### 🔧 Technical:
- Xóa cost tracking, baseline methods
- Đơn giản hóa tweetChecker scheduler
- Clean telegramService commands
- Tối ưu database queries

### v2.0.0 - News Format Enhancement
**Ngày**: 2025-06-18

#### ✨ Tính năng:
- 📰 Format tin tức chuyên nghiệp
- 🖼️ Hỗ trợ media trực tiếp
- 📊 Thống kê engagement đầy đủ
- 🧹 Auto clean text

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m "Add amazing feature"`
4. Push branch: `git push origin feature/amazing-feature`
5. Create Pull Request

## 📧 Support

| Hỗ trợ | Link | Mô tả |
|--------|------|-------|
| 🐛 **Issues** | [GitHub Issues](https://github.com/username/bot-tele-news/issues) | Bug reports, feature requests |
| 💬 **Discussions** | [GitHub Discussions](https://github.com/username/bot-tele-news/discussions) | Q&A, ideas |
| ⭐ **Star** | [GitHub Star](https://github.com/username/bot-tele-news) | Show support! |

## 📄 License

**MIT License** - Sử dụng tự do cho mọi mục đích.

---

<div align="center">

### 🌟 Nếu project hữu ích, hãy cho 1 star! ⭐

**Made with ❤️ by Vietnamese Developers**

</div>