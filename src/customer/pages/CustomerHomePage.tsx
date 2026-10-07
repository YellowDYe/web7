import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import { cmsApi, Page, Module } from '../../shared/cms/cmsApi';
import { cmsApiDirect } from '../../shared/cms/cmsApiDirect';
import { CMSRenderer } from '../../shared/cms/CMSRenderer';
import { useSEO } from '../hooks/useSEO';

const CMSPage: React.FC = () => {
  const location = useLocation();
  const [page, setPage] = useState<Page | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSEO({
    title: page?.meta_title || page?.title,
    description: page?.meta_description || undefined,
    canonicalPath: location.pathname || '/',
    noindex: page ? !page.published : true,
  });

  useEffect(() => {
    loadPageContent();
  }, [location.pathname]);

  const loadPageContent = async () => {
    try {
      console.log('[CustomerHomePage] Starting page load...');
      console.log('[CustomerHomePage] Current pathname:', location.pathname);

      setLoading(true);
      setError(null);

      // Strip /preview prefix so CMS lookup uses the real page path;
      // enable adminMode so unpublished pages and inactive modules are visible.
      const isPreview = location.pathname.startsWith('/preview');
      const cmsPath = isPreview
        ? (location.pathname.replace(/^\/preview/, '') || '/')
        : (location.pathname || '/');
      console.log('[CustomerHomePage] CMS path after processing:', cmsPath, isPreview ? '(preview)' : '');

      const pageData = await cmsApiDirect.getPageByPath(cmsPath, isPreview);

      if (!pageData) {
        console.error('[CustomerHomePage] No page found for path:', cmsPath);
        setError('Page not found');
        setLoading(false);
        return;
      }

      setPage(pageData);

      const moduleIds = pageData.module_order || [];

      if (moduleIds.length > 0) {
        const modulesData = await cmsApiDirect.getModulesByIds(moduleIds, isPreview);
        console.log('[CustomerHomePage] Modules data received:', modulesData.length, 'modules');

        // Sort modules according to module_order
        const sortedModules = moduleIds
          .map(id => modulesData.find(m => m.id === id))
          .filter(Boolean) as Module[];

        console.log('[CustomerHomePage] Sorted modules:', sortedModules.map(m => m.type));
        setModules(sortedModules);
      } else {
        console.log('[CustomerHomePage] No modules found for this page');
        setModules([]);
      }

      console.log('[CustomerHomePage] Page load complete!');
      setLoading(false);
    } catch (error) {
      console.error('[CustomerHomePage] Error loading page content:', error);
      setError('Page not found');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Pagina no encontrada</h1>
          <p className="text-gray-500 mb-8">La pagina que buscas no esta disponible.</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-[#e9ff93] rounded-full border border-black text-black font-medium hover:bg-[#d4e87a] transition-colors"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Pagina no encontrada</h1>
          <a href="/" className="text-blue-600 hover:text-blue-800">
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  return <CMSRenderer modules={modules} basePath="" />;
};

export const CustomerHomePage: React.FC = () => {
  return (
    <Routes>
      <Route path="*" element={<CMSPage />} />
    </Routes>
  );
};
