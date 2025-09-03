// app/dashboard/page.tsx
// Modern two-pane email dashboard with search and dark aesthetic
// Features: searchable, two-pane layout, modern design

'use client';

import { useState, useEffect, useMemo } from 'react';

interface Email {
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

interface EmailStats {
  totalEmails: number;
  oldestEmail?: string;
  newestEmail?: string;
  lastReceived?: string;
}

export default function Dashboard() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<EmailStats>({ totalEmails: 0 });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch emails from API
  const fetchEmails = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/emails?limit=100');
      const data = await response.json();
      setEmails(data.emails);
      setStats(data.stats);
      setLoading(false);
      
      // Auto-select first email if none selected
      if (!selectedEmail && data.emails.length > 0) {
        setSelectedEmail(data.emails[0]);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      setLoading(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchEmails();
    
    if (autoRefresh) {
      const interval = setInterval(fetchEmails, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Filter emails based on search
  const filteredEmails = useMemo(() => {
    if (!searchQuery) return emails;
    
    const query = searchQuery.toLowerCase();
    return emails.filter(email => 
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.snippet.toLowerCase().includes(query) ||
      (email.body && email.body.toLowerCase().includes(query))
    );
  }, [emails, searchQuery]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Extract sender name and email
  const parseSender = (from: string) => {
    const match = from.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
    if (match) {
      return {
        name: match[1].trim() || match[2].split('@')[0],
        email: match[2].trim()
      };
    }
    return {
      name: from.split('@')[0],
      email: from
    };
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">
          <div className="animate-pulse flex space-x-2">
            <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Inbox</h1>
            <span className="text-sm text-gray-500">
              {stats.totalEmails} {stats.totalEmails === 1 ? 'email' : 'emails'}
            </span>
            {isRefreshing && (
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Controls */}
            <button
              onClick={fetchEmails}
              disabled={isRefreshing}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm transition"
            >
              Refresh
            </button>
            
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-600">Auto-refresh</span>
            </label>
          </div>
        </div>
      </header>

      {/* Main Content - Two Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Email List - Left Pane */}
        <div className="w-96 border-r border-gray-200 bg-gray-50 flex flex-col">
          {/* List Header */}
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              {filteredEmails.length} {searchQuery ? 'results' : 'conversations'}
            </div>
          </div>
          
          {/* Email List */}
          <div className="flex-1 overflow-y-auto bg-white">
            {filteredEmails.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                {searchQuery ? 'No emails match your search' : 'No emails yet'}
              </div>
            ) : (
              filteredEmails.map((email) => {
                const sender = parseSender(email.from);
                const isSelected = selectedEmail?.id === email.id;
                
                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition ${
                      isSelected 
                        ? 'bg-blue-50 border-l-2 border-l-blue-500' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                        {getInitials(sender.name)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between">
                          <span className="font-medium text-sm text-gray-900 truncate pr-2">
                            {sender.name}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatDate(email.receivedAt)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 font-medium truncate mt-0.5">
                          {email.subject || '(No subject)'}
                        </div>
                        <div className="text-xs text-gray-600 truncate mt-1">
                          {email.snippet}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Email Content - Right Pane */}
        <div className="flex-1 bg-white flex flex-col">
          {selectedEmail ? (
            <>
              {/* Email Header */}
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h2 className="text-xl font-semibold mb-3 text-gray-900">
                  {selectedEmail.subject || '(No subject)'}
                </h2>
                
                <div className="flex items-start space-x-4">
                  {/* Sender Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                    {getInitials(parseSender(selectedEmail.from).name)}
                  </div>
                  
                  {/* Sender Info */}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{parseSender(selectedEmail.from).name}</div>
                    <div className="text-sm text-gray-600">{parseSender(selectedEmail.from).email}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      to {selectedEmail.to} • {new Date(selectedEmail.date).toLocaleString()}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex space-x-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Email Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-3xl">
                  <div className="prose prose-gray max-w-none">
                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {selectedEmail.body || selectedEmail.snippet}
                    </div>
                  </div>
                </div>
                
                {/* Metadata */}
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Message ID: {selectedEmail.id}</div>
                    <div>Thread ID: {selectedEmail.threadId}</div>
                    <div>History ID: {selectedEmail.historyId}</div>
                    <div>Received: {new Date(selectedEmail.receivedAt).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p>Select an email to read</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            Last sync: {stats.lastReceived ? formatDate(stats.lastReceived) : 'Never'}
          </div>
          <div className="flex items-center space-x-4">
            <span>{filteredEmails.length} emails</span>
            {autoRefresh && (
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>Live</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}