// Test script để kiểm tra timezone conversion
const dotenv = require('dotenv');
dotenv.config();

// Mock TwitterService methods để test timezone
class TestTimezone {
  // Helper function để convert thời gian Vietnam (UTC+7) sang UTC cho API
  convertVietnamToUTC(vietnamTime) {
    // Nếu input là Date object
    if (vietnamTime instanceof Date) {
      // Chuyển về UTC bằng cách trừ 7 giờ
      return new Date(vietnamTime.getTime() - 7 * 60 * 60 * 1000);
    }
    
    // Nếu input là timestamp
    if (typeof vietnamTime === 'number') {
      return new Date(vietnamTime - 7 * 60 * 60 * 1000);
    }
    
    // Fallback
    return vietnamTime;
  }

  // Helper function để lấy thời gian hiện tại theo Vietnam timezone
  getVietnamNow() {
    // Lấy thời gian hiện tại và cộng 7 giờ để có được Vietnam time
    const utcNow = new Date();
    const vietnamNow = new Date(utcNow.getTime() + 7 * 60 * 60 * 1000);
    return vietnamNow;
  }

  // Helper function để format timestamp cho TwitterAPI.io (luôn là UTC)
  formatTimestampForAPI(date) {
    // TwitterAPI.io expects UTC time in format: YYYY-MM-DD_HH:MM:SS_UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}_UTC`;
  }

  testTimezone() {
    console.log('🧪 Testing Timezone Conversion Logic\n');
    
    // Test 1: Current time
    const utcNow = new Date();
    const vietnamNow = this.getVietnamNow();
    
    console.log('📅 Current Time Test:');
    console.log(`UTC Now: ${utcNow.toISOString()}`);
    console.log(`Vietnam Now: ${vietnamNow.toISOString()}`);
    console.log(`Difference: ${(vietnamNow.getTime() - utcNow.getTime()) / (1000 * 60 * 60)} hours\n`);
    
    // Test 2: Convert Vietnam to UTC
    const vietnamToUTC = this.convertVietnamToUTC(vietnamNow);
    console.log('🔄 Vietnam to UTC Conversion:');
    console.log(`Vietnam Time: ${vietnamNow.toISOString()}`);
    console.log(`Converted to UTC: ${vietnamToUTC.toISOString()}`);
    console.log(`Should match UTC Now: ${utcNow.toISOString()}`);
    console.log(`Match: ${Math.abs(vietnamToUTC.getTime() - utcNow.getTime()) < 1000 ? '✅' : '❌'}\n`);
    
    // Test 3: API Format
    const apiFormat = this.formatTimestampForAPI(vietnamToUTC);
    console.log('🔗 API Format Test:');
    console.log(`UTC Time: ${vietnamToUTC.toISOString()}`);
    console.log(`API Format: ${apiFormat}\n`);
    
    // Test 4: 24 hours ago logic
    const vietnam24hAgo = new Date(vietnamNow.getTime() - 24 * 60 * 60 * 1000);
    const utc24hAgo = this.convertVietnamToUTC(vietnam24hAgo);
    const api24hFormat = this.formatTimestampForAPI(utc24hAgo);
    
    console.log('⏰ 24 Hours Ago Test:');
    console.log(`Vietnam 24h ago: ${vietnam24hAgo.toISOString()}`);
    console.log(`UTC 24h ago: ${utc24hAgo.toISOString()}`);
    console.log(`API Format: ${api24hFormat}\n`);
    
    // Test 5: Practical example
    console.log('🎯 Practical Example:');
    console.log('If it\'s 2:00 PM Vietnam time today:');
    const vietnamExample = new Date(vietnamNow);
    vietnamExample.setUTCHours(14, 0, 0, 0); // 2:00 PM Vietnam time
    
    const utcExample = this.convertVietnamToUTC(vietnamExample);
    const apiExample = this.formatTimestampForAPI(utcExample);
    
    console.log(`Vietnam 2:00 PM: ${vietnamExample.toISOString()}`);
    console.log(`UTC equivalent: ${utcExample.toISOString()}`);
    console.log(`API query format: ${apiExample}`);
    console.log(`Expected UTC time: 7:00 AM (2 PM - 7 hours = 7 AM UTC)\n`);
    
    console.log('✅ Timezone conversion test completed!');
  }
}

// Run test
const test = new TestTimezone();
test.testTimezone(); 