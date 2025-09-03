// scripts/get-gmail-token.js
// Obtains Gmail OAuth refresh token for Pub/Sub notification setup
// Reads configuration from .env.local file

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const destroyer = require('server-destroy');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

// Get configuration from environment
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Gmail scopes needed for watch and read
const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

// Check if credentials are configured
function checkCredentials() {
  const errors = [];
  
  if (!CLIENT_ID || CLIENT_ID === 'your-actual-client-id-here') {
    errors.push('GOOGLE_CLIENT_ID is not set properly in .env.local');
  }
  
  if (!CLIENT_SECRET || CLIENT_SECRET === 'your-actual-client-secret-here') {
    errors.push('GOOGLE_CLIENT_SECRET is not set properly in .env.local');
  }
  
  if (errors.length > 0) {
    console.error('\n❌ Configuration Error:\n');
    errors.forEach(error => console.error(`   • ${error}`));
    
    // Check if .env.local exists
    if (!fs.existsSync('.env.local')) {
      console.error('\n📝 Create a .env.local file with:');
      console.error('');
      console.error('GOOGLE_CLIENT_ID=your-client-id-here');
      console.error('GOOGLE_CLIENT_SECRET=your-client-secret-here');
      console.error('');
    } else {
      console.error('\n📝 Update your .env.local file with the actual values from Google Cloud Console');
    }
    
    process.exit(1);
  }
  
  console.log('✅ Credentials loaded from .env.local');
}

// Initialize OAuth2 client
function createOAuth2Client() {
  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'http://localhost:8080/callback'
  );
}

// Open URL in browser (cross-platform)
function openBrowser(url) {
  const start = (process.platform == 'darwin' ? 'open' : 
                 process.platform == 'win32' ? 'start' : 'xdg-open');
  
  exec(`${start} "${url}"`, (error) => {
    if (error) {
      console.log('\n⚠️  Could not open browser automatically.');
      console.log('Please manually open the URL above in your browser.\n');
    }
  });
}

async function getAuthToken() {
  const oauth2Client = createOAuth2Client();
  
  return new Promise((resolve, reject) => {
    // Generate authorization URL
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',  // Critical: ensures we get refresh token
      scope: scopes,
      prompt: 'consent'        // Forces consent screen to ensure refresh token
    });
    
    // Create local server to receive the OAuth callback
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/callback') > -1) {
          // Extract authorization code from callback URL
          const qs = new url.URL(req.url, 'http://localhost:8080').searchParams;
          const code = qs.get('code');
          
          // Send success page to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body {
                    font-family: -apple-system, system-ui, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  }
                  .container {
                    background: white;
                    padding: 3rem;
                    border-radius: 10px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 400px;
                  }
                  h1 { color: #10b981; margin: 0 0 1rem 0; }
                  p { color: #6b7280; margin: 0; }
                  .icon { font-size: 3rem; margin-bottom: 1rem; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">✅</div>
                  <h1>Authentication Successful!</h1>
                  <p>You can close this tab and return to your terminal to see your refresh token.</p>
                </div>
              </body>
            </html>
          `);
          
          // Clean up server
          server.destroy();
          
          // Exchange authorization code for tokens
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          
          // Display tokens
          console.log('\n' + '='.repeat(70));
          console.log('🎉 SUCCESS! Authentication complete');
          console.log('='.repeat(70));
          
          if (tokens.refresh_token) {
            console.log('\n🔑 Your Refresh Token:');
            console.log('\x1b[33m%s\x1b[0m', tokens.refresh_token);
            
            console.log('\n📝 Next Steps:');
            console.log('1. Add this refresh token to your .env.local file:');
            console.log('   GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
            console.log('\n2. Run the Gmail watch setup script:');
            console.log('   node scripts/setup-gmail-watch.js');
            
            // Update .env.local if it exists
            const envPath = '.env.local';
            if (fs.existsSync(envPath)) {
              let envContent = fs.readFileSync(envPath, 'utf8');
              
              // Check if GOOGLE_REFRESH_TOKEN exists
              if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
                // Replace existing token
                envContent = envContent.replace(
                  /GOOGLE_REFRESH_TOKEN=.*/g,
                  `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
                );
                fs.writeFileSync(envPath, envContent);
                console.log('\n✅ Updated existing GOOGLE_REFRESH_TOKEN in .env.local!');
              } else {
                // Append new token
                const newLine = envContent.endsWith('\n') ? '' : '\n';
                fs.appendFileSync(envPath, `${newLine}GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
                console.log('\n✅ Added GOOGLE_REFRESH_TOKEN to .env.local!');
              }
            }
          } else {
            console.log('\n⚠️  No refresh token received!');
            console.log('This might happen if you\'ve authorized before.');
            console.log('Try revoking access at: https://myaccount.google.com/permissions');
            console.log('Then run this script again.');
          }
          
          console.log('\n📋 Token Details:');
          console.log('• Scope:', tokens.scope);
          console.log('• Token Type:', tokens.token_type);
          console.log('• Access Token Expiry:', new Date(tokens.expiry_date).toLocaleString());
          
          console.log('\n' + '='.repeat(70) + '\n');
          
          resolve(oauth2Client);
        }
      } catch (error) {
        reject(error);
      }
    }).listen(8080, () => {
      // Server is ready, open browser for authentication
      console.log('\n🚀 OAuth server running on http://localhost:8080');
      console.log('📂 Opening browser for Google authentication...\n');
      console.log('If browser doesn\'t open automatically, visit:');
      console.log('\x1b[36m%s\x1b[0m\n', authorizeUrl);
      
      // Try to open browser
      openBrowser(authorizeUrl);
    });
    
    // Enable server destruction
    destroyer(server);
  });
}

// Main execution
console.log('🔐 Gmail OAuth2 Authentication');
console.log('=' .repeat(70));

// Check credentials first
checkCredentials();

// Run the authentication flow
getAuthToken()
  .then(() => {
    console.log('✅ Process complete! Check your .env.local file.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Authentication failed:', error.message);
    
    if (error.message.includes('invalid_client')) {
      console.log('\n💡 Check that your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local are correct');
    } else if (error.message.includes('redirect_uri_mismatch')) {
      console.log('\n💡 Make sure http://localhost:8080/callback is in your OAuth2 Authorized redirect URIs');
    }
    
    process.exit(1);
  });