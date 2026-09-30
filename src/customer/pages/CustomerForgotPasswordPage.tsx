import { useState, useEffect } from 'react';
import { cmsApi, Module } from '../../shared/cms/cmsApi';
import { CMSRenderer } from '../../shared/cms/CMSRenderer';
import { CustomerForgotPassword } from '../sections/CustomerForgotPassword/CustomerForgotPassword';
import CustomerSiteHeader from '../components/CustomerSiteHeader';
import { Footer } from '../sections/Footer/Footer';
import { friendlyError } from '../utils/friendlyError';

export default function CustomerForgotPasswordPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    loadPageContent();
  }, []);

  const loadPageContent = async () => {
    try {
      setLoading(true);

      const pageData = await cmsApi.getPageByPath('/forgot-password');

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
      console.error('[CustomerForgotPasswordPage] Error loading CMS page:', friendlyError(err, 'Unknown error'));
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
      <div className="min-h-screen bg-gray-50">
        <CustomerSiteHeader />
        <CustomerForgotPassword />
        <Footer />
      </div>
    );
  }

  return <CMSRenderer modules={modules} basePath="" />;
}
