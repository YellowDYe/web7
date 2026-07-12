import { supabase } from '../config/supabase';
import type { BlogPost, BlogStatus } from '../types/website';

export const blogService = {
  async getPosts(): Promise<BlogPost[]> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getPublishedPosts(limit?: number): Promise<BlogPost[]> {
    let query = supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getPublishedPostsByTag(tag: string): Promise<BlogPost[]> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .contains('tags', [tag])
      .order('published_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createPost(post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>): Promise<BlogPost> {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert(post)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updatePost(id: string, updates: Partial<Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>>): Promise<BlogPost> {
    const { data, error } = await supabase
      .from('blog_posts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletePost(id: string): Promise<void> {
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  },

  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) return true;
    if (excludeId && data.length === 1 && data[0].id === excludeId) return true;
    return false;
  }
};
