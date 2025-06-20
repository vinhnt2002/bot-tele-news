require('dotenv').config();
const connectDB = require('./src/config/database');
const TwitterUser = require('./src/models/TwitterUser');
const twitterService = require('./src/services/twitterService');

async function resetAndTest() {
  try {
    console.log('🔄 Resetting lastCheckTime for test...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');
    
    // Get current time in Vietnam
    const vietnamNow = twitterService.getVietnamNow();
    console.log(`Vietnam Now: ${vietnamNow.toISOString()}`);
    
    // Reset lastCheckTime to 10 minutes ago to catch recent tweets
    const tenMinutesAgo = new Date(vietnamNow.getTime() - 10 * 60 * 1000);
    
    const user = await TwitterUser.findOne({ username: 'vinhngu81180981' });
    if (user) {
      console.log(`\nUser found: ${user.username}`);
      console.log(`Current lastCheckTime: ${user.lastCheckTime?.toISOString() || 'null'}`);
      
      // Reset to 10 minutes ago
      user.lastCheckTime = tenMinutesAgo;
      await user.save();
      
      console.log(`Reset lastCheckTime to: ${tenMinutesAgo.toISOString()}`);
      
      // Now test again
      console.log('\n🔍 Testing checkNewTweets again...');
      const newTweets = await twitterService.checkNewTweets();
      
      if (Array.isArray(newTweets) && newTweets.length > 0) {
        console.log(`\n🎉 Found ${newTweets.length} tweets!`);
        newTweets.forEach((tweet, index) => {
          const tweetTime = new Date(tweet.createdAt);
          const vietnamTweetTime = new Date(tweetTime.getTime() + 7 * 60 * 60 * 1000);
          const minutesAgo = Math.floor((vietnamNow.getTime() - vietnamTweetTime.getTime()) / (1000 * 60));
          
          console.log(`${index + 1}. "${tweet.text}" by @${tweet.username}`);
          console.log(`   Created: ${tweetTime.toISOString()} UTC`);
          console.log(`   Vietnam Time: ${vietnamTweetTime.toISOString()}`);
          console.log(`   ${minutesAgo} minutes ago`);
          console.log('');
        });
      } else {
        console.log('📭 No new tweets found');
      }
    } else {
      console.log('❌ User not found');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAndTest(); 