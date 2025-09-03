// app/api/gmail/webhook/route.ts
// Complete Gmail webhook handler that fetches email content
// Processes real-time notifications and retrieves full email details

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { emailStore, type StoredEmail } from '@/lib/email-store-kv';

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: string | number;
}

interface EmailDetails {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
}

// Initialize Gmail client
function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:8080/callback'
  );
  
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Gmail message types
interface GmailMessage {
  id?: string | null;
  threadId?: string | null;
  payload?: {
    headers?: Array<{
      name: string;
      value: string;
    }>;
    body?: {
      data?: string | null;
    };
    parts?: Array<{
      mimeType: string;
      body?: {
        data?: string | null;
      };
    }>;
  };
  snippet?: string | null;
}

// Extract email details from Gmail message
function extractEmailDetails(message: GmailMessage): EmailDetails {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => 
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  // Extract body (handles both plain and multipart messages)
  let body = '';
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }
  
  return {
    id: message.id || '',
    threadId: message.threadId || '',
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: getHeader('To'),
    date: getHeader('Date'),
    snippet: message.snippet || '',
    body: body.substring(0, 1000) // Limit body length for logging
  };
}

// Fetch new emails using history ID or fallback to latest message
async function fetchNewEmails(historyId: string | number): Promise<EmailDetails[]> {
  const gmail = getGmailClient();
  const emails: EmailDetails[] = [];
  
  try {
    // Validate history ID is numeric
    const historyIdStr = String(historyId);
    if (!/^\d+$/.test(historyIdStr)) {
      console.log(`Invalid history ID format: ${historyId}`);
      return emails;
    }
    
    // Get history list since the historyId
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyIdStr,
      historyTypes: ['messageAdded']
    });
    
    if (!history.data.history || history.data.history.length === 0) {
      console.log('No new messages in history, fetching latest message instead');
      
      // Fallback: Get the most recent message
      const messageList = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1,
        labelIds: ['INBOX'],
        q: 'is:unread' // Get unread messages first
      });
      
      if (messageList.data.messages && messageList.data.messages.length > 0) {
        const messageId = messageList.data.messages[0].id;
        if (messageId) {
          console.log(`Fetching latest message: ${messageId}`);
          
          const message = await gmail.users.messages.get({
            userId: 'me',
            id: messageId
          });
          
          const emailDetails = extractEmailDetails(message.data as GmailMessage);
          emails.push(emailDetails);
          
          console.log('📧 Fetched Latest Email:');
          console.log('  Subject:', emailDetails.subject);
          console.log('  From:', emailDetails.from);
        }
      } else {
        console.log('No messages found in INBOX');
      }
      
      return emails;
    }
    
    // Process history records normally
    console.log(`Found ${history.data.history.length} history records`);
    for (const record of history.data.history) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          const messageId = added.message?.id;
          if (!messageId) continue;
          
          // Fetch full message details
          const message = await gmail.users.messages.get({
            userId: 'me',
            id: messageId
          });
          
          const emailDetails = extractEmailDetails(message.data as GmailMessage);
          emails.push(emailDetails);
          
          console.log('📧 New Email from History:');
          console.log('  Subject:', emailDetails.subject);
          console.log('  From:', emailDetails.from);
          console.log('  Date:', emailDetails.date);
          console.log('  Snippet:', emailDetails.snippet);
        }
      }
    }
    
    return emails;
    
  } catch (error) {
    console.error('Error fetching email details:', error);
    return emails;
  }
}

// POST handler for webhook
export async function POST(request: NextRequest) {
  try {
    const body: PubSubMessage = await request.json();
    
    console.log('📨 Received Pub/Sub notification');
    console.log('Subscription:', body.subscription);
    
    if (body.message?.data) {
      const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
      
      try {
        const notification: GmailNotification = JSON.parse(decodedData);
        
        console.log('📧 Gmail Notification:');
        console.log('  Email:', notification.emailAddress);
        console.log('  History ID:', notification.historyId);
        
        // Skip fetching if this is a test message
        if (String(notification.historyId).startsWith('test')) {
          console.log('⚠️ Test notification detected, skipping Gmail API fetch');
          
          // Store test notification as a placeholder
          const testEmail: StoredEmail = {
            id: `test-${Date.now()}`,
            threadId: 'test',
            subject: '[Test] Pub/Sub Notification Test',
            from: 'pubsub@test.com',
            to: notification.emailAddress,
            date: new Date().toISOString(),
            snippet: `Test notification with history ID: ${notification.historyId}`,
            body: 'This is a test notification from Pub/Sub. Real emails will show full content.',
            receivedAt: new Date().toISOString(),
            historyId: notification.historyId
          };
          await emailStore.addEmail(testEmail);
          
        } else {
          // Fetch actual email content for real notifications
          const newEmails = await fetchNewEmails(notification.historyId);
          
          if (newEmails.length > 0) {
            console.log(`\n✉️ Retrieved ${newEmails.length} new email(s)`);
            
            // Process each email
            for (const email of newEmails) {
              // Store email in KV store
              const storedEmail: StoredEmail = {
                ...email,
                receivedAt: new Date().toISOString(),
                historyId: notification.historyId
              };
              await emailStore.addEmail(storedEmail);
              
              console.log('\n--- Email Details ---');
              console.log('Subject:', email.subject);
              console.log('From:', email.from);
              console.log('Message ID:', email.id);
              
              // Check for specific keywords
              if (email.subject.toLowerCase().includes('urgent')) {
                console.log('⚠️ Urgent email detected!');
              }
            }
          } else {
            console.log('No new emails found - notification might be for non-INBOX changes');
          }
        }
        
      } catch (error) {
        console.log('Failed to parse notification:', decodedData, error);
      }
    }
    
    // Acknowledge message quickly
    return NextResponse.json({ status: 'ok' }, { status: 200 });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}

// GET handler for health check
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/gmail/webhook',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}