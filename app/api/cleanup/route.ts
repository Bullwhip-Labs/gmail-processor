// app/api/cleanup/route.ts
// Cleanup endpoint to remove test emails from Redis
// Keeps only real emails

import { NextResponse } from 'next/server';
import { emailStore } from '@/lib/email-store-kv';

export async function POST() {
  try {
    // Get all emails
    const emails = await emailStore.getEmails(100);
    
    // Filter out test emails
    const testEmails = emails.filter(email => 
      email.id.startsWith('test-') || 
      email.from.includes('test@') ||
      email.subject.includes('[Test]')
    );
    
    // For now, since we can't selectively delete, just report
    // In production, you'd want to rebuild the list without test emails
    
    return NextResponse.json({
      success: true,
      totalEmails: emails.length,
      testEmails: testEmails.length,
      realEmails: emails.length - testEmails.length,
      message: `Found ${testEmails.length} test emails out of ${emails.length} total`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Clear all emails and start fresh
export async function DELETE() {
  try {
    await emailStore.clear();
    
    return NextResponse.json({
      success: true,
      message: 'All emails cleared from Redis',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}