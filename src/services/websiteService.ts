import { supabase } from '../config/supabase';
import type { Page, Module, Media, Setting } from '../types/website';

export const websiteService = {
  // Pages
  async getPages(): Promise<Page[]> {
    const { data, error } = await supabase
      .from('cms_pages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getPageByPath(path: string, adminMode = false): Promise<Page | null> {
    let query = supabase
      .from('cms_pages')
      .select('*')
      .eq('path', path);

    if (!adminMode) {
      query = query.eq('published', true);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  async createPage(page: Omit<Page, 'id' | 'created_at' | 'updated_at'>): Promise<Page> {
    const { data, error } = await supabase
      .from('cms_pages')
      .insert(page)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updatePage(id: string, updates: Partial<Page>): Promise<Page> {
    const { data, error } = await supabase
      .from('cms_pages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletePage(id: string): Promise<void> {
    const { error } = await supabase
      .from('cms_pages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Modules
  async getModulesByPageId(pageId: string): Promise<Module[]> {
    const { data, error } = await supabase
      .from('cms_modules')
      .select('*')
      .eq('page_id', pageId);

    if (error) throw error;
    return data || [];
  },

  async getModulesByIds(moduleIds: string[]): Promise<Module[]> {
    if (moduleIds.length === 0) return [];

    const { data, error } = await supabase
      .from('cms_modules')
      .select('*')
      .in('id', moduleIds);

    if (error) throw error;
    return data || [];
  },

  async getAllModules(): Promise<Module[]> {
    const { data, error } = await supabase
      .from('cms_modules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createModule(module: Omit<Module, 'id' | 'created_at' | 'updated_at'>): Promise<Module> {
    const { data, error } = await supabase
      .from('cms_modules')
      .insert(module)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateModule(id: string, updates: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase
      .from('cms_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteModule(id: string): Promise<void> {
    const { error } = await supabase
      .from('cms_modules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Custom Modules
  async getCustomModules(): Promise<Module[]> {
    const { data, error } = await supabase
      .from('cms_modules')
      .select('*')
      .eq('is_custom', true)
      .is('page_id', null)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createCustomModule(module: Omit<Module, 'id' | 'created_at' | 'updated_at' | 'page_id'> & { name: string }): Promise<Module> {
    const { data, error } = await supabase
      .from('cms_modules')
      .insert({
        ...module,
        is_custom: true,
        page_id: null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCustomModule(id: string, updates: Partial<Module> & { name?: string }): Promise<Module> {
    const { data, error } = await supabase
      .from('cms_modules')
      .update(updates)
      .eq('id', id)
      .eq('is_custom', true)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCustomModule(id: string): Promise<void> {
    const pages = await this.getPagesByModuleId(id);

    if (pages.length > 0) {
      throw new Error(`Cannot delete custom module: it is currently used in ${pages.length} page(s)`);
    }

    const { error } = await supabase
      .from('cms_modules')
      .delete()
      .eq('id', id)
      .eq('is_custom', true);

    if (error) throw error;
  },

  async getPagesByModuleId(moduleId: string): Promise<Page[]> {
    const { data, error } = await supabase
      .from('cms_pages')
      .select('*')
      .contains('module_order', [moduleId]);

    if (error) throw error;
    return data || [];
  },

  async duplicateCustomModule(id: string, newName: string): Promise<Module> {
    const { data: originalModule, error: fetchError } = await supabase
      .from('cms_modules')
      .select('*')
      .eq('id', id)
      .eq('is_custom', true)
      .single();

    if (fetchError) throw fetchError;
    if (!originalModule) throw new Error('Custom module not found');

    const { id: _, created_at, updated_at, ...moduleData } = originalModule;

    const { data, error } = await supabase
      .from('cms_modules')
      .insert({
        ...moduleData,
        name: newName,
        is_custom: true,
        page_id: null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async convertToPageSpecific(moduleId: string, pageId: string): Promise<Module> {
    const { data: originalModule, error: fetchError } = await supabase
      .from('cms_modules')
      .select('*')
      .eq('id', moduleId)
      .eq('is_custom', true)
      .single();

    if (fetchError) throw fetchError;
    if (!originalModule) throw new Error('Custom module not found');

    const { id: _, created_at, updated_at, name, is_custom, ...moduleData } = originalModule;

    const { data, error } = await supabase
      .from('cms_modules')
      .insert({
        ...moduleData,
        page_id: pageId,
        is_custom: false,
        name: null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Media
  async getMedia(): Promise<Media[]> {
    const { data, error } = await supabase
      .from('cms_media')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async uploadMedia(file: File, altText: string = ''): Promise<Media> {
    try {
      console.log('Starting upload for file:', file.name, 'Size:', file.size, 'Type:', file.type);

      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user?.id || 'No authenticated user');

      const bucketName = 'website-media';
      console.log('Using storage bucket:', bucketName);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('Uploading to path:', filePath);

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('File uploaded successfully, getting public URL...');

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log('Public URL generated:', publicUrl);

      const finalAltText = altText || file.name.replace(/\.[^/.]+$/, '').replace(/-|_/g, ' ');

      console.log('Saving to cms_media table...');
      const { data, error } = await supabase
        .from('cms_media')
        .insert({
          url: publicUrl,
          alt_text: finalAltText,
          uploaded_by: user?.id || null
        })
        .select()
        .single();

      if (error) {
        console.error('Database save error:', error);
        throw new Error(`Failed to save media record: ${error.message}`);
      }

      console.log('Media record saved successfully:', data);
      return data;
    } catch (error: any) {
      console.error('uploadMedia error:', error);
      throw error;
    }
  },

  async createMedia(media: { url: string; alt_text: string }): Promise<Media> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('cms_media')
      .insert({
        ...media,
        uploaded_by: user?.id || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteMedia(id: string): Promise<void> {
    const { error } = await supabase
      .from('cms_media')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Settings
  async getSettings(): Promise<Setting[]> {
    const { data, error } = await supabase
      .from('cms_settings')
      .select('*');

    if (error) throw error;
    return data || [];
  },

  async getSettingByName(settingName: string): Promise<Setting | null> {
    const { data, error } = await supabase
      .from('cms_settings')
      .select('*')
      .eq('setting_name', settingName)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateSetting(settingName: string, value: Record<string, any>): Promise<Setting> {
    const { data, error } = await supabase
      .from('cms_settings')
      .upsert({
        setting_name: settingName,
        value
      }, {
        onConflict: 'setting_name'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
