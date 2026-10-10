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

const OBJECT_SEGMENT = '/storage/v1/object/public/';
const RENDER_SEGMENT = '/storage/v1/render/image/public/';

function isResizable(url: string): boolean {
  if (!url.includes(OBJECT_SEGMENT)) return false;
  const path = url.split('?')[0].toLowerCase();
  return !path.endsWith('.svg') && !path.endsWith('.gif');
}

// Supabase serves WebP automatically to browsers that accept it.
export function getResizedImageUrl(url: string, width: number, quality = 75): string {
  if (!isResizable(url)) return url;
  const base = url.split('?')[0].replace(OBJECT_SEGMENT, RENDER_SEGMENT);
  return `${base}?width=${width}&quality=${quality}`;
}

export function buildSrcSet(url: string, widths: number[], quality = 75): string | undefined {
  if (!isResizable(url)) return undefined;
  return widths.map(w => `${getResizedImageUrl(url, w, quality)} ${w}w`).join(', ');
}
