import React, { useState, useEffect } from 'react';
import { websiteService } from '../../services/websiteService';
import type { Page, Module, Media } from '../../types/website';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Save, Plus, Trash2, Image, X, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { ContentFieldRenderer } from './ContentFieldRenderer';

export const ModuleEditor: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [customModules, setCustomModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [editingContent, setEditingContent] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    moduleId: string;
    moduleName: string;
  }>({ show: false, moduleId: '', moduleName: '' });
  const [media, setMedia] = useState<Media[]>([]);
  const [showMediaSelector, setShowMediaSelector] = useState<{
    show: boolean;
    key: string;
    index?: number;
    field?: string;
  }>({ show: false, key: '' });
  const [showAddMenu, setShowAddMenu] = useState(false);

  const moduleTypes = [
    'MainMenu',
    'MainHero',
    'MainHeroCarousel',
    'MultiCardFeature',
    'StepsFeature',
    'FeatureFullImage',
    'FeatureSquareImage',
    'FeaturePillImage',
    'Gallery',
    'StructuredGallery',
    'BlogGrid',
    'Objectives',
    'FAQ',
    'TitleBlock',
    'CustomerProfile',
    'CustomerOrder',
    'Footer'
  ];

  const systemModuleTypes = ['CustomerProfile', 'CustomerOrder'];

  useEffect(() => {
    loadPages();
    loadMedia();
    loadCustomModules();
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

  const loadMedia = async () => {
    try {
      const mediaData = await websiteService.getMedia();
      setMedia(mediaData);
    } catch (error) {
      console.error('Error loading media:', error);
    }
  };

  const loadCustomModules = async () => {
    try {
      const customModulesData = await websiteService.getCustomModules();
      setCustomModules(customModulesData);
    } catch (error) {
      console.error('Error loading custom modules:', error);
    }
  };

  const loadPageModules = async (page: Page) => {
    try {
      const moduleIds = page.module_order || [];
      const modulesData = await websiteService.getModulesByIds(moduleIds);
      
      // Sort modules according to module_order
      const sortedModules = moduleIds
        .map(id => modulesData.find(m => m.id === id))
        .filter(Boolean) as Module[];
      
      setModules(sortedModules);
      setSelectedPage(page);
      setSelectedModule(null);
      setEditingContent({});
    } catch (error) {
      console.error('Error loading page modules:', error);
    }
  };

  const normalizeModuleContent = (module: Module): Record<string, any> => {
    const content = module.content || {};

    if (module.type === 'MainHero' || module.type === 'FeatureFullImage') {
      return {
        buttonLink: '',
        ...content
      };
    }

    if (module.type === 'MultiCardFeature') {
      const defaultMacros = {
        title: "Macros",
        columns: [
          { header: "Proteinas", percentage: "50%" },
          { header: "Carbohidratos", percentage: "50%" },
          { header: "Grasas", percentage: "50%" }
        ]
      };
      const cardDefaults = {
        id: '',
        title: '',
        description: '',
        backgroundColor: '#ffffff',
        buttonText: '',
        buttonLink: '',
        imageUrl: '',
        macros: defaultMacros
      };

      if (Array.isArray(content.cards)) {
        return {
          ...content,
          cards: content.cards.map((card: Record<string, any>) => ({
            ...cardDefaults,
            ...card,
            macros: card.macros ?? defaultMacros
          }))
        };
      }
    }

    return content;
  };

  const selectModule = (module: Module) => {
    setSelectedModule(module);
    setEditingContent(normalizeModuleContent(module));
  };

  const handleContentChange = (key: string, value: any) => {
    setEditingContent(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNestedContentChange = (parentKey: string, childKey: string, value: any) => {
    setEditingContent(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: value
      }
    }));
  };

  const handleArrayContentChange = (key: string, index: number, field: string, value: any) => {
    setEditingContent(prev => {
      const array = [...(prev[key] || [])];
      array[index] = {
        ...array[index],
        [field]: value
      };
      return {
        ...prev,
        [key]: array
      };
    });
  };

  const addArrayItem = (key: string, defaultItem: any) => {
    setEditingContent(prev => {
      const array = [...(prev[key] || [])];
      array.push(defaultItem);
      return {
        ...prev,
        [key]: array
      };
    });
  };

  const removeArrayItem = (key: string, index: number) => {
    setEditingContent(prev => {
      const array = [...(prev[key] || [])];
      array.splice(index, 1);
      return {
        ...prev,
        [key]: array
      };
    });
  };
  const selectMedia = (mediaUrl: string) => {
    const { key, index, field } = showMediaSelector;
    
    if (typeof index === 'number' && field) {
      // Handle array item field (like card images)
      handleArrayContentChange(key, index, field, mediaUrl);
    } else {
      // Handle regular field
      handleContentChange(key, mediaUrl);
    }
    
    setShowMediaSelector({ show: false, key: '' });
  };

  const saveModule = async () => {
    if (!selectedModule) return;

    // Prevent saving custom modules from page editor
    if (selectedModule.is_custom) {
      setSaveStatus({ type: 'error', message: 'Los módulos personalizados deben editarse en la pestaña de Módulos Personalizados' });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 5000);
      return;
    }

    // Prevent editing system modules
    const isSystemModule = systemModuleTypes.includes(selectedModule.type);
    if (isSystemModule) {
      setSaveStatus({ type: 'error', message: 'Los módulos del sistema no se pueden editar. Solo se pueden reordenar en la página.' });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 5000);
      return;
    }

    setSaveStatus({ type: null, message: '' });

    try {
      const updatedModule = await websiteService.updateModule(selectedModule.id, {
        content: editingContent
      });

      setModules(modules.map(m => m.id === selectedModule.id ? updatedModule : m));
      setSelectedModule(updatedModule);
      setSaveStatus({ type: 'success', message: '¡Módulo guardado exitosamente!' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error saving module:', error);
      setSaveStatus({ type: 'error', message: 'Error al guardar módulo. Intenta de nuevo.' });
    }
  };

  const addModule = async (type: string) => {
    if (!selectedPage) return;

    try {
      // Provide default content based on module type
      let defaultContent: any = {};

      if (type === 'MainMenu') {
        defaultContent = {
          logoUrl: "",
          logoAlt: "Logo",
          backgroundColor: "#ffffff",
          basePath: "",
          navigationItems: [
            { label: "Home", href: "/", active: false },
            { label: "About", href: "/about", active: false },
            { label: "Contact", href: "/contact", active: false }
          ]
        };
      } else if (type === 'MainHero') {
        defaultContent = {
          title: "Welcome to Our Site",
          description: "This is the hero section description. Edit this text to customize your message.",
          buttonText: "Get Started",
          buttonLink: "",
          leftBackgroundColor: "#2563eb",
          rightBackgroundImage: ""
        };
      } else if (type === 'MainHeroCarousel') {
        defaultContent = {
          slides: [
            {
              id: 'slide-1',
              title: 'Welcome to Slide One',
              description: 'Edit this slide to customize your message and capture your audience.',
              buttonText: 'Get Started',
              buttonLink: '',
              leftBackgroundColor: '#ffcfe3',
              rightBackgroundImage: ''
            },
            {
              id: 'slide-2',
              title: 'Welcome to Slide Two',
              description: 'Add as many slides as you need to showcase your content beautifully.',
              buttonText: 'Learn More',
              buttonLink: '',
              leftBackgroundColor: '#bfd730',
              rightBackgroundImage: ''
            }
          ],
          autoPlay: true,
          autoPlayInterval: 5000
        };
      } else if (type === 'MultiCardFeature') {
        const defaultMacros = {
          title: "Macros",
          columns: [
            { header: "Proteinas", percentage: "50%" },
            { header: "Carbohidratos", percentage: "50%" },
            { header: "Grasas", percentage: "50%" }
          ]
        };
        defaultContent = {
          title: "Our Features",
          subtitle: "Discover what makes us unique",
          cards: [
            {
              id: "card-1",
              title: "Feature One",
              description: "Description for feature one",
              backgroundColor: "#ffffff",
              buttonText: "Learn More",
              buttonLink: "",
              imageUrl: "",
              macros: defaultMacros
            },
            {
              id: "card-2",
              title: "Feature Two",
              description: "Description for feature two",
              backgroundColor: "#ffffff",
              buttonText: "Learn More",
              buttonLink: "",
              imageUrl: "",
              macros: defaultMacros
            }
          ]
        };
      } else if (type === 'StepsFeature') {
        defaultContent = {
          title: "How It Works",
          subtitle: "Follow these simple steps",
          backgroundColor: "#f9fafb",
          steps: [
            {
              id: "step-1",
              number: "1",
              title: "First Step",
              description: "Description for the first step"
            },
            {
              id: "step-2",
              number: "2",
              title: "Second Step",
              description: "Description for the second step"
            },
            {
              id: "step-3",
              number: "3",
              title: "Third Step",
              description: "Description for the third step"
            }
          ]
        };
      } else if (type === 'FeatureFullImage') {
        defaultContent = {
          title: "Amazing Feature",
          description: "This feature will help you achieve your goals with ease and efficiency.",
          buttonText: "Discover More",
          buttonLink: "",
          leftImageUrl: "",
          rightBackgroundColor: "#2563eb"
        };
      } else if (type === 'FeatureSquareImage') {
        defaultContent = {
          title: "Why Choose Us",
          leftImageUrl: "",
          rightBackgroundColor: "#ffffff",
          benefits: [
            {
              id: "benefit-1",
              title: "Quality Service",
              description: "We provide the highest quality service",
              highlighted: true
            },
            {
              id: "benefit-2",
              title: "Expert Team",
              description: "Our team consists of industry experts",
              highlighted: false
            },
            {
              id: "benefit-3",
              title: "24/7 Support",
              description: "We're here to help you anytime",
              highlighted: false
            }
          ]
        };
      } else if (type === 'FeaturePillImage') {
        defaultContent = {
          title: "Get In Touch",
          description: "We're here to answer your questions and provide support.",
          leftImageUrl: "",
          backgroundColor: "#f9fafb",
          iconImageUrl: "",
          contactInfo: {
            phone: "123-456-7890",
            email: "info@example.com"
          }
        };
      } else if (type === 'Gallery') {
        defaultContent = {
          title: "Gallery Title",
          subtitle: "Gallery subtitle goes here",
          items: [],
          layout: "grid",
          itemsPerPage: 6,
          showPagination: true,
          backgroundColor: "#ffffff",
          columns: {
            mobile: 1,
            tablet: 2,
            desktop: 3
          }
        };
      } else if (type === 'StructuredGallery') {
        defaultContent = {
          title: "Structured Gallery",
          subtitle: "Featured collection",
          images: [],
          backgroundColor: "#ffffff"
        };
      } else if (type === 'BlogGrid') {
        defaultContent = {
          title: "Artículos Recientes",
          subtitle: "Consejos de nutrición, recetas y más",
          postsToShow: 3,
          showViewAll: true,
          viewAllLink: "/blog",
          viewAllText: "Ver todos los artículos"
        };
      } else if (type === 'Objectives') {
        defaultContent = {
          title: 'OUR OBJECTIVES',
          subtitle: 'What we stand for and where we are headed',
          backgroundColor: '#ffffff',
          cards: [
            {
              id: 'objective-1',
              title: 'Our First Objective',
              description: 'Describe what this objective means and how it drives your mission forward. Add context and value here.',
              borderColor: '#e9ff93',
              buttonText: 'Learn More',
              buttonLink: ''
            },
            {
              id: 'objective-2',
              title: 'Our Second Objective',
              description: 'Describe what this objective means and how it drives your mission forward. Add context and value here.',
              borderColor: '#ffcfe3',
              buttonText: 'Learn More',
              buttonLink: ''
            },
            {
              id: 'objective-3',
              title: 'Our Third Objective',
              description: 'Describe what this objective means and how it drives your mission forward. Add context and value here.',
              borderColor: '#bfd730',
              buttonText: 'Learn More',
              buttonLink: ''
            }
          ]
        };
      } else if (type === 'FAQ') {
        defaultContent = {
          title: 'PREGUNTAS FRECUENTES',
          subtitle: 'Todo lo que necesitas saber sobre nuestro servicio',
          backgroundColor: '#ffffff',
          accentColor: '#bfd730',
          faqItems: [
            {
              id: 'faq-1',
              question: '¿Cómo funciona el servicio?',
              answer: 'Nuestro servicio es completamente personalizado. Seleccionas tu plan alimenticio, nosotros preparamos tus comidas con ingredientes frescos y te las entregamos en la puerta de tu casa cada semana.'
            },
            {
              id: 'faq-2',
              question: '¿Puedo personalizar mis comidas según mis restricciones alimenticias?',
              answer: 'Sí, absolutamente. Al momento de registrarte puedes indicar alergias, intolerancias o preferencias alimenticias y nuestro equipo las tomará en cuenta en cada preparación.'
            },
            {
              id: 'faq-3',
              question: '¿Con qué frecuencia se realizan las entregas?',
              answer: 'Las entregas se realizan semanalmente. Puedes elegir el día y horario que mejor se adapte a tu agenda al momento de realizar tu pedido.'
            }
          ],
          contactTitle: '¿No encontraste lo que buscabas?',
          contactDescription: 'Nuestro equipo está listo para ayudarte con cualquier pregunta o duda que tengas.',
          contactButtonText: 'Contáctanos',
          contactButtonLink: '/contacto'
        };
      } else if (type === 'TitleBlock') {
        defaultContent = {
          title: "Section Title",
          subtitle: "Supporting subtitle text",
          alignment: "center",
          backgroundColor: "#ffffff"
        };
      } else if (type === 'CustomerProfile') {
        defaultContent = {
          title: 'Perfil del Cliente',
          description: 'Módulo del sistema para mostrar información de cuenta del cliente',
          isSystemModule: true
        };
      } else if (type === 'Footer') {
        defaultContent = {
          logoUrl: "",
          logoAlt: "Company Logo",
          backgroundColor: "#111827",
          navigationItems: [
            { label: "Home", href: "/", active: false },
            { label: "About", href: "/about", active: false },
            { label: "Services", href: "/services", active: false },
            { label: "Contact", href: "/contact", active: false }
          ],
          contactInfo: {
            phone: "123-456-7890",
            email: "info@example.com",
            address: "123 Main St, City, State 12345"
          },
          socialLinks: {
            facebook: "",
            instagram: "",
            twitter: ""
          }
        };
      }

      const newModule = await websiteService.createModule({
        page_id: selectedPage.id,
        type,
        content: defaultContent
      });

      // Update page module_order
      const newModuleOrder = [...(selectedPage.module_order || []), newModule.id];
      await websiteService.updatePage(selectedPage.id, { module_order: newModuleOrder });

      // Reload modules
      const updatedPage = { ...selectedPage, module_order: newModuleOrder };
      setSelectedPage(updatedPage);
      loadPageModules(updatedPage);
    } catch (error) {
      console.error('Error adding module:', error);
    }
  };

  const addCustomModuleToPage = async (customModuleId: string) => {
    if (!selectedPage) return;

    try {
      // Check if module is already added to prevent duplicates
      if (selectedPage.module_order.includes(customModuleId)) {
        setSaveStatus({ type: 'error', message: 'Este módulo ya está agregado a la página' });
        setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
        return;
      }

      // Update page module_order to include the custom module
      const newModuleOrder = [...(selectedPage.module_order || []), customModuleId];
      await websiteService.updatePage(selectedPage.id, { module_order: newModuleOrder });

      // Reload modules
      const updatedPage = { ...selectedPage, module_order: newModuleOrder };
      setSelectedPage(updatedPage);
      loadPageModules(updatedPage);
      setShowAddMenu(false);

      setSaveStatus({ type: 'success', message: '¡Módulo personalizado agregado exitosamente!' });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    } catch (error) {
      console.error('Error adding custom module to page:', error);
      setSaveStatus({ type: 'error', message: 'Error al agregar módulo. Intenta de nuevo.' });
    }
  };

  const deleteModule = async (moduleId: string) => {
    if (!selectedPage) return;

    try {
      // Check if it's a custom or system module
      const moduleToDelete = modules.find(m => m.id === moduleId);
      const isCustomModule = moduleToDelete?.is_custom;
      const isSystemModule = moduleToDelete && systemModuleTypes.includes(moduleToDelete.type);

      // Prevent deletion of system modules
      if (isSystemModule) {
        setSaveStatus({ type: 'error', message: 'No se puede eliminar un módulo del sistema requerido' });
        setDeleteConfirm({ show: false, moduleId: '', moduleName: '' });
        setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
        return;
      }

      if (!isCustomModule) {
        // Only delete page-specific modules from database
        await websiteService.deleteModule(moduleId);
      }

      // Update page module_order (for both custom and page-specific modules)
      const newModuleOrder = selectedPage.module_order.filter(id => id !== moduleId);
      await websiteService.updatePage(selectedPage.id, { module_order: newModuleOrder });

      // Reload modules
      const updatedPage = { ...selectedPage, module_order: newModuleOrder };
      setSelectedPage(updatedPage);
      loadPageModules(updatedPage);

      if (selectedModule?.id === moduleId) {
        setSelectedModule(null);
        setEditingContent({});
      }

      setDeleteConfirm({ show: false, moduleId: '', moduleName: '' });
      setSaveStatus({ type: 'success', message: '¡Módulo eliminado exitosamente!' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error deleting module:', error);
      setSaveStatus({ type: 'error', message: 'Error al eliminar módulo. Intenta de nuevo.' });
      setDeleteConfirm({ show: false, moduleId: '', moduleName: '' });
    }
  };

  const toggleModuleActive = async (moduleId: string, currentState: boolean) => {
    try {
      const updatedModule = await websiteService.updateModule(moduleId, {
        is_active: !currentState
      });
      setModules(modules.map(m => m.id === moduleId ? updatedModule : m));
      if (selectedModule?.id === moduleId) {
        setSelectedModule(updatedModule);
      }
    } catch (error) {
      console.error('Error toggling module active state:', error);
      setSaveStatus({ type: 'error', message: 'Error al cambiar el estado del módulo.' });
      setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
    }
  };

  const renderContentEditor = () => {
    if (!selectedModule) return null;

    return (
      <ContentFieldRenderer
        content={editingContent}
        onContentChange={handleContentChange}
        onNestedContentChange={handleNestedContentChange}
        onArrayContentChange={handleArrayContentChange}
        onAddArrayItem={addArrayItem}
        onRemoveArrayItem={removeArrayItem}
        media={media}
        onMediaLibraryRefresh={loadMedia}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Module Editor</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pages */}
        <Card>
          <CardHeader>
            <CardTitle>Pages</CardTitle>
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
                  <div className="font-medium text-gray-900">{page.title}</div>
                  <div className="text-sm text-gray-500">{page.path}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Modules
              {selectedPage && (
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="bg-primary-600 hover:bg-primary-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Module
                  </Button>

                  {showAddMenu && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10 max-h-96 overflow-y-auto">
                      {customModules.length > 0 && (
                        <div className="p-2 border-b border-gray-200">
                          <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">
                            Custom Modules
                          </div>
                          {customModules.map(cm => (
                            <button
                              key={cm.id}
                              onClick={() => addCustomModuleToPage(cm.id)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                            >
                              <div className="font-medium">{cm.name}</div>
                              <div className="text-xs text-gray-500">{cm.type}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="p-2">
                        <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1">
                          New Page-Specific Module
                        </div>
                        {moduleTypes.map(type => (
                          <button
                            key={type}
                            onClick={() => {
                              addModule(type);
                              setShowAddMenu(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPage ? (
              <div className="space-y-2">
                {modules.map((module) => {
                  const isSystemModule = systemModuleTypes.includes(module.type);
                  const isActive = module.is_active !== false;
                  return (
                    <div
                      key={module.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedModule?.id === module.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${module.is_custom ? 'border-l-4 border-l-purple-500' : ''} ${isSystemModule ? 'border-l-4 border-l-orange-500' : ''} ${!isActive ? 'opacity-50' : ''}`}
                      onClick={() => selectModule(module)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-medium text-gray-900 truncate">
                              {module.is_custom ? module.name : module.type}
                            </div>
                            {module.is_custom && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                Custom
                              </span>
                            )}
                            {isSystemModule && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                System
                              </span>
                            )}
                            {!isActive && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                Desactivado
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {module.is_custom ? module.type : (module.content.title || module.content.name || 'No title')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => {
                              if (isSystemModule) {
                                setSaveStatus({ type: 'error', message: 'No se puede eliminar un módulo del sistema requerido' });
                                setTimeout(() => setSaveStatus({ type: null, message: '' }), 3000);
                                return;
                              }
                              setDeleteConfirm({
                                show: true,
                                moduleId: module.id,
                                moduleName: module.is_custom ? module.name || module.type : module.type
                              });
                            }}
                            title={
                              isSystemModule
                                ? 'Cannot delete system module'
                                : module.is_custom
                                  ? 'Remove from page (will not delete the custom module)'
                                  : 'Delete module'
                            }
                            disabled={isSystemModule}
                            className={isSystemModule ? 'opacity-50 cursor-not-allowed' : ''}
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
                    No modules found
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Select a page to view modules
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {selectedModule ? (
                selectedModule.is_custom ? `View ${selectedModule.name}` : `Edit ${selectedModule.type}`
              ) : 'Selecciona un módulo'}
              {selectedModule && !selectedModule.is_custom && (
                <Button onClick={saveModule} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              )}
            </CardTitle>
            {/* Custom Module Notice */}
            {selectedModule?.is_custom && (
              <div className="flex items-start space-x-2 p-3 rounded-md bg-purple-50 text-purple-700 border border-purple-200 mt-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-sm mb-1">Custom Module (Read-Only)</div>
                  <p className="text-xs text-purple-600">
                    This is a custom module that is shared across multiple pages.
                    To edit it, go to the "Módulos Personalizados" tab.
                  </p>
                </div>
              </div>
            )}
            {/* Save Status Messages */}
            {saveStatus.type && (
              <div className={`flex items-center space-x-2 p-3 rounded-md mt-2 ${
                saveStatus.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {saveStatus.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm">{saveStatus.message}</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {selectedModule ? (
              <div className={`space-y-4 max-h-96 overflow-y-auto ${selectedModule.is_custom ? 'opacity-60 pointer-events-none' : ''}`}>
                {renderContentEditor()}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Select a module to edit its content
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Media Selector Modal */}
      {showMediaSelector.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Select Image</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMediaSelector({ show: false, key: '' })}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.filter(item => item.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded-lg overflow-hidden"
                  onClick={() => selectMedia(item.url)}
                >
                  <img
                    src={item.url}
                    alt={item.alt_text}
                    className="w-full h-24 object-cover"
                  />
                  <div className="p-2 bg-gray-50">
                    <p className="text-xs text-gray-600 truncate">
                      {item.alt_text || 'Sin texto alternativo'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {media.filter(item => item.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Image className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No images found. Upload some images in the Media section first.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (() => {
        const moduleToDelete = modules.find(m => m.id === deleteConfirm.moduleId);
        const isCustomModule = moduleToDelete?.is_custom;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isCustomModule ? 'Remove Module' : 'Delete Module'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isCustomModule ? 'Remove from this page only' : 'This action cannot be undone'}
                  </p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                {isCustomModule ? (
                  <>
                    Are you sure you want to remove <strong>{deleteConfirm.moduleName}</strong> from this page?
                    <br />
                    <span className="text-sm text-gray-600">
                      The custom module itself will not be deleted and can still be added to other pages.
                    </span>
                  </>
                ) : (
                  <>
                    Are you sure you want to delete the <strong>{deleteConfirm.moduleName}</strong> module?
                  </>
                )}
              </p>

              <div className="flex space-x-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm({ show: false, moduleId: '', moduleName: '' })}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteModule(deleteConfirm.moduleId)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isCustomModule ? 'Remove' : 'Delete'} Module
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};