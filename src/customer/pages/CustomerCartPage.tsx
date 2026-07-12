import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cmsApiDirect } from '../../shared/cms/cmsApiDirect';
import { CMSRenderer } from '../../shared/cms/CMSRenderer';
import { Page, Module } from '../../shared/cms/cmsApi';

const CustomerCartPage: React.FC = () => {
  const location = useLocation();
  const [page, setPage] = useState<Page | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPageContent();
  }, [location.pathname]);

  const loadPageContent = async () => {
    try {
      console.log('[CustomerCartPage] Loading cart page content...');
      setLoading(true);
      setError(null);

      const cmsPath = '/cart';
      console.log('[CustomerCartPage] Fetching page for path:', cmsPath);

      const pageData = await cmsApiDirect.getPageByPath(cmsPath);
      console.log('[CustomerCartPage] Page data received:', pageData);

      if (!pageData) {
        console.error('[CustomerCartPage] No page found for path:', cmsPath);
        setError('Página no encontrada');
        setLoading(false);
        return;
      }

      console.log('[CustomerCartPage] Page found:', pageData.title);
      setPage(pageData);

      const moduleIds = pageData.module_order || [];
      console.log('[CustomerCartPage] Module IDs:', moduleIds);

      if (moduleIds.length > 0) {
        const modulesData = await cmsApiDirect.getModulesByIds(moduleIds);
        console.log('[CustomerCartPage] Modules data received:', modulesData.length, 'modules');

        const sortedModules = moduleIds
          .map(id => modulesData.find(m => m.id === id))
          .filter(Boolean) as Module[];

        console.log('[CustomerCartPage] Sorted modules:', sortedModules.map(m => m.type));
        setModules(sortedModules);
      } else {
        console.log('[CustomerCartPage] No modules for this page');
        setModules([]);
      }

      console.log('[CustomerCartPage] Page load complete!');
      setLoading(false);
    } catch (error) {
      console.error('[CustomerCartPage] Error loading page content:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setError(`Error al cargar la página: ${errorMessage}`);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando carrito...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error al Cargar el Carrito</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => loadPageContent()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Intentar de Nuevo
          </button>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Página No Encontrada</h1>
          <a href="/shop" className="text-blue-600 hover:text-blue-800">
            Volver al Inicio
          </a>
        </div>
      </div>
    );
  }

  return <CMSRenderer modules={modules} basePath="/shop" />;
};

export default CustomerCartPage;
