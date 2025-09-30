'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, User, Building, Search, Ellipsis, Edit, Trash2, Archive, Flag, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

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
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

      let connections: Connection[] = [];
      if (response.data && typeof response.data === 'object' && 'connections' in response.data) {
        const data = response.data as { connections?: unknown };
        if (Array.isArray(data.connections)) {
          connections = data.connections as Connection[];
        }
      }
      setConnections(connections);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionClick = (connectionId: number) => {
    router.push(`/dashboard/connections/${connectionId}`);
  };

  const handleMenuAction = (action: string, connectionId: number) => {
    console.log(`${action} connection:`, connectionId);
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
    <div className="max-w-4xl mx-auto p-6 pt-[100px]">
      {/* Header */}
      <div className="flex-1 py-">
        <h1 className="text-4xl font-newsreader-500 text-primary">
          This is your network.
        </h1>
        <p className="mt-4 text-[15px] max-w-lg text-stone-500 pb-8">
          Your professional network database. Auto-populated from your sent emails with smart follow-up suggestions.
        </p>
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

      {/* Connections Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-6">
        {filteredConnections.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-primary">No connections found</h3>
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
              onClick={() => handleConnectionClick(connection.contact_id)}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group"
            >
               {/* top toolbar */}
               <div className="flex items-center justify-between">
                 {/* Checkbox for selecting this connection (for future bulk actions) */}
                 <input
                   type="checkbox"
                   className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity duration-200"
                   onClick={e => e.stopPropagation()}
                   aria-label={`Select connection for ${connection.first_name} ${connection.last_name}`}
                 />

               <ContextMenu>
                 <ContextMenuTrigger asChild>
                   <div
                     className="p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                     onClick={(e) => {
                       e.stopPropagation();
                       // Trigger context menu programmatically on left click
                       const event = new MouseEvent('contextmenu', {
                         bubbles: true,
                         cancelable: true,
                         clientX: e.clientX,
                         clientY: e.clientY,
                       });
                       e.currentTarget.dispatchEvent(event);
                     }}
                     aria-label="More options"
                   >
                     <Ellipsis className="h-5 w-5 text-gray-400" />
                   </div>
                 </ContextMenuTrigger>
                 <ContextMenuContent className="w-48 z-50">
                   <ContextMenuItem 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleConnectionClick(connection.contact_id);
                     }}
                     className="cursor-pointer"
                   >
                     <Edit className="mr-2 h-4 w-4" />
                     View Details
                   </ContextMenuItem>
                   <ContextMenuItem 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleMenuAction('Edit', connection.contact_id);
                     }}
                     className="cursor-pointer"
                   >
                     <Edit className="mr-2 h-4 w-4" />
                     Edit Connection
                   </ContextMenuItem>
                   <ContextMenuSeparator />
                   <ContextMenuItem 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleMenuAction('Archive', connection.contact_id);
                     }}
                     className="cursor-pointer"
                   >
                     <Archive className="mr-2 h-4 w-4" />
                     Archive
                   </ContextMenuItem>
                   <ContextMenuItem 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleMenuAction('Flag', connection.contact_id);
                     }}
                     className="cursor-pointer"
                   >
                     <Flag className="mr-2 h-4 w-4" />
                     Flag for Follow-up
                   </ContextMenuItem>
                   <ContextMenuSeparator />
                   <ContextMenuItem 
                     onClick={(e) => {
                       e.stopPropagation();
                       handleMenuAction('Delete', connection.contact_id);
                     }}
                     className="cursor-pointer text-red-600 focus:text-red-600"
                   >
                     <Trash2 className="mr-2 h-4 w-4" />
                     Delete
                   </ContextMenuItem>
                 </ContextMenuContent>
               </ContextMenu>
                
              </div>

              {/* Profile Image Placeholder */}
              <div className="w-16 h-16 bg-gray-200 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <User className="h-8 w-8 text-gray-400" />
              </div>


              {/* Name and Status */}
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-primary transition-colors">
                  {connection.first_name} {connection.last_name}
                </h3>
              </div>

              {/* Company and Role */}
              <div className="space-y-1 text-center">
                {connection.job_title && (
                  <p className="text-sm text-gray-600">
                    {connection.job_title}
                  </p>
                )}
                {connection.company && (
                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                    <span>{connection.company}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center my-4">
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusColors[connection.status]}`}>
                  {statusLabels[connection.status]}
                </span>
              </div>


            </div>
          ))
        )}
      </div>
    </div>
  );
}
