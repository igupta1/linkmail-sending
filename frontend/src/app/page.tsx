'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginButton } from '@/components/LoginButton';
import { useAuth } from '@/hooks/useAuth';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">LinkMail</h1>
            </div>
            <LoginButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 text-black">
        <h1>[Placehodler]</h1>
      </main>
    </div>
  );
}
