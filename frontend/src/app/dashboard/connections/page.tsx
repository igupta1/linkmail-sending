'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Mail, Clock, User, Building, MapPin, ExternalLink, Edit3, MoreVertical, Filter, Search } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Message {
  id: string;
  direction: 'sent' | 'received';
  subject: string;
  body: string;
  sent_at: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  is_follow_up: boolean;
  attachments?: Array<{ name: string; size: number; type: string }>;
}

interface Connection {
  user_id: string;
  contact_id: number;
  subject: string;
  status: 'active' | 'closed' | 'follow_up_needed' | 'responded' | 'meeting_scheduled' | 'converted';
  notes: string | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  company: string | null;
  linkedin_url: string | null;
  primary_email: string | null;
}

const statusColors = {
  active: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
  follow_up_needed: 'bg-yellow-100 text-yellow-800',
  responded: 'bg-green-100 text-green-800',
  meeting_scheduled: 'bg-purple-100 text-purple-800',
  converted: 'bg-emerald-100 text-emerald-800',
};

const statusLabels = {
  active: 'Active',
  closed: 'Closed',
  follow_up_needed: 'Follow Up Needed',
  responded: 'Responded',
  meeting_scheduled: 'Meeting Scheduled',
  converted: 'Converted',
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNotes, setShowNotes] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getConnections();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch connections');
      }
      
      setConnections(response.data.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateConnectionStatus = async (contactId: number, status: string) => {
    try {
      const response = await apiClient.updateConnectionStatus(contactId, status);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update status');
      }

      // Update local state
      setConnections(prev => 
        prev.map(conn => 
          conn.contact_id === contactId 
            ? { ...conn, status: status as Connection['status'] }
            : conn
        )
      );
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const updateConnectionNotes = async (contactId: number) => {
    try {
      const response = await apiClient.updateConnectionNotes(contactId, notes);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update notes');
      }

      // Update local state
      setConnections(prev => 
        prev.map(conn => 
          conn.contact_id === contactId 
            ? { ...conn, notes }
            : conn
        )
      );
      
      setShowNotes(null);
      setNotes('');
    } catch (err) {
      console.error('Error updating notes:', err);
    }
  };

  const filteredConnections = connections.filter(conn => {
    const matchesSearch = searchQuery === '' || 
      `${conn.first_name} ${conn.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.primary_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || conn.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Error: {error}</p>
          <button 
            onClick={fetchConnections}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
          <p className="text-gray-600">Manage your email conversations and relationships</p>
        </div>
        <div className="text-sm text-gray-500">
          {filteredConnections.length} connection{filteredConnections.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Connections List */}
      <div className="space-y-4">
        {filteredConnections.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No connections found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Start by sending your first email to create a connection.'
              }
            </p>
          </div>
        ) : (
          filteredConnections.map((connection) => (
            <div
              key={`${connection.user_id}_${connection.contact_id}`}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {connection.first_name} {connection.last_name}
                      </h3>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[connection.status]}`}>
                      {statusLabels[connection.status]}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    {connection.job_title && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{connection.job_title}</span>
                      </div>
                    )}
                    {connection.company && (
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        <span>{connection.company}</span>
                      </div>
                    )}
                    {connection.primary_email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span>{connection.primary_email}</span>
                      </div>
                    )}
                  </div>

                  {connection.subject && (
                    <p className="text-sm text-gray-700 mb-3">
                      <strong>Subject:</strong> {connection.subject}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Last updated {formatDate(connection.updated_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{connection.messages.length} message{connection.messages.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {connection.notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-700">
                        <strong>Notes:</strong> {connection.notes}
                      </p>
                    </div>
                  )}

                  {showNotes === connection.contact_id && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-md">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this connection..."
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => updateConnectionNotes(connection.contact_id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowNotes(null);
                            setNotes('');
                          }}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={connection.status}
                    onChange={(e) => updateConnectionStatus(connection.contact_id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      setShowNotes(connection.contact_id);
                      setNotes(connection.notes || '');
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Add notes"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>

                  {connection.linkedin_url && (
                    <a
                      href={connection.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="View LinkedIn profile"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Recent Messages Preview */}
              {connection.messages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Messages</h4>
                  <div className="space-y-2">
                    {connection.messages.slice(-2).map((message) => (
                      <div key={message.id} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            message.direction === 'sent' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {message.direction === 'sent' ? 'Sent' : 'Received'}
                          </span>
                          <span className="text-gray-500">
                            {formatDate(message.sent_at)} at {formatTime(message.sent_at)}
                          </span>
                        </div>
                        <p className="text-gray-700 line-clamp-2">
                          <strong>{message.subject}</strong> - {message.body.substring(0, 100)}...
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
