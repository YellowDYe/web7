import { useState, useEffect } from 'react';
import { cmsApi, Page, Module } from '../../shared/cms/cmsApi';
import { CMSRenderer } from '../../shared/cms/CMSRenderer';
import { CustomerLogin } from '../sections/CustomerLogin/CustomerLogin';
import { friendlyError } from '../utils/friendlyError';

export default function CustomerLoginPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    loadPageContent();
  }, []);

  const loadPageContent = async () => {
    try {
      setLoading(true);

      const pageData = await cmsApi.getPageByPath('/login');

      if (!pageData || !pageData.module_order?.length) {
        setUseFallback(true);
        setLoading(false);
        return;
      }

      const moduleIds = pageData.module_order;
      const modulesData = await cmsApi.getModulesByIds(moduleIds);

      const sortedModules = moduleIds
        .map(id => modulesData.find(m => m.id === id))
        .filter(Boolean) as Module[];

      setModules(sortedModules);
      setLoading(false);
    } catch (err) {
      console.error('[CustomerLoginPage] Error loading CMS page:', friendlyError(err, 'Unknown error'));
      setUseFallback(true);
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

  if (useFallback) {
    return (
      <div className="min-h-screen bg-white">
        <CustomerLogin />
      </div>
    );
  }

  return <CMSRenderer modules={modules} basePath="" />;
}
