import { useState, useEffect } from 'react';
import { cmsApi } from '../lib/supabaseClient';

interface SiteBranding {
  logoUrl: string;
  logoAlt: string;
  siteName: string;
}

export const useSiteBranding = () => {
  const [branding, setBranding] = useState<SiteBranding>({
    logoUrl: '',
    logoAlt: '',
    siteName: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      setError(null);
      const setting = await cmsApi.getSettingByName('site_branding');
      if (setting && setting.value) {
        setBranding({
          logoUrl: setting.value.logoUrl || '',
          logoAlt: setting.value.logoAlt || '',
          siteName: setting.value.siteName || ''
        });
      }
    } catch (error) {
      console.error('Error loading site branding:', error);
      setError('Failed to load site branding');
    } finally {
      setLoading(false);
    }
  };

  return {
    ...branding,
    loading,
    error,
    refresh: loadBranding
  };
};