'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getOAuthUrl } from '@/lib/api';
import { Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoginButtonProps {
  expanded?: boolean;
}

export function LoginButton({ expanded = false }: LoginButtonProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'right';
  }>({ vertical: 'top', horizontal: 'right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleLogin = () => {
    // Redirect to backend OAuth flow
    window.location.href = getOAuthUrl();
  };

  const calculateDropdownPosition = () => {
    if (!buttonRef.current) return;
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = 120; // Approximate height of the dropdown
    const dropdownWidth = 224; // w-56 = 224px
    
    // Calculate vertical position
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    let verticalPosition: 'top' | 'bottom';
    if (spaceAbove > spaceBelow && spaceBelow < dropdownHeight) {
      verticalPosition = 'top';
    } else if (spaceBelow >= dropdownHeight) {
      verticalPosition = 'bottom';
    } else {
      verticalPosition = 'top';
    }
    
    // Calculate horizontal position
    const spaceRight = viewportWidth - buttonRect.right;
    const spaceLeft = buttonRect.left;
    
    let horizontalPosition: 'left' | 'right';
    if (!expanded) {
      // When sidebar is collapsed, always show on the right side
      horizontalPosition = 'right';
    } else {
      // When sidebar is expanded, use smart positioning
      if (spaceRight >= dropdownWidth) {
        horizontalPosition = 'right';
      } else if (spaceLeft >= dropdownWidth) {
        horizontalPosition = 'left';
      } else {
        // If neither side has enough space, choose the side with more space
        horizontalPosition = spaceRight > spaceLeft ? 'right' : 'left';
      }
    }
    
    setDropdownPosition({
      vertical: verticalPosition,
      horizontal: horizontalPosition
    });
  };

  const handleDropdownToggle = () => {
    if (!isDropdownOpen) {
      calculateDropdownPosition();
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (isAuthenticated && user) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={handleDropdownToggle}
          className={`${expanded ? 'w-full' : 'w-auto'} cursor-pointer flex items-center text-sm rounded-lg  ${
            expanded 
              ? 'space-x-3 p-2 hover:bg-hover transition-colors' 
              : 'space-x-2 p-1 hover:bg-hover transition-colors'
          }`}
        >
          {user.picture ? (
            <img
              className="h-8 w-8 rounded-full"
              src={user.picture}
              alt={user.name}
            />
          ) : (
            <div className="h-8 w-8 rounded-sm bg-gray-300 dark:bg-white/15 flex items-center justify-center">
              <span className="text-gray-600 dark:text-white text-sm font-medium">
                {user.name?.charAt(0) || 'User'}
              </span>
            </div>
          )}
          {expanded && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-primary truncate">{user.name}</p>
              <p className="text-xs text-secondary truncate">Premium Plan</p>
            </div>
          )}
        </button>

        {isDropdownOpen && (
          <div className={`absolute w-60 bg-white/10 backdrop-blur-md rounded-md shadow-lg p-1 z-50 border border-border ${
            dropdownPosition.vertical === 'top' 
              ? 'bottom-full mb-2' 
              : 'top-full mt-2'
          } ${
            dropdownPosition.horizontal === 'right'
              ? (expanded ? 'right-0' : 'left-0')
              : 'left-0'
          }`}>
            <div className="px-2 py-1.5 border-b border-border mb-2">
              <p className="text-sm font-medium text-primary">{user.name}</p>
              <p className="text-sm text-secondary truncate">{user.email}</p>
            </div>
            <button
              onClick={() => {
                router.push('/dashboard/settings');
                setIsDropdownOpen(false);
              }}
              className="flex items-center w-full text-left px-2 py-1.5 text-sm rounded-lg text-secondary hover:bg-selection cursor-pointer transition-colors"
            >
              Settings
            </button>
            <button
              onClick={() => {
                logout();
                setIsDropdownOpen(false);
              }}
              className="block w-full text-left px-2 py-1.5 text-sm text-secondary rounded-lg hover:bg-selection cursor-pointer transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center px-6 py-2 bg-background text-primary font-medium border-border border rounded-lg hover:bg-hover cursor-pointer transition-colors shadow-md"
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png"
        alt="Google"
        className="inline-block w-4 h-4 mr-2 align-middle"
        style={{ verticalAlign: "middle" }}
      />
      Continue with Google
    </button>
  );
}
