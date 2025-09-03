// app/api/emails/route.ts
// API route to fetch stored emails for the dashboard
// Returns emails from Upstash Redis storage

import { NextRequest, NextResponse } from 'next/server';
import { emailStore } from '@/lib/email-store-kv';

// GET - Fetch all emails
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Fetch emails and stats from Redis (async operations)
    const [emails, stats] = await Promise.all([
      emailStore.getEmails(limit),
      emailStore.getStats()
    ]);
    
    return NextResponse.json({
      emails,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    return NextResponse.json({
      emails: [],
      stats: {
        totalEmails: 0,
        newestEmail: null,
        oldestEmail: null,
        lastReceived: null
      },
      error: 'Failed to fetch emails',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// DELETE - Clear email store
export async function DELETE() {
  try {
    const success = await emailStore.clear();
    
    return NextResponse.json({
      success,
      message: success ? 'Email store cleared' : 'Failed to clear store',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to clear emails:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to clear email store',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}