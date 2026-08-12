import React, { useState, useEffect } from 'react';
import { websiteService } from '../../services/websiteService';
import type { Page, Module } from '../../types/website';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Plus, CreditCard as Edit, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Save, X, CircleCheck as CheckCircle, CircleAlert as AlertCircle, ExternalLink, Globe, FileText } from 'lucide-react';

export const PageManager: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [newPageForm, setNewPageForm] = useState({ path: '', title: '' });
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const [previewPage, setPreviewPage] = useState<Page | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    pageId: string;
    pageName: string;
  }>({ show: false, pageId: '', pageName: '' });

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      setLoading(true);
      const pagesData = await websiteService.getPages();
      setPages(pagesData);
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPageModules = async (page: Page) => {
    try {
      const moduleIds = page.module_order || [];
      const modulesData = await websiteService.getModulesByIds(moduleIds);

      const sortedModules = moduleIds
        .map(id => modulesData.find(m => m.id === id))
        .filter(Boolean) as Module[];

      setModules(sortedModules);
      setSelectedPage(page);
      setPreviewPage(null);
    } catch (error) {
      console.error('Error loading page modules:', error);
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionStatus({ type: null, message: '' });

    try {
      const newPage = await websiteService.createPage({
        path: newPageForm.path,
        title: newPageForm.title,
        module_order: [],
        published: false
      });
      setPages([...pages, newPage]);
      setNewPageForm({ path: '', title: '' });
      setShowNewPageForm(false);
      setActionStatus({ type: 'success', message: '¡Página creada exitosamente!' });

      setTimeout(() => {
        setActionStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error creating page:', error);
      setActionStatus({ type: 'error', message: 'Error al crear la página. Intenta de nuevo.' });
    }
  };

  const handleUpdatePage = async (page: Page) => {
    setActionStatus({ type: null, message: '' });

    try {
      const updatedPage = await websiteService.updatePage(page.id, {
        path: page.path,
        title: page.title
      });
      setPages(pages.map(p => p.id === page.id ? updatedPage : p));
      setEditingPage(null);
      setActionStatus({ type: 'success', message: '¡Página actualizada exitosamente!' });

      setTimeout(() => {
        setActionStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error updating page:', error);
      setActionStatus({ type: 'error', message: 'Error al actualizar la página. Intenta de nuevo.' });
    }
  };

  const handleTogglePublished = async (page: Page) => {
    setTogglingId(page.id);
    try {
      const updatedPage = await websiteService.updatePage(page.id, {
        published: !page.published
      });
      setPages(pages.map(p => p.id === page.id ? updatedPage : p));
      if (selectedPage?.id === page.id) {
        setSelectedPage(updatedPage);
      }
      if (previewPage?.id === page.id) {
        setPreviewPage(updatedPage);
      }
    } catch (error) {
      console.error('Error toggling published status:', error);
      setActionStatus({ type: 'error', message: 'Error al cambiar el estado de la página.' });
      setTimeout(() => setActionStatus({ type: null, message: '' }), 3000);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await websiteService.deletePage(pageId);
      setPages(pages.filter(p => p.id !== pageId));
      if (selectedPage?.id === pageId) {
        setSelectedPage(null);
        setModules([]);
      }
      if (previewPage?.id === pageId) {
        setPreviewPage(null);
      }
      setDeleteConfirm({ show: false, pageId: '', pageName: '' });
      setActionStatus({ type: 'success', message: '¡Página eliminada exitosamente!' });

      setTimeout(() => {
        setActionStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error deleting page:', error);
      setActionStatus({ type: 'error', message: 'Error al eliminar la página. Intenta de nuevo.' });
      setDeleteConfirm({ show: false, pageId: '', pageName: '' });
    }
  };

  const toggleModuleActive = async (moduleId: string, currentState: boolean) => {
    try {
      const updatedModule = await websiteService.updateModule(moduleId, {
        is_active: !currentState
      });
      setModules(modules.map(m => m.id === moduleId ? updatedModule : m));
    } catch (error) {
      console.error('Error toggling module active state:', error);
      setActionStatus({ type: 'error', message: 'Error al cambiar el estado del módulo.' });
      setTimeout(() => setActionStatus({ type: null, message: '' }), 3000);
    }
  };

  const removeModuleFromPage = async (moduleId: string) => {
    if (!selectedPage) return;
    try {
      const newModuleOrder = (selectedPage.module_order || []).filter((id: string) => id !== moduleId);
      await websiteService.updatePage(selectedPage.id, { module_order: newModuleOrder });
      await websiteService.deleteModule(moduleId);
      setModules(modules.filter(m => m.id !== moduleId));
      setPages(pages.map(p =>
        p.id === selectedPage.id ? { ...p, module_order: newModuleOrder } : p
      ));
      setSelectedPage({ ...selectedPage, module_order: newModuleOrder });
      setActionStatus({ type: 'success', message: '¡Módulo eliminado!' });
      setTimeout(() => setActionStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      console.error('Error removing module:', error);
      setActionStatus({ type: 'error', message: 'Error al eliminar el módulo.' });
      setTimeout(() => setActionStatus({ type: null, message: '' }), 3000);
    }
  };

  const moveModule = async (moduleIndex: number, direction: 'up' | 'down') => {
    if (!selectedPage) return;

    const newModules = [...modules];
    const targetIndex = direction === 'up' ? moduleIndex - 1 : moduleIndex + 1;

    if (targetIndex < 0 || targetIndex >= newModules.length) return;

    [newModules[moduleIndex], newModules[targetIndex]] = [newModules[targetIndex], newModules[moduleIndex]];

    const newModuleOrder = newModules.map(m => m.id);

    try {
      await websiteService.updatePage(selectedPage.id, { module_order: newModuleOrder });
      setModules(newModules);

      setPages(pages.map(p =>
        p.id === selectedPage.id
          ? { ...p, module_order: newModuleOrder }
          : p
      ));
    } catch (error) {
      console.error('Error updating module order:', error);
    }
  };

  const getPreviewUrl = (page: Page) => `/preview${page.path === '/' ? '' : page.path}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando páginas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Gestión de Páginas</h2>
        <Button onClick={() => setShowNewPageForm(true)} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Nueva Página</span>
        </Button>
      </div>

      {actionStatus.type && (
        <div className={`flex items-center space-x-2 p-4 rounded-md ${
          actionStatus.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {actionStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{actionStatus.message}</span>
        </div>
      )}

      {showNewPageForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Crear Nueva Página
              <Button variant="ghost" size="sm" onClick={() => setShowNewPageForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruta
                </label>
                <input
                  type="text"
                  value={newPageForm.path}
                  onChange={(e) => setNewPageForm({ ...newPageForm, path: e.target.value })}
                  placeholder="/acerca"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={newPageForm.title}
                  onChange={(e) => setNewPageForm({ ...newPageForm, title: e.target.value })}
                  placeholder="Acerca de"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit">Crear Página</Button>
                <Button type="button" variant="outline" onClick={() => setShowNewPageForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-6 ${previewPage ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <Card>
          <CardHeader>
            <CardTitle>Páginas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPage?.id === page.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => loadPageModules(page)}
                >
                  {editingPage?.id === page.id ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingPage.path}
                        onChange={(e) => setEditingPage({ ...editingPage, path: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <input
                        type="text"
                        value={editingPage.title}
                        onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={() => handleUpdatePage(editingPage)}>
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingPage(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900 truncate">{page.title}</div>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                            page.published
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {page.published ? (
                              <><Globe className="w-2.5 h-2.5" />Publicada</>
                            ) : (
                              <><FileText className="w-2.5 h-2.5" />Borrador</>
                            )}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 truncate">{page.path}</div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleTogglePublished(page)}
                          disabled={togglingId === page.id}
                          title={page.published ? 'Despublicar página' : 'Publicar página'}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${
                            page.published
                              ? 'bg-green-500 focus:ring-green-400'
                              : 'bg-gray-300 focus:ring-gray-400'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              page.published ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>

                        <Button
                          size="sm"
                          variant="ghost"
                          title="Vista previa"
                          onClick={() => setPreviewPage(previewPage?.id === page.id ? null : page)}
                          className={previewPage?.id === page.id ? 'text-blue-600' : ''}
                        >
                          {previewPage?.id === page.id ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          title="Abrir en nueva pestaña"
                          onClick={() => window.open(getPreviewUrl(page), '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>

                        <Button size="sm" variant="ghost" onClick={() => setEditingPage(page)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({
                          show: true,
                          pageId: page.id,
                          pageName: page.title
                        })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedPage ? `Módulos de ${selectedPage.title}` : 'Selecciona una página para ver módulos'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPage ? (
              <div className="space-y-2">
                {modules.map((module, index) => {
                  const isActive = module.is_active !== false;
                  return (
                    <div
                      key={module.id}
                      className={`p-3 border border-gray-200 rounded-lg transition-all ${
                        isActive ? 'bg-gray-50' : 'bg-gray-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-medium text-gray-900 truncate">{module.type}</div>
                            {!isActive && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                Desactivado
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {module.content.title || module.content.name || 'Sin título'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleModuleActive(module.id, isActive)}
                            title={isActive ? 'Desactivar módulo' : 'Activar módulo'}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                              isActive
                                ? 'bg-green-500 focus:ring-green-400'
                                : 'bg-gray-300 focus:ring-gray-400'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                isActive ? 'translate-x-4' : 'translate-x-1'
                              }`}
                            />
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveModule(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveModule(index, 'down')}
                            disabled={index === modules.length - 1}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeModuleFromPage(module.id)}
                            title="Eliminar módulo"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {modules.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No hay módulos en esta página
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Selecciona una página de la izquierda para ver sus módulos
              </div>
            )}
          </CardContent>
        </Card>

        {previewPage && (
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Eye className="w-4 h-4 flex-shrink-0 text-blue-600" />
                  <span className="truncate">Vista Previa — {previewPage.title}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(getPreviewUrl(previewPage), '_blank')}
                    title="Abrir en nueva pestaña"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewPage(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    previewPage.published
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {previewPage.published ? (
                      <><Globe className="w-3 h-3" />Publicada</>
                    ) : (
                      <><FileText className="w-3 h-3" />Borrador</>
                    )}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">{previewPage.path}</span>
                </div>
                <button
                  onClick={() => handleTogglePublished(previewPage)}
                  disabled={togglingId === previewPage.id}
                  title={previewPage.published ? 'Despublicar' : 'Publicar'}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                    previewPage.published ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      previewPage.published ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <iframe
                key={previewPage.id}
                src={getPreviewUrl(previewPage)}
                className="w-full border-0 rounded-b-lg"
                style={{ height: '600px' }}
                title={`Preview: ${previewPage.title}`}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eliminar Página</h3>
                <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-gray-700 mb-2">
              ¿Estás seguro de que quieres eliminar la página <strong>"{deleteConfirm.pageName}"</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              Esto también eliminará todos los módulos asociados a esta página.
            </p>

            <div className="flex space-x-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm({ show: false, pageId: '', pageName: '' })}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeletePage(deleteConfirm.pageId)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar Página
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
