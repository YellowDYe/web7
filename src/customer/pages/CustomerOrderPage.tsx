import { useState, useEffect } from 'react';
import { cmsApi, Page, Module } from '../../shared/cms/cmsApi';
import { CMSRenderer } from '../../shared/cms/CMSRenderer';

export const CustomerOrderPage: React.FC = () => {
  const [page, setPage] = useState<Page | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPageContent();
  }, []);

  const loadPageContent = async () => {
    try {
      console.log('[CustomerOrderPage] Loading CMS content for /order page');
      setLoading(true);
      setError(null);

      const pageData = await cmsApi.getPageByPath('/order');

      if (!pageData) {
        console.error('[CustomerOrderPage] Order page not found in CMS');
        setError('Page not found');
        setLoading(false);
        return;
      }

      console.log('[CustomerOrderPage] Page found:', pageData.title);
      setPage(pageData);

      const moduleIds = pageData.module_order || [];
      console.log('[CustomerOrderPage] Module IDs:', moduleIds);

      if (moduleIds.length > 0) {
        const modulesData = await cmsApi.getModulesByIds(moduleIds);
        console.log('[CustomerOrderPage] Modules loaded:', modulesData.length);

        const sortedModules = moduleIds
          .map(id => modulesData.find(m => m.id === id))
          .filter(Boolean) as Module[];

        setModules(sortedModules);
      }

      setLoading(false);
    } catch (err) {
      console.error('[CustomerOrderPage] Error loading page:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cargando...</h2>
          <p className="text-gray-600">Por favor espera</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* CMS Content */}
      <CMSRenderer modules={modules} basePath="" />
    </div>
  );
};

export default CustomerOrderPage;
