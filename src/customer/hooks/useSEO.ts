import { useEffect } from 'react';
import { cmsApiDirect } from '../../shared/cms/cmsApiDirect';

interface SEOOverrides {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  canonicalPath?: string;
  publishedTime?: string;
  author?: string;
  noindex?: boolean;
}

interface SeoDefaults {
  siteName?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultKeywords?: string;
}

interface SiteUrlSetting {
  url?: string;
}

interface BrandingSetting {
  logoUrl?: string;
  siteName?: string;
}

let cachedSeoDefaults: SeoDefaults | null = null;
let cachedSiteUrl: string | null = null;
let cachedLogoUrl: string | null = null;

async function loadSeoDefaults(): Promise<SeoDefaults> {
  if (cachedSeoDefaults) return cachedSeoDefaults;
  try {
    const result = await cmsApiDirect.getSettingByName('seo_defaults');
    cachedSeoDefaults = result?.value || {};
  } catch {
    cachedSeoDefaults = {};
  }
  return cachedSeoDefaults;
}

async function loadSiteUrl(): Promise<string> {
  if (cachedSiteUrl !== null) return cachedSiteUrl;
  try {
    const result = await cmsApiDirect.getSettingByName('public_site_url') as any;
    cachedSiteUrl = result?.value?.url || '';
  } catch {
    cachedSiteUrl = '';
  }
  return cachedSiteUrl;
}

async function loadBranding(): Promise<string> {
  if (cachedLogoUrl !== null) return cachedLogoUrl;
  try {
    const result = await cmsApiDirect.getSettingByName('site_branding') as any;
    cachedLogoUrl = result?.value?.logoUrl || '';
  } catch {
    cachedLogoUrl = '';
  }
  return cachedLogoUrl;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (!href) return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertOgImage(imageUrl: string) {
  if (!imageUrl) return;
  upsertMeta('property', 'og:image', imageUrl);
  upsertMeta('name', 'twitter:image', imageUrl);
}

export function useSEO(overrides: SEOOverrides = {}) {
  const { title, description, image, type = 'website', canonicalPath, publishedTime, author, noindex } = overrides;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [defaults, siteUrl, logoUrl] = await Promise.all([
        loadSeoDefaults(),
        loadSiteUrl(),
        loadBranding(),
      ]);

      if (cancelled) return;

      const finalTitle = title || defaults.defaultTitle || defaults.siteName || 'Hola Dieta';
      const finalDescription = description || defaults.defaultDescription || '';
      const finalImage = image || logoUrl || '';
      const canonicalUrl = siteUrl && canonicalPath
        ? `${siteUrl.replace(/\/$/, '')}${canonicalPath}`
        : siteUrl || window.location.href;

      document.title = finalTitle;

      let robotsTag = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!robotsTag) {
        robotsTag = document.createElement('meta');
        robotsTag.setAttribute('name', 'robots');
        document.head.appendChild(robotsTag);
      }
      robotsTag.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

      if (finalDescription) {
        upsertMeta('name', 'description', finalDescription);
        upsertMeta('property', 'og:description', finalDescription);
        upsertMeta('name', 'twitter:description', finalDescription);
      }

      if (defaults.defaultKeywords) {
        upsertMeta('name', 'keywords', defaults.defaultKeywords);
      }

      upsertMeta('property', 'og:title', finalTitle);
      upsertMeta('property', 'og:type', type);
      upsertMeta('property', 'og:site_name', defaults.siteName || defaults.defaultTitle || 'Hola Dieta');
      upsertMeta('property', 'og:url', canonicalUrl);
      upsertMeta('name', 'twitter:card', image || finalImage ? 'summary_large_image' : 'summary');
      upsertMeta('name', 'twitter:title', finalTitle);

      if (finalImage) {
        upsertOgImage(finalImage);
      }

      upsertCanonical(canonicalUrl);

      if (type === 'article' && publishedTime) {
        upsertMeta('property', 'article:published_time', publishedTime);
      }
      if (type === 'article' && author) {
        upsertMeta('property', 'article:author', author);
      }
    })();

    return () => { cancelled = true; };
  }, [title, description, image, type, canonicalPath, publishedTime, author, noindex]);
}

export function resetSeoCache() {
  cachedSeoDefaults = null;
  cachedSiteUrl = null;
  cachedLogoUrl = null;
}
