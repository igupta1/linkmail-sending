'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Home, User, Mail, Users, FileText, PanelLeftClose, PanelLeftOpen, PanelLeft, LayoutDashboard, SquareUserRound, MessageSquare, CircleDotDashed } from 'lucide-react';
import { LoginButton } from './LoginButton';

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ expanded, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: Home },
    { name: 'Profile', href: '/dashboard/profile', icon: SquareUserRound },
    { name: 'Connections', href: '/dashboard/connections', icon: CircleDotDashed },
    { name: 'Templates', href: '/dashboard/templates', icon: FileText },
  ];

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <div className={`${expanded ? 'w-64 bg-foreground border border-border' : 'w-14 border border-transparent'} h-[calc(100dvh-1rem)] m-2 rounded-2xl transition-all duration-300 ease-in-out flex flex-col sticky top-2 z-50`}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3 border-gray-200">
        {expanded && (
          <div className="flex items-center space-x-4">
             <img 
                src="/logo.png" 
                alt="LinkMail" 
                className="h-7 w-auto"
              />
          </div>
        )}

        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-hover transition-colors cursor-pointer"
        >
          {expanded ? (
            <PanelLeftClose className="h-5 w-5 text-secondary" strokeWidth={1.25} />
          ) : (
            <PanelLeft className="h-5 w-5 text-secondary" strokeWidth={1.25} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1.5 pt-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <button
              key={item.name}
              onClick={() => handleNavigation(item.href)}
              className={`w-full flex items-center px-2 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
                isActive
                  ? 'bg-selection text-primary'
                  : 'text-secondary hover:bg-hover hover:text-primary'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0 text-secondary" strokeWidth={1.5} />
              {expanded && <span className="ml-3">{item.name}</span>}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-2">
        <LoginButton expanded={expanded} />
      </div>
    </div>
  );
}
