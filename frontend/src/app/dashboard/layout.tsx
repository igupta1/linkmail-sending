'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar 
        expanded={sidebarExpanded} 
        onToggle={() => setSidebarExpanded(!sidebarExpanded)} 
      />

      {/* Main Content Container */}
      <div className="flex-1 relative pb-32">
        <main className="overflow-auto h-full">
          {children}
        </main>
        
        <div className="sticky bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none z-10 -mb-32" />
      </div>
    </div>
  );
}
