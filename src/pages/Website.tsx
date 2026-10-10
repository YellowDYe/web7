import React, { useState } from 'react';
import { Globe, ExternalLink, FileText, Layers, Image as ImageIcon, Settings, Box, BookOpen } from 'lucide-react';
import { PageManager } from '../components/website/PageManager';
import { ModuleEditor } from '../components/website/ModuleEditor';
import { CustomModulesManager } from '../components/website/CustomModulesManager';
import { MediaManager } from '../components/website/MediaManager';
import { SettingsManager } from '../components/website/SettingsManager';
import { BlogManager } from '../components/website/BlogManager';

const Website: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pages' | 'modules' | 'custom-modules' | 'media' | 'settings' | 'blog'>('pages');
  const handleOpenLiveSite = () => {
    window.location.href = '/';
  };

  return (
    <div className="sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center space-x-3">
            <Globe className="w-7 h-7 sm:w-8 sm:h-8 text-primary-600 flex-shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Sitio Web</h1>
          </div>
          <button
            onClick={handleOpenLiveSite}
            className="flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 sm:px-6 py-3 rounded-lg font-medium transition-colors shadow-lg w-full sm:w-auto"
          >
            <ExternalLink className="w-5 h-5" />
            <span>Ver Sitio en Vivo</span>
          </button>
        </div>
        <p className="text-gray-600">
          Administra el contenido, páginas y configuración de tu sitio web público.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6 sm:gap-8 overflow-x-auto [scrollbar-width:none] [&>button]:whitespace-nowrap [&>button]:flex-shrink-0">
          <button
            onClick={() => setActiveTab('pages')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pages'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Páginas</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('modules')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'modules'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Box className="w-5 h-5" />
              <span>Módulos</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('custom-modules')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'custom-modules'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5" />
              <span>Módulos Personalizados</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'media'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-5 h-5" />
              <span>Medios</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Configuración</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('blog')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'blog'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>Blog</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
        {activeTab === 'pages' && <PageManager />}
        {activeTab === 'modules' && <ModuleEditor />}
        {activeTab === 'custom-modules' && <CustomModulesManager />}
        {activeTab === 'media' && <MediaManager />}
        {activeTab === 'settings' && <SettingsManager />}
        {activeTab === 'blog' && <BlogManager />}
      </div>
    </div>
  );
};

export default Website;
