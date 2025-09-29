const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string | null) {
    this.token = token;
    console.log('API client token set:', token ? 'present' : 'null');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      console.log('Adding Authorization header with token');
    } else {
      console.log('No token available for request');
    }

    // Merge with existing headers
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Request failed',
          message: data.message || 'An error occurred',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: 'Network error',
        message: 'Failed to connect to server',
      };
    }
  }

  // Auth endpoints
  async verifyToken() {
    return this.request('/api/auth/verify');
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  // User endpoints
  async getUserProfile() {
    return this.request('/api/user/profile');
  }

  async getUserBio() {
    return this.request('/api/user/bio');
  }

  async updateUserProfile(profileData: any) {
    return this.request('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async updateUserBio(bioData: any) {
    return this.request('/api/user/bio', {
      method: 'PUT',
      body: JSON.stringify(bioData),
    });
  }

  // Email endpoints
  async getEmailHistory() {
    return this.request('/api/email/history');
  }

  async sendEmail(emailData: any) {
    return this.request('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(emailData),
    });
  }

  // Contacts endpoints
  async getContacts() {
    return this.request('/api/contacts');
  }

  async addContact(contactData: any) {
    return this.request('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  }

  // Connections endpoints
  async getConnections() {
    return this.request('/api/connections');
  }

  async getConnection(contactId: number) {
    return this.request(`/api/connections/${contactId}`);
  }

  async updateConnectionStatus(contactId: number, status: string) {
    return this.request(`/api/connections/${contactId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async updateConnectionNotes(contactId: number, notes: string) {
    return this.request(`/api/connections/${contactId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    });
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Helper to get OAuth URL
export function getOAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return `${API_BASE_URL}/api/auth/google?source=web&client_id=${clientId}`;
}
