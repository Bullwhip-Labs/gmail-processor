# Stop the watch completely
node -e "
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'http://localhost:8080/callback'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

gmail.users.stop({ userId: 'me' }).then(() => {
  console.log('Watch stopped');
}).catch(err => {
  console.log('No watch to stop');
});
"

# Wait 10 seconds
sleep 10

# Create fresh watch
node scripts/setup-gmail-watch.js