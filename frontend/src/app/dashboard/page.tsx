'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRouter } from 'next/navigation';
import { LoginButton } from '@/components/LoginButton';
import { ProfileSetup } from '@/components/ProfileSetup';

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { profile, isLoading: profileLoading, getProfileSetupStatus } = useUserProfile();
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a token in the URL (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token && !isLoading) {
      // Show success message briefly, then stay on dashboard
      setShowSuccess(true);
      
      // Clear the token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } else if (!isLoading && !isAuthenticated) {
      // No token and not authenticated, redirect to home
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-50">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-900 mb-2">Sign In Successful!</h1>
          <p className="text-green-700 mb-4">Welcome back, {user?.name || 'User'}!</p>
          <p className="text-sm text-green-600">Setting up your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-6 mt-[100px]">


          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-newsreader-500 text-gray-900">
               Welcome, {user?.name?.split(' ')[0] || 'there'}.
            </h1>
          </div>

          {/* Profile Setup Alert */}
          {(!profile || !getProfileSetupStatus().isSetupComplete) && (
            <div className="relative bg-gradient-to-br from-blue-50 via-indigo-100 to-violet-100 border border-blue-100 rounded-xl p-4 mb-6 overflow-hidden group transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="ml-3 flex-1">
                  <div className="mt-2 text-sm max-w-lg text-slate-800">
                    <p>Linkmail crafts the best email when you provide context on your goals and professional background. Please provide us some of your details to get started.</p>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => router.push('/dashboard/profile')}
                      className="bg-white/65 hover:bg-white/45 cursor-pointer text-black/65 px-2 pl-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 group/button relative overflow-hidden"
                    >
                      <div className="relative z-10 flex items-center w-[100px]">
                        <div className="translate-x-2 group-hover/button:translate-x-0 w-fit line-clamp-1 transition-all duration-300 transform">
                          Edit Profile
                        </div>
                        <svg 
                          className="w-4 h-4 ml-2 left-full transition-all duration-300 transform -translate-x-2 opacity-0 group-hover/button:translate-x-0 group-hover/button:opacity-100" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-[100px] h-[100px] rounded-xl bg-white/75 from-blue-200/30 to-indigo-300/40 border border-white/20 shadow-lg group-hover:rotate-12 group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300 ease-out">
                    <div className="w-full h-full flex items-center justify-center text-blue-600 font-bold text-lg">
                      {getProfileSetupStatus().setupPercentage}%
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating card that appears on hover */}
              <div className="absolute -bottom-6 -right-2 w-20 h-20 bg-white rounded-lg border border-gray-200/50 shadow-lg opacity-0 group-hover:opacity-100 group-hover:rotate-6 group-hover:-translate-y-1 transition-all duration-300 ease-out transform-gpu">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-xs text-blue-700 font-medium text-center">
                    <div className="w-6 h-6 mx-auto mb-1 flex items-center justify-center">
                      <span className="text-xl">👫</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* User Profile Section */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Your Profile
              </h3>
              
              <div className="flex items-start space-x-4">
                {user?.picture && (
                  <img
                    className="h-16 w-16 rounded-full"
                    src={user.picture}
                    alt={user.name}
                  />
                )}
                <div className="flex-1">
                  <h4 className="text-lg font-medium text-gray-900">
                    {profile?.first_name && profile?.last_name 
                      ? `${profile.first_name} ${profile.last_name}`
                      : user?.name
                    }
                  </h4>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                  
                  {profile?.linkedin_url && (
                    <p className="text-sm text-blue-600 mt-1">
                      <a 
                        href={profile.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        LinkedIn Profile
                      </a>
                    </p>
                  )}
                  
                  {profile?.skills && profile.skills.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Skills:</p>
                      <div className="flex flex-wrap gap-1">
                        {profile.skills.slice(0, 5).map((skill, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {skill}
                          </span>
                        ))}
                        {profile.skills.length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{profile.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-400 mt-2">User ID: {user?.id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Quick Stats */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Emails Sent
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        0
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Contacts
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {profile?.contacted_linkedins?.length || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Templates
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {profile?.templates?.length || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Recent Activity
                </h3>
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No activity yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by sending your first email.</p>
                </div>
              </div>
            </div>
          </div>

    </div>
  );
}
