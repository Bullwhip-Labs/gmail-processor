// scripts/setup-gmail-watch.js
// Sets up Gmail push notifications via Google Pub/Sub
// Reads all configuration from .env.local file

const { google } = require('googleapis');
const fs = require('fs');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Configuration from environment
const CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  projectId: process.env.GCP_PROJECT_ID,
  topicName: process.env.PUBSUB_TOPIC_NAME || 'gmail-notifications'
};

// Check configuration completeness
function checkConfig() {
  console.log('🔍 Checking configuration...\n');
  
  const missing = [];
  const configured = [];
  
  // Check each required config
  const checks = [
    { key: 'clientId', name: 'GOOGLE_CLIENT_ID', value: CONFIG.clientId },
    { key: 'clientSecret', name: 'GOOGLE_CLIENT_SECRET', value: CONFIG.clientSecret },
    { key: 'refreshToken', name: 'GOOGLE_REFRESH_TOKEN', value: CONFIG.refreshToken },
    { key: 'projectId', name: 'GCP_PROJECT_ID', value: CONFIG.projectId }
  ];
  
  checks.forEach(check => {
    if (!check.value || check.value.includes('your-')) {
      missing.push(check.name);
    } else {
      configured.push(check.name);
    }
  });
  
  // Show configured values (partially hidden for security)
  if (configured.length > 0) {
    console.log('✅ Configured:');
    configured.forEach(name => {
      const value = process.env[name];
      let displayValue = value;
      
      // Partially hide sensitive values
      if (name.includes('SECRET') || name.includes('TOKEN')) {
        displayValue = value.substring(0, 10) + '...' + value.substring(value.length - 4);
      } else if (name === 'GOOGLE_CLIENT_ID') {
        displayValue = value.substring(0, 15) + '...';
      }
      
      console.log(`   • ${name}: ${displayValue}`);
    });
    console.log('');
  }
  
  // Show missing values
  if (missing.length > 0) {
    console.error('❌ Missing configuration:');
    missing.forEach(name => {
      console.error(`   • ${name}`);
    });
    
    console.log('\n📝 Please add these to your .env.local file:');
    
    if (!fs.existsSync('.env.local')) {
      console.log('\n   First create .env.local file, then add:');
    }
    
    missing.forEach(name => {
      if (name === 'GOOGLE_REFRESH_TOKEN') {
        console.log(`   ${name}=<run 'node scripts/get-gmail-token.js' to get this>`);
      } else if (name === 'GCP_PROJECT_ID') {
        console.log(`   ${name}=<your Google Cloud project ID>`);
      } else {
        console.log(`   ${name}=<get from Google Cloud Console>`);
      }
    });
    
    console.log('');
    process.exit(1);
  }
  
  console.log('📋 Using configuration:');
  console.log(`   • Project: ${CONFIG.projectId}`);
  console.log(`   • Topic: ${CONFIG.topicName}`);
  console.log('');
}

// Create OAuth2 client with refresh token
function createAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    CONFIG.clientId,
    CONFIG.clientSecret,
    'http://localhost:8080/callback'
  );
  
  oauth2Client.setCredentials({
    refresh_token: CONFIG.refreshToken
  });
  
  return oauth2Client;
}

// Main function to setup Gmail watch
async function setupGmailWatch() {
  console.log('🔧 Setting up Gmail watch...\n');
  
  // Initialize OAuth2 client
  const auth = createAuthClient();
  
  // Initialize Gmail API client
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    // First, verify authentication by getting profile
    console.log('📧 Verifying Gmail access...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✅ Authenticated as: ${profile.data.emailAddress}`);
    console.log(`   • Total messages: ${profile.data.messagesTotal}`);
    console.log(`   • Total threads: ${profile.data.threadsTotal}\n`);
    
    // Stop any existing watch
    try {
      console.log('🛑 Stopping any existing watch...');
      await gmail.users.stop({ userId: 'me' });
      console.log('   • Existing watch stopped\n');
    } catch (error) {
      console.log('   • No existing watch to stop\n');
    }
    
    // Create new watch
    console.log('⏰ Creating new watch on INBOX...');
    
    const topicPath = `projects/${CONFIG.projectId}/topics/${CONFIG.topicName}`;
    console.log(`   • Topic: ${topicPath}`);
    
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: topicPath,
        labelIds: ['INBOX'],           // Watch only INBOX
        labelFilterAction: 'include'   // Include only these labels
      }
    });
    
    // Calculate expiration details
    const expirationMs = parseInt(watchResponse.data.expiration);
    const expirationDate = new Date(expirationMs);
    const hoursUntilExpiry = Math.floor((expirationMs - Date.now()) / (1000 * 60 * 60));
    const daysUntilExpiry = Math.floor(hoursUntilExpiry / 24);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Gmail watch successfully configured!');
    console.log('='.repeat(70));
    
    console.log('\n📋 Watch Details:');
    console.log(`   • Email: ${profile.data.emailAddress}`);
    console.log(`   • History ID: ${watchResponse.data.historyId}`);
    console.log(`   • Expires: ${expirationDate.toLocaleString()}`);
    console.log(`   • Time until expiry: ${daysUntilExpiry} days, ${hoursUntilExpiry % 24} hours`);
    
    console.log('\n⚠️  Important Notes:');
    console.log('   1. This watch expires in ~7 days - set up auto-renewal');
    console.log('   2. Gmail will send notifications to your Pub/Sub topic');
    console.log('   3. Create a push subscription to receive notifications');
    
    console.log('\n🧪 Test Your Setup:');
    console.log(`   1. Send a test email to ${profile.data.emailAddress}`);
    console.log('   2. Check Pub/Sub metrics in Google Cloud Console');
    console.log('   3. Monitor your webhook endpoint for notifications');
    
    console.log('\n📊 Monitor in Google Cloud Console:');
    console.log(`   https://console.cloud.google.com/cloudpubsub/subscription/detail/${CONFIG.topicName}?project=${CONFIG.projectId}`);
    
    return watchResponse.data;
    
  } catch (error) {
    console.error('\n❌ Failed to set up Gmail watch:', error.message);
    
    // Provide helpful error messages based on the error
    if (error.message.includes('invalid_grant')) {
      console.log('\n💡 Your refresh token is invalid or expired.');
      console.log('   Fix: Run `node scripts/get-gmail-token.js` to get a new token');
      
    } else if (error.message.includes('Unauthorized')) {
      console.log('\n💡 Authentication failed. Possible issues:');
      console.log('   • Refresh token is invalid');
      console.log('   • OAuth scopes don\'t include gmail.readonly');
      console.log('   Fix: Run `node scripts/get-gmail-token.js` again');
      
    } else if (error.message.includes('Cloud Pub/Sub API has not been used')) {
      console.log('\n💡 Pub/Sub API is not enabled in your project.');
      console.log('   Fix: Enable it at:');
      console.log(`   https://console.cloud.google.com/apis/library/pubsub.googleapis.com?project=${CONFIG.projectId}`);
      
    } else if (error.message.includes('Permission denied') || error.message.includes('not authorized')) {
      console.log('\n💡 Pub/Sub permission issue. Check that:');
      console.log('   1. Your topic exists: ' + CONFIG.topicName);
      console.log('   2. gmail-api-push@system.gserviceaccount.com has Pub/Sub Publisher role');
      console.log('   3. Your project ID is correct: ' + CONFIG.projectId);
      
    } else if (error.message.includes('topicName')) {
      console.log('\n💡 Topic configuration issue.');
      console.log(`   • Expected topic: projects/${CONFIG.projectId}/topics/${CONFIG.topicName}`);
      console.log('   • Make sure the topic exists in your project');
      
    } else {
      console.log('\n💡 Check the error details above and verify:');
      console.log('   • All .env.local values are correct');
      console.log('   • Pub/Sub topic exists and has correct permissions');
      console.log('   • Gmail API is enabled in your project');
    }
    
    throw error;
  }
}

// Function to stop watch (cleanup)
async function stopGmailWatch() {
  const auth = createAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  
  try {
    await gmail.users.stop({ userId: 'me' });
    console.log('✅ Gmail watch stopped successfully');
  } catch (error) {
    if (error.message.includes('No watch')) {
      console.log('ℹ️  No active watch to stop');
    } else {
      console.error('❌ Error stopping watch:', error.message);
    }
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  console.log('\n🔔 Gmail Push Notifications Setup');
  console.log('=' .repeat(70) + '\n');
  
  // Always check config first
  checkConfig();
  
  try {
    if (command === 'stop') {
      await stopGmailWatch();
    } else if (command === 'check') {
      // Just verify current status
      const auth = createAuthClient();
      const gmail = google.gmail({ version: 'v1', auth });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('✅ Gmail API accessible');
      console.log(`   • Email: ${profile.data.emailAddress}`);
      console.log('\nRun without arguments to set up watch');
    } else {
      await setupGmailWatch();
    }
    
    console.log('\n✨ Done!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n🔥 Process failed. See details above.\n');
    process.exit(1);
  }
}

// Run the main function
main();