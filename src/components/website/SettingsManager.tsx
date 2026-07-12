import React, { useState, useEffect } from 'react';
import { websiteService } from '../../services/websiteService';
import type { Setting } from '../../types/website';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Save, Palette, Search, Code, Upload, Image, Trash2, Check, CircleAlert as AlertCircle, CircleCheck as CheckCircle, MessageCircle, Globe, ExternalLink } from 'lucide-react';

export const SettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('global_styles');
  const [editingSettings, setEditingSettings] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    action: string;
  }>({ show: false, action: '' });
  const [logoUpload, setLogoUpload] = useState({
    uploading: false,
    preview: null as string | null,
    file: null as File | null,
    error: null as string | null,
    success: false
  });

  const settingTabs = [
    { id: 'global_styles', label: 'Global Styles', icon: Palette },
    { id: 'site_branding', label: 'Site Branding', icon: Image },
    { id: 'seo_defaults', label: 'SEO Defaults', icon: Search },
    { id: 'custom_code', label: 'Custom Code', icon: Code },
    { id: 'whatsapp_settings', label: 'WhatsApp', icon: MessageCircle },
    { id: 'public_site_url', label: 'URL del Sitio', icon: Globe },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsData = await websiteService.getSettings();
      setSettings(settingsData);

      // Initialize editing settings
      const editingData: Record<string, any> = {};
      settingsData.forEach(setting => {
        editingData[setting.setting_name] = setting.value;
      });
      setEditingSettings(editingData);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (settingName: string, key: string, value: any) => {
    setEditingSettings(prev => ({
      ...prev,
      [settingName]: {
        ...prev[settingName],
        [key]: value
      }
    }));
  };

  const saveSetting = async (settingName: string) => {
    try {
      setSaveStatus({ type: null, message: '' });
      const updatedSetting = await websiteService.updateSetting(settingName, editingSettings[settingName]);
      setSettings(settings.map(s =>
        s.setting_name === settingName ? updatedSetting : s
      ));
      setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus({ type: 'error', message: 'Error saving settings. Please try again.' });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setLogoUpload(prev => ({
        ...prev,
        error: 'Please select a PNG, JPG, JPEG, or SVG file.',
        file: null,
        preview: null
      }));
      return;
    }

    // Validate file size (2MB limit)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setLogoUpload(prev => ({
        ...prev,
        error: 'File size must be less than 2MB.',
        file: null,
        preview: null
      }));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoUpload(prev => ({
        ...prev,
        file,
        preview: e.target?.result as string,
        error: null,
        success: false
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveLogoUpload = async () => {
    if (!logoUpload.file) return;

    setLogoUpload(prev => ({ ...prev, uploading: true, error: null }));

    try {
      // Upload to media manager
      const mediaResult = await websiteService.uploadMedia(logoUpload.file, 'Site Logo');

      // Update site branding settings
      const updatedSetting = await websiteService.updateSetting('site_branding', {
        ...editingSettings.site_branding,
        logoUrl: mediaResult.url,
        logoAlt: 'Site Logo'
      });

      // Update local state
      setSettings(settings.map(s =>
        s.setting_name === 'site_branding' ? updatedSetting : s
      ));
      setEditingSettings(prev => ({
        ...prev,
        site_branding: updatedSetting.value
      }));

      setLogoUpload({
        uploading: false,
        preview: null,
        file: null,
        error: null,
        success: true
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setLogoUpload(prev => ({ ...prev, success: false }));
      }, 3000);

    } catch (error) {
      console.error('Error uploading logo:', error);
      setLogoUpload(prev => ({
        ...prev,
        uploading: false,
        error: 'Failed to upload logo. Please try again.'
      }));
    }
  };

  const removeLogo = async () => {
    try {
      const updatedSetting = await websiteService.updateSetting('site_branding', {
        ...editingSettings.site_branding,
        logoUrl: '',
        logoAlt: ''
      });

      setSettings(settings.map(s =>
        s.setting_name === 'site_branding' ? updatedSetting : s
      ));
      setEditingSettings(prev => ({
        ...prev,
        site_branding: updatedSetting.value
      }));

      setLogoUpload(prev => ({ ...prev, success: true }));
      setTimeout(() => {
        setLogoUpload(prev => ({ ...prev, success: false }));
      }, 3000);

      setDeleteConfirm({ show: false, action: '' });

    } catch (error) {
      console.error('Error removing logo:', error);
      setLogoUpload(prev => ({
        ...prev,
        error: 'Failed to remove logo. Please try again.'
      }));
      setDeleteConfirm({ show: false, action: '' });
    }
  };

  const renderGlobalStyles = () => {
    const styles = editingSettings.global_styles || {};

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={styles.primaryColor || '#bfd730'}
              onChange={(e) => handleSettingChange('global_styles', 'primaryColor', e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded"
            />
            <input
              type="text"
              value={styles.primaryColor || '#bfd730'}
              onChange={(e) => handleSettingChange('global_styles', 'primaryColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Secondary Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={styles.secondaryColor || '#ffb3e3'}
              onChange={(e) => handleSettingChange('global_styles', 'secondaryColor', e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded"
            />
            <input
              type="text"
              value={styles.secondaryColor || '#ffb3e3'}
              onChange={(e) => handleSettingChange('global_styles', 'secondaryColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Accent Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={styles.accentColor || '#e9ff93'}
              onChange={(e) => handleSettingChange('global_styles', 'accentColor', e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded"
            />
            <input
              type="text"
              value={styles.accentColor || '#e9ff93'}
              onChange={(e) => handleSettingChange('global_styles', 'accentColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Font Family
          </label>
          <input
            type="text"
            value={styles.fontFamily || 'Chivo, Helvetica'}
            onChange={(e) => handleSettingChange('global_styles', 'fontFamily', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    );
  };

  const renderSiteBranding = () => {
    const branding = editingSettings.site_branding || {};

    return (
      <div className="space-y-6">
        {/* Current Logo Display */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Current Logo
          </label>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            {branding.logoUrl ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <img
                    src={branding.logoUrl}
                    alt={branding.logoAlt || 'Site Logo'}
                    crossOrigin="anonymous"
                    className="h-16 w-auto object-contain bg-white p-2 rounded border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Active Logo</p>
                    <p className="text-xs text-gray-500">Currently displayed across the site</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm({ show: true, action: 'remove-logo' })}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Image className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No logo uploaded</p>
                <p className="text-xs">Upload a logo to display across your site</p>
              </div>
            )}
          </div>
        </div>

        {/* Logo Upload Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Upload New Logo
          </label>

          {/* Upload Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Logo Guidelines:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Supported formats: PNG, JPG, JPEG, SVG</li>
              <li>• Maximum file size: 2MB</li>
              <li>• Recommended dimensions: 200×80 pixels (2.5:1 ratio)</li>
              <li>• Use transparent background (PNG) for best results</li>
            </ul>
          </div>

          {/* File Upload Input */}
          <div className="space-y-4">
            <div className="relative">
              <input
                type="file"
                accept="image/png,image/jpg,image/jpeg,image/svg+xml"
                onChange={handleLogoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={logoUpload.uploading}
              />
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Click to browse or drag and drop your logo file
                </p>
              </div>
            </div>

            {/* Preview Section */}
            {logoUpload.preview && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Preview:</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={logoUpload.preview}
                      alt="Logo Preview"
                      className="h-16 w-auto object-contain bg-white p-2 rounded border"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {logoUpload.file?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {logoUpload.file && (logoUpload.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setLogoUpload(prev => ({
                        ...prev,
                        preview: null,
                        file: null,
                        error: null
                      }))}
                      variant="outline"
                      size="sm"
                      disabled={logoUpload.uploading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveLogoUpload}
                      size="sm"
                      disabled={logoUpload.uploading}
                    >
                      {logoUpload.uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Logo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {logoUpload.error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{logoUpload.error}</span>
              </div>
            )}

            {/* Success Message */}
            {logoUpload.success && (
              <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-md">
                <Check className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Logo updated successfully!</span>
              </div>
            )}
          </div>
        </div>

        {/* Additional Branding Settings */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Site Name
          </label>
          <input
            type="text"
            value={branding.siteName || ''}
            onChange={(e) => handleSettingChange('site_branding', 'siteName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your Site Name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logo Alt Text
          </label>
          <input
            type="text"
            value={branding.logoAlt || ''}
            onChange={(e) => handleSettingChange('site_branding', 'logoAlt', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descriptive text for accessibility"
          />
        </div>
      </div>
    );
  };

  const renderSeoDefaults = () => {
    const seo = editingSettings.seo_defaults || {};

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Site Name
          </label>
          <input
            type="text"
            value={seo.siteName || ''}
            onChange={(e) => handleSettingChange('seo_defaults', 'siteName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Title
          </label>
          <input
            type="text"
            value={seo.defaultTitle || ''}
            onChange={(e) => handleSettingChange('seo_defaults', 'defaultTitle', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Description
          </label>
          <textarea
            value={seo.defaultDescription || ''}
            onChange={(e) => handleSettingChange('seo_defaults', 'defaultDescription', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Keywords
          </label>
          <input
            type="text"
            value={seo.defaultKeywords || ''}
            onChange={(e) => handleSettingChange('seo_defaults', 'defaultKeywords', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="keyword1, keyword2, keyword3"
          />
        </div>
      </div>
    );
  };

  const renderCustomCode = () => {
    const code = editingSettings.custom_code || {};

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Header Scripts
          </label>
          <textarea
            value={code.headerScripts || ''}
            onChange={(e) => handleSettingChange('custom_code', 'headerScripts', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={6}
            placeholder="<script>...</script>"
          />
          <p className="text-xs text-gray-500 mt-1">
            Scripts to be injected in the &lt;head&gt; section
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Footer Scripts
          </label>
          <textarea
            value={code.footerScripts || ''}
            onChange={(e) => handleSettingChange('custom_code', 'footerScripts', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={6}
            placeholder="<script>...</script>"
          />
          <p className="text-xs text-gray-500 mt-1">
            Scripts to be injected before &lt;/body&gt;
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Google Analytics ID
          </label>
          <input
            type="text"
            value={code.googleAnalytics || ''}
            onChange={(e) => handleSettingChange('custom_code', 'googleAnalytics', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="G-XXXXXXXXXX"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meta Pixel ID
          </label>
          <input
            type="text"
            value={code.metaPixel || ''}
            onChange={(e) => handleSettingChange('custom_code', 'metaPixel', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123456789012345"
          />
        </div>
      </div>
    );
  };

  const renderWhatsAppSettings = () => {
    const wa = editingSettings.whatsapp_settings || {};
    const isEnabled = wa.enabled ?? false;

    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#25D366' }}>
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-green-800">WhatsApp Floating Button</h4>
              <p className="text-xs text-green-700 mt-1">
                A floating button will appear in the lower-right corner of your website, allowing visitors to contact you directly via WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900">Enable Widget</p>
            <p className="text-xs text-gray-500 mt-0.5">Show the WhatsApp button on your website</p>
          </div>
          <button
            type="button"
            onClick={() => handleSettingChange('whatsapp_settings', 'enabled', !isEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            WhatsApp Phone Number
          </label>
          <input
            type="text"
            value={wa.phoneNumber || ''}
            onChange={(e) => handleSettingChange('whatsapp_settings', 'phoneNumber', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="521234567890"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter the full international number without spaces or symbols. Example: 521234567890 (Mexico)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Message
          </label>
          <textarea
            value={wa.defaultMessage || ''}
            onChange={(e) => handleSettingChange('whatsapp_settings', 'defaultMessage', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            rows={3}
            placeholder="Hola, me gustaría obtener más información."
          />
          <p className="text-xs text-gray-500 mt-1">
            This message will be pre-filled when a visitor opens the WhatsApp chat.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Button Color
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={wa.buttonColor || '#25D366'}
              onChange={(e) => handleSettingChange('whatsapp_settings', 'buttonColor', e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={wa.buttonColor || '#25D366'}
              onChange={(e) => handleSettingChange('whatsapp_settings', 'buttonColor', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
              placeholder="#25D366"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Default WhatsApp green is #25D366</p>
        </div>

        {wa.phoneNumber && (
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-xs font-medium text-gray-700 mb-2">Preview Link</p>
            <a
              href={`https://wa.me/${(wa.phoneNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent(wa.defaultMessage || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 hover:text-green-800 underline break-all"
            >
              {`https://wa.me/${(wa.phoneNumber || '').replace(/\D/g, '')}`}
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderSiteUrl = () => {
    const urlSettings = editingSettings.public_site_url || {};
    const currentUrl = urlSettings.url || '';

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Globe className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800">URL Base del Sitio Publico</h4>
              <p className="text-xs text-blue-700 mt-1">
                Esta URL se usa para el boton "Ver Sitio en Vivo". Las paginas individuales
                (blog, tienda, cuenta) se agregan como rutas sobre esta base.
                Ejemplo: <span className="font-mono">https://shop.holadieta.mx</span>
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL del Sitio
          </label>
          <input
            type="url"
            value={currentUrl}
            onChange={(e) => handleSettingChange('public_site_url', 'url', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="https://shop.holadieta.mx"
          />
          <p className="text-xs text-gray-500 mt-1">
            Sin diagonal al final. Las paginas se construiran como: URL/blog, URL/cuenta, etc.
          </p>
        </div>

        {currentUrl && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-2">
            <p className="text-xs font-medium text-gray-700">Ejemplos de rutas:</p>
            {['', '/blog', '/cuenta', '/orden'].map((path) => (
              <div key={path} className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-600">{currentUrl}{path || '/'}</span>
                <a
                  href={`${currentUrl}${path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'global_styles':
        return renderGlobalStyles();
      case 'site_branding':
        return renderSiteBranding();
      case 'seo_defaults':
        return renderSeoDefaults();
      case 'custom_code':
        return renderCustomCode();
      case 'whatsapp_settings':
        return renderWhatsAppSettings();
      case 'public_site_url':
        return renderSiteUrl();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Save Status Messages */}
      {saveStatus.type && (
        <div className={`flex items-center space-x-2 p-4 rounded-md ${
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <nav className="space-y-2">
              {settingTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left
                      ${activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Settings Content */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {settingTabs.find(tab => tab.id === activeTab)?.label}
              <Button onClick={() => saveSetting(activeTab)} size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderActiveTabContent()}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Remove Logo</h3>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to remove the current logo? You can upload a new one later.
            </p>

            <div className="flex space-x-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm({ show: false, action: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={removeLogo}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Remove Logo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
