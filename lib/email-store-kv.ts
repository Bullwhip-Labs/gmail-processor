// lib/email-store-kv.ts
// Email storage using Upstash Redis (via Vercel integration)
// Persists emails with generous free tier: 10,000 requests/day

import { Redis } from '@upstash/redis';

// Initialize Redis client with Vercel integration
// Using the KV_* environment variables from Upstash
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export interface StoredEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  receivedAt: string;
  historyId: string | number;
}

class UpstashEmailStore {
  private emailsKey = 'gmail:emails';
  private maxEmails = 100;
  
  async addEmail(email: StoredEmail) {
    try {
      // Add email to the beginning of the list (newest first)
      await redis.lpush(this.emailsKey, email);
      
      // Trim to keep only the latest emails
      await redis.ltrim(this.emailsKey, 0, this.maxEmails - 1);
      
      // Also store by ID for quick lookup
      await redis.set(`gmail:email:${email.id}`, email, {
        ex: 60 * 60 * 24 * 30 // Expire after 30 days
      });
      
      // Update stats
      await this.updateStats();
      
      console.log(`📧 Stored email in Redis: ${email.subject} from ${email.from}`);
      return true;
    } catch (error) {
      console.error('Failed to store email in Redis:', error);
      return false;
    }
  }
  
  async getEmails(limit: number = 50): Promise<StoredEmail[]> {
    try {
      // Get emails from the list (0 to limit-1)
      const emails = await redis.lrange<StoredEmail>(this.emailsKey, 0, limit - 1);
      return emails || [];
    } catch (error) {
      console.error('Failed to get emails from Redis:', error);
      return [];
    }
  }
  
  async getEmail(id: string): Promise<StoredEmail | null> {
    try {
      const email = await redis.get<StoredEmail>(`gmail:email:${id}`);
      return email;
    } catch (error) {
      console.error('Failed to get email from Redis:', error);
      return null;
    }
  }
  
  async getStats() {
    try {
      const [totalEmails, lastReceived] = await Promise.all([
        redis.llen(this.emailsKey),
        redis.get<string>('gmail:stats:lastReceived')
      ]);
      
      // Get first and last email dates
      const emails = await redis.lrange<StoredEmail>(this.emailsKey, 0, 0);
      const oldestEmails = await redis.lrange<StoredEmail>(this.emailsKey, -1, -1);
      
      return {
        totalEmails: totalEmails || 0,
        newestEmail: emails?.[0]?.date,
        oldestEmail: oldestEmails?.[0]?.date,
        lastReceived: lastReceived || null
      };
    } catch (error) {
      console.error('Failed to get stats from Redis:', error);
      return {
        totalEmails: 0,
        newestEmail: null,
        oldestEmail: null,
        lastReceived: null
      };
    }
  }
  
  private async updateStats() {
    await redis.set('gmail:stats:lastReceived', new Date().toISOString(), {
      ex: 60 * 60 * 24 * 30 // Expire after 30 days
    });
  }
  
  async clear() {
    try {
      // Get all email IDs to delete individual keys
      const emails = await redis.lrange<StoredEmail>(this.emailsKey, 0, -1);
      
      // Delete individual email keys
      if (emails && emails.length > 0) {
        const pipeline = redis.pipeline();
        emails.forEach(email => {
          pipeline.del(`gmail:email:${email.id}`);
        });
        await pipeline.exec();
      }
      
      // Delete the main list and stats
      await redis.del(this.emailsKey);
      await redis.del('gmail:stats:lastReceived');
      
      console.log('✅ Cleared all emails from Redis store');
      return true;
    } catch (error) {
      console.error('Failed to clear Redis store:', error);
      return false;
    }
  }
  
  // Test connection
  async testConnection() {
    try {
      // Use a simple set/get test instead of ping
      const testKey = 'test:connection';
      await redis.set(testKey, 'connected', { ex: 10 });
      const result = await redis.get(testKey);
      console.log('✅ Redis connection successful');
      return result === 'connected';
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailStore = new UpstashEmailStore();