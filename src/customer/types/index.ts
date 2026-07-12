// Core types for CMS integration
export interface CMSContent {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  imageUrl?: string;
  imageAlt?: string;
  backgroundColor?: string;
  textColor?: string;
}

// Navigation types
export interface NavigationItem {
  label: string;
  href: string;
  active?: boolean;
}

// Plan card types
export interface PlanCard extends CMSContent {
  features?: string[];
  price?: string;
  popular?: boolean;
  imageUrl?: string;
}

// Step types
export interface Step extends CMSContent {
  number: string;
  icon?: string;
}

// Benefit types
export interface Benefit extends CMSContent {
  icon?: string;
  highlighted?: boolean;
}

// Contact info types
export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
}
