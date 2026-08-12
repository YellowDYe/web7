import React, { useState, useEffect } from 'react';
import { websiteService } from '../../services/websiteService';
import type { Module, ModuleType, Media } from '../../types/website';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Save, Plus, Trash2, CircleCheck as CheckCircle, CircleAlert as AlertCircle, CreditCard as Edit2, X } from 'lucide-react';
import { ContentFieldRenderer } from './ContentFieldRenderer';

export const CustomModulesManager: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [editingContent, setEditingContent] = useState<Record<string, any>>({});
  const [moduleName, setModuleName] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<Media[]>([]);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    moduleId: string;
    moduleName: string;
  }>({ show: false, moduleId: '', moduleName: '' });

  const moduleTypes: { value: ModuleType; label: string }[] = [
    { value: 'MainMenu', label: 'Main Menu' },
    { value: 'MainHero', label: 'Hero Section' },
    { value: 'MultiCardFeature', label: 'Multi Card Feature' },
    { value: 'StepsFeature', label: 'Steps Feature' },
    { value: 'FeatureFullImage', label: 'Feature Full Image' },
    { value: 'FeatureSquareImage', label: 'Feature Square Image' },
    { value: 'FeaturePillImage', label: 'Feature Pill Image' },
    { value: 'Gallery', label: 'Gallery' },
    { value: 'StructuredGallery', label: 'Structured Gallery' },
    { value: 'Footer', label: 'Footer' }
  ];

  useEffect(() => {
    loadCustomModules();
    loadMedia();
  }, []);

  const loadCustomModules = async () => {
    try {
      setLoading(true);
      const customModules = await websiteService.getCustomModules();
      setModules(customModules);
    } catch (error) {
      console.error('Error loading custom modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMedia = async () => {
    try {
      const mediaItems = await websiteService.getMedia();
      setMedia(mediaItems);
    } catch (error) {
      console.error('Error loading media:', error);
    }
  };

  const getDefaultContent = (type: string): Record<string, any> => {
    if (type === 'MainMenu') {
      return {
        logoUrl: "",
        logoAlt: "Logo",
        backgroundColor: "bg-white",
        basePath: "",
        navigationItems: [
          { label: "Home", href: "/", active: false },
          { label: "About", href: "/about", active: false },
          { label: "Contact", href: "/contact", active: false }
        ]
      };
    } else if (type === 'MainHero') {
      return {
        title: "Welcome to Our Site",
        description: "This is the hero section description. Edit this text to customize your message.",
        buttonText: "Get Started",
        leftBackgroundColor: "bg-blue-600",
        rightBackgroundImage: ""
      };
    } else if (type === 'MultiCardFeature') {
      const defaultMacros = {
        title: "Macros",
        macrosEnabled: true,
        columns: [
          { header: "Proteinas", percentage: "50%", percentageBgColor: "" },
          { header: "Carbohidratos", percentage: "50%", percentageBgColor: "" },
          { header: "Grasas", percentage: "50%", percentageBgColor: "" }
        ]
      };
      return {
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
      return {
        title: "How It Works",
        subtitle: "Follow these simple steps",
        backgroundColor: "bg-gray-50",
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
      return {
        title: "Amazing Feature",
        description: "This feature will help you achieve your goals with ease and efficiency.",
        buttonText: "Discover More",
        leftImageUrl: "",
        rightBackgroundColor: "bg-blue-600"
      };
    } else if (type === 'FeatureSquareImage') {
      return {
        title: "Why Choose Us",
        leftImageUrl: "",
        rightBackgroundColor: "bg-white",
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
      return {
        title: "Get In Touch",
        description: "We're here to answer your questions and provide support.",
        leftImageUrl: "",
        backgroundColor: "bg-gray-50",
        iconImageUrl: "",
        contactInfo: {
          phone: "123-456-7890",
          email: "info@example.com"
        }
      };
    } else if (type === 'Gallery') {
      return {
        title: "Gallery Title",
        subtitle: "Gallery subtitle goes here",
        items: [],
        layout: "grid",
        itemsPerPage: 6,
        showPagination: true,
        backgroundColor: "bg-white",
        columns: {
          mobile: 1,
          tablet: 2,
          desktop: 3
        }
      };
    } else if (type === 'StructuredGallery') {
      return {
        title: "Structured Gallery",
        subtitle: "Featured collection",
        images: [],
        backgroundColor: "bg-white"
      };
    } else if (type === 'Footer') {
      return {
        logoUrl: "",
        logoAlt: "Company Logo",
        backgroundColor: "bg-gray-900",
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
    return {};
  };

  const startCreate = () => {
    setShowCreateForm(true);
    setSelectedModule(null);
    setModuleName('');
    setSelectedType('');
    setEditingContent({});
    setSaveStatus({ type: null, message: '' });
  };

  const startEdit = (module: Module) => {
    setShowCreateForm(true);
    setSelectedModule(module);
    setModuleName(module.name || '');
    setSelectedType(module.type);
    setEditingContent(module.content || {});
    setSaveStatus({ type: null, message: '' });
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setEditingContent(getDefaultContent(type));
  };

  const handleSave = async () => {
    if (!moduleName.trim()) {
      setSaveStatus({ type: 'error', message: 'Please enter a module name' });
      return;
    }
    if (!selectedType) {
      setSaveStatus({ type: 'error', message: 'Please select a module type' });
      return;
    }

    try {
      if (selectedModule) {
        await websiteService.updateModule(selectedModule.id, {
          name: moduleName,
          content: editingContent
        });
        setSaveStatus({ type: 'success', message: 'Custom module updated successfully!' });
      } else {
        await websiteService.createModule({
          type: selectedType,
          content: editingContent,
          name: moduleName,
          is_custom: true
        });
        setSaveStatus({ type: 'success', message: 'Custom module created successfully!' });
      }

      setTimeout(() => {
        setShowCreateForm(false);
        loadCustomModules();
        setSaveStatus({ type: null, message: '' });
      }, 1500);
    } catch (error) {
      console.error('Error saving module:', error);
      setSaveStatus({ type: 'error', message: 'Error saving module. Please try again.' });
    }
  };

  const handleDelete = async () => {
    try {
      await websiteService.deleteModule(deleteConfirm.moduleId);
      setDeleteConfirm({ show: false, moduleId: '', moduleName: '' });
      loadCustomModules();
      if (selectedModule?.id === deleteConfirm.moduleId) {
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Error deleting module:', error);
      alert('Error deleting module. Please try again.');
    }
  };

  const toggleModuleActive = async (moduleId: string, currentState: boolean) => {
    try {
      await websiteService.updateModule(moduleId, {
        is_active: !currentState
      });
      setModules(modules.map(m => m.id === moduleId ? { ...m, is_active: !currentState } : m));
    } catch (error) {
      console.error('Error toggling module active state:', error);
    }
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

  const handleAddArrayItem = (key: string, defaultItem: any) => {
    setEditingContent(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), defaultItem]
    }));
  };

  const handleRemoveArrayItem = (key: string, index: number) => {
    setEditingContent(prev => {
      const array = [...(prev[key] || [])];
      array.splice(index, 1);
      return {
        ...prev,
        [key]: array
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading custom modules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Custom Modules</h2>
          <p className="text-gray-600 mt-1">Create reusable modules that can be added to any page</p>
        </div>
        {!showCreateForm && (
          <Button onClick={startCreate} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Custom Module
          </Button>
        )}
      </div>

      {showCreateForm ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedModule ? 'Edit Custom Module' : 'Create Custom Module'}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {saveStatus.type && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                saveStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {saveStatus.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span>{saveStatus.message}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Module Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                placeholder="e.g., My Custom Hero"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Module Type <span className="text-red-600">*</span>
              </label>
              {selectedModule ? (
                <input
                  type="text"
                  value={moduleTypes.find(t => t.value === selectedType)?.label || selectedType}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              ) : (
                <select
                  value={selectedType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select a module type...</option>
                  {moduleTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedType && (
              <>
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Content</h3>
                  <div className="space-y-4">
                    <ContentFieldRenderer
                      content={editingContent}
                      onContentChange={handleContentChange}
                      onNestedContentChange={handleNestedContentChange}
                      onArrayContentChange={handleArrayContentChange}
                      onAddArrayItem={handleAddArrayItem}
                      onRemoveArrayItem={handleRemoveArrayItem}
                      media={media}
                      onMediaLibraryRefresh={loadMedia}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {selectedModule ? 'Update Module' : 'Create Module'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {modules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-gray-400 mb-4">
                  <Plus className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No custom modules yet</h3>
                <p className="text-gray-600 mb-6">
                  Create your first custom module to get started
                </p>
                <Button onClick={startCreate} className="bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Custom Module
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((module) => {
                const isActive = module.is_active !== false;
                return (
                  <Card key={module.id} className={`hover:shadow-lg transition-all ${!isActive ? 'opacity-60' : ''}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 text-lg mb-1 truncate">
                              {module.name}
                            </h3>
                            {!isActive && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                Desactivado
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {moduleTypes.find(t => t.value === module.type)?.label || module.type}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleModuleActive(module.id, isActive)}
                          title={isActive ? 'Desactivar módulo' : 'Activar módulo'}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            isActive
                              ? 'bg-green-500 focus:ring-green-400'
                              : 'bg-gray-300 focus:ring-gray-400'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(module)}
                          className="flex-1"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm({
                            show: true,
                            moduleId: module.id,
                            moduleName: module.name || 'this module'
                          })}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Confirm Delete</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Are you sure you want to delete <strong>{deleteConfirm.moduleName}</strong>?
                This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm({ show: false, moduleId: '', moduleName: '' })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
