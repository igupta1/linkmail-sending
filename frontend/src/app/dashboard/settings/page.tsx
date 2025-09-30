'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, CreditCard, Sun, Moon } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
  ];

  return (
    <div className="max-w-6xl mx-auto py-6 px-12 mt-[60px]">
      <div className="mb-8">
        <h1 className="text-4xl font-newsreader-500 text-primary">
          Settings
        </h1>
      </div>

      <div className="bg-transparent">

          <div className="flex flex-col lg:flex-row gap-8">

            {/* Side Navigation */}
            <div className="lg:w-64 flex-shrink-0">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center cursor-pointer gap-3 px-4 py-3 text-left text-sm rounded-lg transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-selection text-primary'
                          : 'text-secondary hover:bg-selection hover:text-primary'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {activeTab === 'general' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-newsreader-500 text-primary mb-2">
                          General Settings
                        </h2>
                      </div>

                      <div className="space-y-6">
                        {/* Email Section */}
                        <div>
                          <p className="block text-sm text-secondary mb-1 font-medium">
                            Email Address
                          </p>
                          <p className="mt-2 text-xs text-tertiary mb-4">
                            This is your primary email address used for account authentication.
                          </p>
                          <div className="relative">
                            <input
                              type="email"
                              value={user?.email || ''}
                              disabled
                              className="w-full px-3 py-2 text-sm bg-foreground text-secondary border border-border rounded-lg opacity-75 cursor-not-allowed"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                              <span className="text-xs text-primary bg-background px-2 py-1 rounded border border-border">
                                Primary
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Account Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-normal text-secondary mb-3">
                              First Name
                            </label>
                            <input
                              type="text"
                              value={user?.name?.split(' ')[0] || ''}
                              disabled
                              className="w-full px-3 py-2 text-sm bg-foreground text-secondary border border-border rounded-lg opacity-75 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-normal text-secondary mb-3">
                              Last Name
                            </label>
                            <input
                              type="text"
                              value={user?.name?.split(' ').slice(1).join(' ') || ''}
                              disabled
                              className="w-full px-3 py-2 text-sm bg-foreground text-secondary border border-border rounded-lg opacity-75 cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Theme Settings */}
                        <div>
                          <label className="block text-sm font-normal text-secondary mb-3">
                            Theme Preference
                          </label>
                          <div className="flex items-center justify-between p-4 bg-foreground border border-border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {theme === 'dark' ? (
                                  <Moon className="h-5 w-5 text-tertiary" />
                                ) : (
                                  <Sun className="h-5 w-5 text-yellow-500" />
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-primary">
                                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                                </h4>
                                <p className="text-xs text-tertiary">
                                  {theme === 'dark' 
                                    ? 'Switch to light mode for a brighter interface' 
                                    : 'Switch to dark mode for better viewing in low light'
                                  }
                                </p>
                              </div>
                            </div>
                            <ThemeToggle />
                          </div>
                        </div>

                        {/* Account Status */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <h4 className="text-sm font-medium text-green-800">
                                Account Verified
                              </h4>
                              <div className="mt-2 text-sm text-green-700">
                                <p>Your email address has been verified and your account is active.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'subscription' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-newsreader-500 text-primary mb-2">
                          Subscription
                        </h2>
                        <p className="text-secondary text-sm mb-6">
                          Manage your subscription and billing information.
                        </p>
                      </div>

                      <div className="text-center py-12">
                        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <CreditCard className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-primary mb-2">
                          Subscription Management
                        </h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                          Subscription features will be available soon. Check back later to manage your plan and billing.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
    </div>
  );
}



