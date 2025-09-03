// app/api/test-redis/route.ts
// Test endpoint to verify Redis connection and functionality
// Visit /api/test-redis to check if storage is working

import { NextResponse } from 'next/server';
import { emailStore } from '@/lib/email-store-kv';

export async function GET() {
  try {
    console.log('Testing Redis connection...');
    console.log('KV_REST_API_URL exists:', !!process.env.KV_REST_API_URL);
    
    // Test connection
    const connected = await emailStore.testConnection();
    console.log('Connection test result:', connected);
    
    // Get current stats
    const stats = await emailStore.getStats();
    console.log('Stats retrieved:', stats);
    
    // Get emails
    const emails = await emailStore.getEmails(5);
    console.log('Emails retrieved:', emails.length);
    
    // DON'T add test emails anymore - just check connection
    
    return NextResponse.json({
      success: true,
      redis: {
        connected,
        url: process.env.KV_REST_API_URL ? 'configured' : 'missing',
        urlPrefix: process.env.KV_REST_API_URL?.substring(0, 30) // Show part of URL for debugging
      },
      stats,
      recentEmails: emails.length,
      emailsList: emails, // Show actual emails stored
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      env: {
        hasUrl: !!process.env.KV_REST_API_URL,
        hasToken: !!process.env.KV_REST_API_TOKEN
      }
    }, { status: 500 });
  }
}