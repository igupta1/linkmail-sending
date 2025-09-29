'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  verifyToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Initialize auth state from localStorage and URL params
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for token in URL params (from OAuth callback)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        
        if (urlToken) {
          // Store token and clear URL
          localStorage.setItem('linkmail_token', urlToken);
          window.history.replaceState({}, document.title, window.location.pathname);
          await login(urlToken);
          return;
        }

        // Check for stored token
        const storedToken = localStorage.getItem('linkmail_token');
        if (storedToken) {
          await login(storedToken);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (newToken: string) => {
    try {
      setToken(newToken);
      
      // Verify token with backend
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('linkmail_token', newToken);
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.error('Login failed:', error);
      logout();
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('linkmail_token');
    
    // Call backend logout endpoint
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(console.error);
    }
  };

  const verifyToken = async (): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return true;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        logout,
        verifyToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
