'use client';

import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { useEffect } from 'react';

export function useAuth() {
  const auth = useAuthContext();

  // Sync API client token with auth context
  useEffect(() => {
    apiClient.setToken(auth.token);
  }, [auth.token]);

  return {
    ...auth,
    // Add convenience methods
    apiClient,
  };
}
