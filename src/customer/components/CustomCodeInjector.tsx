import { useEffect, useRef } from 'react';
import { cmsApiDirect } from '../../shared/cms/cmsApiDirect';

interface CustomCodeSettings {
  headerScripts?: string;
  footerScripts?: string;
  googleAnalytics?: string;
  metaPixel?: string;
  tiktokPixel?: string;
}

const MARKER = 'data-custom-code';

function removeMarked() {
  document.querySelectorAll(`[${MARKER}]`).forEach(el => el.remove());
}

function injectHTML(html: string, target: HTMLElement) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  Array.from(temp.childNodes).forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      el.setAttribute(MARKER, '');

      if (el.tagName === 'SCRIPT') {
        const script = document.createElement('script');
        Array.from(el.attributes).forEach(attr => {
          script.setAttribute(attr.name, attr.value);
        });
        script.textContent = el.textContent;
        target.appendChild(script);
      } else {
        target.appendChild(el.cloneNode(true));
      }
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const span = document.createElement('span');
      span.setAttribute(MARKER, '');
      span.textContent = node.textContent;
      target.appendChild(span);
    }
  });
}

function injectGoogleAnalytics(gaIds: string) {
  const ids = gaIds.split(',').map(id => id.trim()).filter(Boolean);
  if (ids.length === 0) return;
  const primaryId = ids[0];

  const gtagScript = document.createElement('script');
  gtagScript.setAttribute(MARKER, '');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
  document.head.appendChild(gtagScript);

  const configLines = ids.map(id => `gtag('config', '${id}');`).join('\n');
  const inlineScript = document.createElement('script');
  inlineScript.setAttribute(MARKER, '');
  inlineScript.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    ${configLines}
  `;
  document.head.appendChild(inlineScript);
}

function injectMetaPixel(pixelId: string) {
  const script = document.createElement('script');
  script.setAttribute(MARKER, '');
  script.textContent = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);

  const noscript = document.createElement('noscript');
  noscript.setAttribute(MARKER, '');
  noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
  document.head.appendChild(noscript);
}

function injectTikTokPixel(pixelId: string) {
  const script = document.createElement('script');
  script.setAttribute(MARKER, '');
  script.textContent = `
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e+""]=+new Date,ttq._o=ttq._o||{},ttq._o[e+""]=n||{};var i=d.createElement("script");i.type="text/javascript",i.async=!0,i.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(i,a)};
      ttq.load('${pixelId}');
      ttq.page();
    }(window, document, 'ttq');
  `;
  document.head.appendChild(script);
}

export const CustomCodeInjector: React.FC = () => {
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;

    const injectAll = (settings: CustomCodeSettings) => {
      if (settings.googleAnalytics) {
        injectGoogleAnalytics(settings.googleAnalytics.trim());
      }

      if (settings.metaPixel) {
        injectMetaPixel(settings.metaPixel.trim());
      }

      if (settings.tiktokPixel) {
        injectTikTokPixel(settings.tiktokPixel.trim());
      }

      if (settings.headerScripts) {
        injectHTML(settings.headerScripts, document.head);
      }

      if (settings.footerScripts) {
        injectHTML(settings.footerScripts, document.body);
      }
    };

    const load = async () => {
      try {
        const result = await cmsApiDirect.getSettingByName('custom_code');
        if (!result?.value) return;

        const settings: CustomCodeSettings = result.value;
        appliedRef.current = true;

        removeMarked();

        const run = () => injectAll(settings);

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(run, { timeout: 3000 });
        } else {
          setTimeout(run, 1500);
        }
      } catch {
        // Silently fail — tracking just won't load
      }
    };

    load();

    return () => {
      removeMarked();
    };
  }, []);

  return null;
};
