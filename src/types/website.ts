// CMS types for website management

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
  page_id: string | null;
  type: string;
  content: Record<string, any>;
  name?: string | null;
  is_custom?: boolean;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: string;
  url: string;
  alt_text: string;
  uploaded_by: string | null;
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

// Navigation types
export interface NavigationItem {
  label: string;
  href: string;
  active?: boolean;
}

// Module content types
export interface MacroColumn {
  header: string;
  percentage: string;
  percentageBgColor?: string;
}

export interface CardMacros {
  title: string;
  columns: MacroColumn[];
  macrosEnabled?: boolean;
}

export interface PlanCard {
  id: string;
  title?: string;
  description?: string;
  backgroundColor?: string;
  buttonText?: string;
  buttonLink?: string;
  imageUrl?: string;
  features?: string[];
  price?: string;
  popular?: boolean;
  macros?: CardMacros;
}

export interface Step {
  id: string;
  number: string;
  title?: string;
  description?: string;
  icon?: string;
}

export interface Benefit {
  id: string;
  title?: string;
  description?: string;
  icon?: string;
  highlighted?: boolean;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
}

export interface SiteBranding {
  siteName: string;
  logoUrl: string;
  logoAlt: string;
  tagline?: string;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

// Blog types
export type BlogStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  cover_image_url: string;
  author: string;
  tags: string[];
  meta_title: string;
  meta_description: string;
  status: BlogStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectiveCard {
  id: string;
  title?: string;
  description?: string;
  borderColor?: string;
  buttonText?: string;
  buttonLink?: string;
}

// Module type definitions
export type ModuleType =
  | 'MainMenu'
  | 'MainHero'
  | 'MultiCardFeature'
  | 'StepsFeature'
  | 'FeatureFullImage'
  | 'FeatureSquareImage'
  | 'FeaturePillImage'
  | 'Footer'
  | 'Gallery'
  | 'StructuredGallery'
  | 'BlogGrid'
  | 'Objectives'
  | 'TitleBlock'
  | 'WeeklyMenu';
