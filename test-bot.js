require('dotenv').config();
const connectDB = require('./src/config/database');
const twitterService = require('./src/services/twitterService');
const logger = require('./utils/logger');

async function testBot() {
  try {
    console.log('🚀 Testing Bot with New Timezone Logic...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');
    
    // Test Vietnam time functions
    const vietnamNow = twitterService.getVietnamNow();
    const utcNow = new Date();
    
    console.log('\n⏰ Time Test:');
    console.log(`UTC Now: ${utcNow.toISOString()}`);
    console.log(`Vietnam Now: ${vietnamNow.toISOString()}`);
    
    // Test timezone conversion
    const testVietnamTime = vietnamNow;
    const convertedUTC = twitterService.convertVietnamToUTC(testVietnamTime);
    console.log(`\n🔄 Conversion Test:`);
    console.log(`Vietnam Time: ${testVietnamTime.toISOString()}`);
    console.log(`Converted to UTC: ${convertedUTC.toISOString()}`);
    
    // Test API formatting
    const formattedForAPI = twitterService.formatTimestampForAPI(convertedUTC);
    console.log(`Formatted for API: ${formattedForAPI}`);
    
    // Test checkNewTweets
    console.log('\n🔍 Testing checkNewTweets...');
    const newTweets = await twitterService.checkNewTweets();
    
    if (Array.isArray(newTweets)) {
      console.log(`✅ checkNewTweets completed: Found ${newTweets.length} new tweets`);
      
      if (newTweets.length > 0) {
        console.log('\n📝 New Tweets Found:');
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
      }
    } else {
      console.log('❌ checkNewTweets returned invalid data');
    }
    
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📋 Details:', error.stack);
    process.exit(1);
  }
}

testBot(); 