import { supabase } from '../config/supabase';

export function resolveImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const { data } = supabase.storage.from('website-media').getPublicUrl(path);
  return data?.publicUrl || path;
}

export function getPublicImageUrl(path: string): string {
  return resolveImageUrl(path);
}
