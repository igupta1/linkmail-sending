'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRouter } from 'next/navigation';
import { LoginButton } from '@/components/LoginButton';
import { ProfileSetup } from '@/components/ProfileSetup';
import { ChevronRight, X, Download, BookOpen } from 'lucide-react';

export default function Dashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { profile, isLoading: profileLoading, getProfileSetupStatus } = useUserProfile();
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showExtensionCallout, setShowExtensionCallout] = useState(false);

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

  // Initialize extension callout visibility from localStorage
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('linkmail_ext_callout_dismissed');
      setShowExtensionCallout(dismissed !== 'true');
    } catch (err) {
      setShowExtensionCallout(true);
    }
  }, []);

  const handleDismissExtensionCallout = () => {
    try {
      localStorage.setItem('linkmail_ext_callout_dismissed', 'true');
    } catch (err) {
      // noop
    }
    setShowExtensionCallout(false);
  };

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


          {/* Extension Modal */}
          {showExtensionCallout && (
            <>
              <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50" onClick={handleDismissExtensionCallout} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-border bg-foreground shadow-xl">
                  <div className="p-4 flex items-start justify-between">
                    <div className="pr-6">
                      <h3 className="text-base font-semibold text-primary">Install the Linkmail extension</h3>
                      <p className="mt-1 text-sm text-secondary">
                        Use Linkmail directly on LinkedIn profiles and inbox to send instantly.
                      </p>
                    </div>
                    <button aria-label="Close" onClick={handleDismissExtensionCallout} className="p-1 rounded-md hover:bg-hover cursor-pointer">
                      <X className="h-5 w-5 text-secondary" />
                    </button>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href="https://chrome.google.com/webstore/category/extensions"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors cursor-pointer flex-1"
                        onClick={handleDismissExtensionCallout}
                      >
                        <Download className="h-4 w-4" /> Install for Chrome
                      </a>
                      <a
                        href="https://addons.mozilla.org/en-US/firefox/extensions/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-hover text-primary text-sm font-medium hover:bg-selection transition-colors cursor-pointer flex-1"
                        onClick={handleDismissExtensionCallout}
                      >
                        Install for Firefox
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-newsreader-500 text-primary">
               Welcome, {user?.name?.split(' ')[0] || 'there'}.
            </h1>
          </div>

          {/* Profile Setup Alert */}
          {(!profile || !getProfileSetupStatus().isSetupComplete) && (
            <div className="relative bg-gradient-to-br from-blue-50 via-indigo-100 to-violet-100 border border-blue-100 dark:bg-gradient-to-br dark:from-[#204B9C] dark:via-[#162B69] dark:to-[#162B69] dark:border-slate-800 rounded-xl p-4 mb-6 overflow-hidden group transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="ml-3 flex-1">
                  <div className="mt-2 text-sm max-w-lg text-primary dark:text-white">
                    <p>Linkmail crafts the best email when you provide context on your goals and professional background. Please provide us some of your details to get started.</p>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => router.push('/dashboard/profile')}
                      className="bg-white/65 hover:bg-white/45 dark:bg-white/10 dark:hover:bg-white/20 cursor-pointer text-black/65 dark:text-slate-100 px-2 pl-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 group/button relative overflow-hidden"
                    >
                      <div className="relative z-10 flex items-center w-[100px]">
                        <div className="translate-x-2 group-hover/button:translate-x-0 w-fit line-clamp-1 transition-all duration-300 transform">
                          Edit Profile
                        </div>
                        <ChevronRight className="w-4 h-4 ml-2 opacity-0 group-hover/button:opacity-100" />
                      </div>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-[100px] h-[100px] rounded-xl bg-white/75 dark:bg-white/10 from-blue-200/30 to-indigo-300/40 dark:from-slate-700/40 dark:to-slate-900/40 border border-white/20 dark:border-slate-700/40 shadow-lg group-hover:rotate-12 group-hover:-translate-y-2 group-hover:scale-105 transition-all duration-300 ease-out">
                    <div className="w-full h-full flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-lg">
                      {getProfileSetupStatus().setupPercentage}%
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating card that appears on hover */}
              <div className="absolute -bottom-6 -right-2 w-20 h-20 bg-white dark:bg-white/10 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-white/15 shadow-lg opacity-0 group-hover:opacity-100 group-hover:rotate-6 group-hover:-translate-y-1 transition-all duration-300 ease-out transform-gpu">
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


          {/* Getting Started Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Install Extension Card */}
            <div className="bg-foreground overflow-hidden border border-border rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg leading-6 font-medium text-primary">Install the Extension</h3>
                </div>
                <p className="text-sm text-secondary">
                  Use Linkmail directly on LinkedIn profiles and inbox to send instantly.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setShowExtensionCallout(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 transition-colors cursor-pointer"
                  >
                    <Download className="h-4 w-4" /> Install extension
                  </button>
                  <a
                    href="https://chrome.google.com/webstore/category/extensions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-hover text-primary text-sm hover:bg-selection transition-colors cursor-pointer"
                  >
                    Open Web Store
                  </a>
                </div>
              </div>
            </div>

            {/* Learn / Docs Card */}
            <div className="bg-foreground overflow-hidden border border-border rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg leading-6 font-medium text-primary">Learn about Linkmail</h3>
                </div>
                <p className="text-sm text-secondary">
                  Get started with best practices and examples. Read the docs to learn how to craft great outreach and automate your workflow.
                </p>
                <div className="mt-4 flex gap-2">
                  <a
                    href="https://linkmail.app/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4" /> Read the docs
                  </a>
                  <a
                    href="https://linkmail.app/learn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-hover text-primary text-sm hover:bg-selection transition-colors cursor-pointer"
                  >
                    Guides & tips
                  </a>
                </div>
              </div>
            </div>
          </div>


    </div>
  );
}
