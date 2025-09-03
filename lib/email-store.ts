// lib/email-store.ts
// Simple in-memory email storage (replace with database in production)
// Stores emails received from Gmail notifications

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

class EmailStore {
  private emails: StoredEmail[] = [];
  private maxEmails = 100; // Keep last 100 emails in memory

  addEmail(email: StoredEmail) {
    // Add to beginning of array (newest first)
    this.emails.unshift(email);
    
    // Limit array size
    if (this.emails.length > this.maxEmails) {
      this.emails = this.emails.slice(0, this.maxEmails);
    }
    
    console.log(`📧 Stored email: ${email.subject} from ${email.from}`);
  }

  getEmails(limit: number = 50): StoredEmail[] {
    return this.emails.slice(0, limit);
  }

  getEmail(id: string): StoredEmail | undefined {
    return this.emails.find(e => e.id === id);
  }

  getStats() {
    return {
      totalEmails: this.emails.length,
      oldestEmail: this.emails[this.emails.length - 1]?.date,
      newestEmail: this.emails[0]?.date,
      lastReceived: this.emails[0]?.receivedAt
    };
  }

  clear() {
    this.emails = [];
  }
}

// Global singleton instance
// Note: This will reset when the serverless function cold starts
// For production, use a database like PostgreSQL, MongoDB, or Redis
export const emailStore = new EmailStore();