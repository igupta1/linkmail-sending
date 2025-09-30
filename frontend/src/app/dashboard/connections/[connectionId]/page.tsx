'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Mail, 
  Clock, 
  User, 
  Building, 
  MapPin, 
  ExternalLink, 
  Edit3, 
  ArrowLeft,
  Phone,
  Calendar,
  FileText,
  Send,
  ArrowDown,
  ChevronDown,
  Briefcase,
  MessageCircle,
  TextAlignJustify,
  AlignJustify
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  city: string | null;
  state: string | null;
  country: string | null;
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

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connectionId as string;
  
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [originalNotes, setOriginalNotes] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (connectionId) {
      fetchConnection();
    }
  }, [connectionId]);

  const fetchConnection = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getConnections();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch connections');
      }

      let connections: Connection[] = [];
      if (response.data && typeof response.data === 'object' && 'connections' in response.data) {
        const data = response.data as { connections?: unknown };
        if (Array.isArray(data.connections)) {
          connections = data.connections as Connection[];
        }
      }

      const foundConnection = connections.find(conn => conn.contact_id.toString() === connectionId);
      if (!foundConnection) {
        throw new Error('Connection not found');
      }

      setConnection(foundConnection);
      const connectionNotes = foundConnection.notes || '';
      setNotes(connectionNotes);
      setOriginalNotes(connectionNotes);
      setShowNotes(!!connectionNotes.trim());

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateConnectionStatus = async (status: string) => {
    if (!connection) return;

    try {
      const response = await apiClient.updateConnectionStatus(connection.contact_id, status);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update status');
      }

      setConnection(prev => prev ? { ...prev, status: status as Connection['status'] } : null);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const updateConnectionNotes = async () => {
    if (!connection) return;

    try {
      const response = await apiClient.updateConnectionNotes(connection.contact_id, notes);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update notes');
      }

      setConnection(prev => prev ? { ...prev, notes } : null);
      setOriginalNotes(notes);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Error updating notes:', err);
    }
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasUnsavedChanges(value !== originalNotes);
  };

  const handleAddNote = () => {
    setShowNotes(true);
  };

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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-[100px]">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !connection) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-[100px]">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Error: {error || 'Connection not found'}</p>
          <button 
            onClick={() => router.push('/dashboard/connections')}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Back to Connections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">

      <button
        onClick={() => router.push('/dashboard/connections')}
        className="px-2.5 py-1.5 hover:bg-gray-100 rounded-md transition-colors cursor-pointer flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4 text-gray-400" />
        <span className="text-gray-500 text-sm">Back</span>
      </button>

      {/* Header */}
      <div className="mb-8 mt-[50px]">
        
          <div className="w-24 h-24 bg-gray-200 rounded-xl flex items-center justify-center mb-8">
            <User className="h-8 w-8 text-gray-400" />
          </div>

          <div className="w-full flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-newsreader-500 text-primary">
                  {connection.first_name} {connection.last_name}
                </h1>
                <p className="text-gray-600 mt-1">
                  {connection.job_title && connection.company 
                    ? `${connection.job_title}`
                    : connection.job_title || connection.company || 'Professional Contact'
                  }
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!showNotes && (
                  <button
                    onClick={handleAddNote}
                    className="flex cursor-pointer items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-medium transition-colors"
                    type="button"
                  >
                    <TextAlignJustify className="h-4 w-4" />
                    Show Notes
                  </button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex cursor-pointer  items-center gap-2 px-4 py-2 text-sm font-medium rounded-full ${statusColors[connection.status]} hover:bg-opacity-90 transition-colors`}
                      aria-label="Change status"
                      type="button"
                    >
                      {statusLabels[connection.status]}
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <DropdownMenuItem
                        key={value}
                        onClick={() => updateConnectionStatus(value)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${statusColors[value as keyof typeof statusColors].replace('text-', 'bg-').replace('800', '500')}`} />
                          {label}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Notes */}
          {showNotes && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                  Notes
                </div>
                <button
                  onClick={() => setShowNotes(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm cursor-pointer"
                  title="Hide notes"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 h-fit">
                <textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Add notes about this connection..."
                  className="w-full min-h-[4rem] text-sm leading-5.5 focus:ring-0 resize-none focus:outline-0 focus:border-transparent text-neutral-600 overflow-hidden"
                  rows={1}
                  style={{ height: 'auto' }}
                  ref={el => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }
                  }}
                  onInput={e => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                    handleNotesChange(target.value);
                  }}
                />
                {hasUnsavedChanges && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setNotes(originalNotes);
                        setHasUnsavedChanges(false);
                      }}
                      className="px-3 py-1 bg-neutral-100 text-neutral-600 text-sm rounded-sm hover:bg-neutral-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateConnectionNotes}
                      className="px-3 py-1 bg-neutral-800 text-white text-sm rounded-sm hover:bg-neutral-700 cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          

          {/* Messages */}
          <div>

            {connection.messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No messages yet</p>
            ) : (
              <div className="space-y-4">
                {connection.messages.map((message) => (
                  <div key={message.id} className="bg-white border border-gray-200 rounded-lg p-6">

                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                        message.direction === 'sent' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {message.direction === 'sent' ? 'Sent in Gmail' : 'Received'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDateTime(message.sent_at)}
                      </span>
                    </div>

                    <h4 className="font-newsreader-600 font-medium text-primary mb-2">{message.subject}</h4>

                    <div className="text-gray-700 font-newsreader-400 leading-relaxed whitespace-pre-wrap">
                      {message.body}
                    </div>

                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600 mb-2">Attachments:</p>
                        <div className="space-y-1">
                          {message.attachments.map((attachment, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                              <FileText className="h-4 w-4" />
                              <span>{attachment.name}</span>
                              <span className="text-gray-400">({Math.round(attachment.size / 1024)}KB)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Profile Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start gap-6">
              {/* Profile Image Placeholder */}


              <div className="flex-1">
                

                <div className="space-y-3">

                  
                  {connection.company && (
                    <div className="flex items-center text-sm gap-2 text-gray-700">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      <span>{connection.company}</span>
                    </div>
                  )}

                  {connection.primary_email && (
                    <div className="flex items-center text-sm gap-2 text-gray-700">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{connection.primary_email}</span>
                    </div>
                  )}

                  {(connection.city || connection.state || connection.country) && (
                    <div className="flex items-center text-sm gap-2 text-gray-700">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>
                        {[connection.city, connection.state, connection.country]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}

                  {connection.linkedin_url && (
                    <div className="flex items-center text-sm gap-2 text-gray-700">
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                      <a
                        href={connection.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Connection Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Created {formatDate(connection.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Updated {formatDate(connection.updated_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MessageSquare className="h-4 w-4" />
                <span>{connection.messages.length} message{connection.messages.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
