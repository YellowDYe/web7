import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import { cmsApi, Page, Module, testConnection } from '../../shared/cms/cmsApi';
import { cmsApiDirect } from '../../shared/cms/cmsApiDirect';
import { CMSRenderer } from '../../shared/cms/CMSRenderer';
import { friendlyError } from '../utils/friendlyError';
import { useSEO } from '../hooks/useSEO';

const CMSPage: React.FC = () => {
  const location = useLocation();
  const [page, setPage] = useState<Page | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useSEO({
    title: page?.meta_title || page?.title,
    description: page?.meta_description || undefined,
    canonicalPath: location.pathname || '/',
    noindex: page ? !page.published : true,
  });

  useEffect(() => {
    loadPageContent();
  }, [location.pathname]);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    const result = await testConnection();
    setIsTestingConnection(false);

    if (result.success) {
      loadPageContent();
    } else {
      // Technical detail stays in the console; visitors see a plain message.
      console.error('[CustomerHomePage] Connection test failed:', result.error);
      alert('No pudimos conectar en este momento. Intenta de nuevo en unos minutos.');
    }
  };

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
      console.error('[CustomerHomePage] ERROR loading page content:', error);
      const errorMessage = friendlyError(error, 'Unknown error');
      console.error('[CustomerHomePage] Error message:', errorMessage);
      console.error('[CustomerHomePage] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setError(`Failed to load page: ${errorMessage}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading page content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <div className="mb-6">
            <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Load Page</h1>
          <p className="text-gray-600 mb-6 break-words">{error}</p>

          <div className="space-y-3">
            <button
              onClick={() => loadPageContent()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>

            <button
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              {isTestingConnection ? 'Comprobando...' : 'Comprobar conexion'}
            </button>

            <a
              href="/"
              className="block w-full px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              Return to Home
            </a>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Troubleshooting:</strong>
            </p>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Check your internet connection</li>
              <li>Open the browser console for more details</li>
              <li>Try clearing your browser cache</li>
              <li>Verify Supabase credentials are correct</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
          <a href="/" className="text-blue-600 hover:text-blue-800">
            Return to Home
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
