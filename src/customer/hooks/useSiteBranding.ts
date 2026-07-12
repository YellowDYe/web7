import { useState, useEffect } from 'react';
import { cmsApi } from '../../shared/cms/cmsApi';
import { cmsApiDirect } from '../../shared/cms/cmsApiDirect';

interface SiteBranding {
  logoUrl: string;
  logoAlt: string;
  siteName: string;
}

export const useSiteBranding = () => {
  const [branding, setBranding] = useState<SiteBranding>({
    logoUrl: 'https://hkpjbcovnrckihmxqytr.supabase.co/storage/v1/object/public/website-media/1764648223306-q73r1.png',
    logoAlt: 'Site Logo',
    siteName: 'Hola Dieta'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      setError(null);
      let setting = null;

      try {
        console.log('[useSiteBranding] Attempting to load branding with cmsApi...');
        setting = await cmsApi.getSettingByName('site_branding');
        console.log('[useSiteBranding] cmsApi succeeded:', setting);
      } catch (clientError) {
        console.warn('[useSiteBranding] cmsApi failed, trying cmsApiDirect:', clientError);
        try {
          setting = await cmsApiDirect.getSettingByName('site_branding');
          console.log('[useSiteBranding] cmsApiDirect succeeded:', setting);
        } catch (directError) {
          console.error('[useSiteBranding] Both API methods failed:', directError);
          throw directError;
        }
      }

      if (setting && setting.value) {
        const logoUrl = (setting.value.logoUrl || '').trim();
        const logoAlt = (setting.value.logoAlt || '').trim();
        const siteName = (setting.value.siteName || '').trim();

        console.log('[useSiteBranding] Setting branding:', { logoUrl, logoAlt, siteName });

        setBranding({
          logoUrl: logoUrl || branding.logoUrl,
          logoAlt: logoAlt || branding.logoAlt,
          siteName: siteName || branding.siteName
        });
      } else {
        console.warn('[useSiteBranding] No setting found, using defaults');
      }
    } catch (error) {
      console.error('[useSiteBranding] Error loading site branding:', error);
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