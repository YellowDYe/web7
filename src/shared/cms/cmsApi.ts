import { supabase } from '../../config/supabase';

// Types for our CMS tables
export interface Page {
  id: string;
  path: string;
  title: string;
  module_order: string[];
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: string;
  page_id: string;
  type: string;
  content: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: string;
  url: string;
  alt_text: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  setting_name: string;
  value: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Test database connection
export const testConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[testConnection] Starting connection test...');

    // Add timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection test timeout after 10 seconds')), 10000);
    });

    const queryPromise = supabase
      .from('cms_pages')
      .select('count', { count: 'exact', head: true });

    console.log('[testConnection] Query initiated...');

    const { error } = await Promise.race([queryPromise, timeoutPromise]);

    console.log('[testConnection] Query completed');

    if (error) {
      console.error('[testConnection] Error:', error);
      return { success: false, error: error.message };
    }

    console.log('[testConnection] Success!');
    return { success: true };
  } catch (error) {
    console.error('[testConnection] Exception:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
};

// CMS API functions
export const cmsApi = {
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
    console.log('[cmsApi] getPageByPath called with path:', path);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000);
      });

      let query = supabase
        .from('cms_pages')
        .select('*')
        .eq('path', path);

      if (!adminMode) {
        query = query.eq('published', true);
      }

      const queryPromise = query.maybeSingle();

      console.log('[cmsApi] Query initiated, waiting for response...');

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      console.log('[cmsApi] Query completed');

      if (error) {
        console.error('[cmsApi] getPageByPath error:', error);
        throw new Error(`Failed to fetch page: ${error.message}`);
      }

      console.log('[cmsApi] getPageByPath result:', data);
      return data;
    } catch (error) {
      console.error('[cmsApi] getPageByPath exception:', error);
      throw error;
    }
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
    console.log('[cmsApi] getModulesByIds called with IDs:', moduleIds);

    if (moduleIds.length === 0) {
      console.log('[cmsApi] No module IDs provided, returning empty array');
      return [];
    }

    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000);
      });

      const queryPromise = supabase
        .from('cms_modules')
        .select('*')
        .in('id', moduleIds);

      console.log('[cmsApi] Module query initiated, waiting for response...');

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      console.log('[cmsApi] Module query completed');

      if (error) {
        console.error('[cmsApi] getModulesByIds error:', error);
        throw new Error(`Failed to fetch modules: ${error.message}`);
      }

      console.log('[cmsApi] getModulesByIds result:', data);
      return data || [];
    } catch (error) {
      console.error('[cmsApi] getModulesByIds exception:', error);
      throw error;
    }
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
      // Get the current authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      // Use the website-media bucket
      const bucketName = 'website-media';

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      // Save to cms_media table
      const { data, error } = await supabase
        .from('cms_media')
        .insert({
          url: publicUrl,
          alt_text: altText,
          uploaded_by: user?.id || null
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save media record: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('uploadMedia error:', error);
      throw error;
    }
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
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
