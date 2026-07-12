// Direct REST API implementation as fallback for Supabase client issues
import { Page, Module } from './cmsApi';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const headers = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const cmsApiDirect = {
  async getPageByPath(path: string, adminMode = false): Promise<Page | null> {
    console.log('[cmsApiDirect] Fetching page with path:', path);

    try {
      const publishedFilter = adminMode ? '' : '&published=eq.true';
      const url = `${supabaseUrl}/rest/v1/cms_pages?path=eq.${encodeURIComponent(path)}${publishedFilter}&select=*`;
      console.log('[cmsApiDirect] URL:', url);

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers
      });

      console.log('[cmsApiDirect] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[cmsApiDirect] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[cmsApiDirect] Data received:', data);

      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('[cmsApiDirect] Exception:', error);
      throw error;
    }
  },

  async getModulesByIds(moduleIds: string[]): Promise<Module[]> {
    console.log('[cmsApiDirect] Fetching modules with IDs:', moduleIds);

    if (moduleIds.length === 0) {
      return [];
    }

    try {
      // PostgREST format for IN query: id=in.(uuid1,uuid2,uuid3)
      const idsParam = `(${moduleIds.map(id => `"${id}"`).join(',')})`;
      const url = `${supabaseUrl}/rest/v1/cms_modules?id=in.${idsParam}&select=*`;
      console.log('[cmsApiDirect] URL:', url);

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers
      });

      console.log('[cmsApiDirect] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[cmsApiDirect] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[cmsApiDirect] Modules received:', data.length);

      return data;
    } catch (error) {
      console.error('[cmsApiDirect] Exception:', error);
      throw error;
    }
  },

  async getSettingByName(settingName: string): Promise<any | null> {
    console.log('[cmsApiDirect] Fetching setting:', settingName);

    try {
      const url = `${supabaseUrl}/rest/v1/cms_settings?setting_name=eq.${encodeURIComponent(settingName)}&select=*`;
      console.log('[cmsApiDirect] URL:', url);

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers
      });

      console.log('[cmsApiDirect] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[cmsApiDirect] Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[cmsApiDirect] Setting data received:', data);

      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('[cmsApiDirect] Exception:', error);
      throw error;
    }
  },

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[cmsApiDirect] Testing connection...');

      const url = `${supabaseUrl}/rest/v1/cms_pages?select=count`;
      const response = await fetchWithTimeout(url, {
        method: 'HEAD',
        headers
      }, 5000);

      console.log('[cmsApiDirect] Connection test response:', response.status);

      if (response.ok || response.status === 404) {
        return { success: true };
      }

      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      console.error('[cmsApiDirect] Connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};
