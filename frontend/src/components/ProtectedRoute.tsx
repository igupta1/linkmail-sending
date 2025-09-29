'use client';

import { useAuth } from '@/hooks/useAuth';
import { LoginButton } from './LoginButton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Welcome to LinkMail</h1>
          <p className="text-gray-600 mb-6">Please sign in to access your dashboard</p>
          {fallback || <LoginButton />}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
