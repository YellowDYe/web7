import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route } from 'react-router-dom';
import { cmsApi, Page, Module, testConnection } from '../../shared/cms/cmsApi';
import { cmsApiDirect } from '../../shared/cms/cmsApiDirect';
import { CMSRenderer } from '../../shared/cms/CMSRenderer';
import { runDiagnostics, DiagnosticResult } from '../../utils/diagnostics';
import '../../utils/supabaseDebug';

const CMSPage: React.FC = () => {
  const location = useLocation();
  const [page, setPage] = useState<Page | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[] | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    loadPageContent();
  }, [location.pathname]);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    const result = await testConnection();
    setIsTestingConnection(false);

    if (result.success) {
      alert('Database connection successful! Reloading page...');
      loadPageContent();
    } else {
      alert(`Database connection failed: ${result.error || 'Unknown error'}`);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsTestingConnection(true);
    const results = await runDiagnostics();
    setDiagnostics(results);
    setShowDiagnostics(true);
    setIsTestingConnection(false);
  };

  const loadPageContent = async () => {
    try {
      console.log('[CustomerHomePage] Starting page load...');
      console.log('[CustomerHomePage] Current pathname:', location.pathname);

      setLoading(true);
      setError(null);

      // Remove /shop prefix from path for CMS lookup
      const cmsPath = location.pathname.replace(/^\/shop/, '') || '/';
      console.log('[CustomerHomePage] CMS path after processing:', cmsPath);

      // Use direct REST API instead of Supabase client
      console.log('[CustomerHomePage] Using direct REST API to fetch page data');
      const pageData = await cmsApiDirect.getPageByPath(cmsPath);
      console.log('[CustomerHomePage] Page data received:', pageData);

      if (!pageData) {
        console.error('[CustomerHomePage] No page found for path:', cmsPath);
        setError('Page not found');
        setLoading(false);
        return;
      }

      console.log('[CustomerHomePage] Page found:', pageData.title);
      setPage(pageData);

      // Get modules for this page
      const moduleIds = pageData.module_order || [];
      console.log('[CustomerHomePage] Module IDs from page:', moduleIds);

      if (moduleIds.length > 0) {
        console.log('[CustomerHomePage] Fetching modules...');
        const modulesData = await cmsApiDirect.getModulesByIds(moduleIds);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
              onClick={handleRunDiagnostics}
              disabled={isTestingConnection}
              className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              {isTestingConnection ? 'Running Diagnostics...' : 'Run Full Diagnostics'}
            </button>

            <a
              href="/shop"
              className="block w-full px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              Return to Home
            </a>
          </div>

          {showDiagnostics && diagnostics && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Diagnostic Results</h3>
                <button
                  onClick={() => setShowDiagnostics(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {diagnostics.map((result, index) => (
                  <div key={index} className="border-l-4 pl-4 py-2" style={{
                    borderColor: result.status === 'pass' ? '#10b981' : result.status === 'fail' ? '#ef4444' : '#f59e0b'
                  }}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900">{result.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        result.status === 'pass' ? 'bg-green-100 text-green-800' :
                        result.status === 'fail' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{result.message}</p>
                    {result.details && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">{result.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
          <a href="/shop" className="text-blue-600 hover:text-blue-800">
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  return <CMSRenderer modules={modules} basePath="/shop" />;
};

export const CustomerHomePage: React.FC = () => {
  return (
    <Routes>
      <Route path="*" element={<CMSPage />} />
    </Routes>
  );
};
