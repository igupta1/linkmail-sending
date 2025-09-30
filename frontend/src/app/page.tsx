'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginButton } from '@/components/LoginButton';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const handleDashboardClick = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen">
      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-primary">LinkMail</h1>
            </div>
            
            <div className="flex items-center">
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
              ) : user ? (
                <button
                  onClick={handleDashboardClick}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Dashboard
                </button>
              ) : (
                <LoginButton expanded={true} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 text-black">
        <h1>[Placehodler]</h1>
      </main>
    </div>
  );
}
