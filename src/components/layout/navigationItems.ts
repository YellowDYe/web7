import type React from 'react';
import { Shield, Globe, Megaphone } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

export const navigationItems: NavigationItem[] = [
  { id: 'website', label: 'Sitio Web', path: '/admin/website', icon: Globe, permission: 'website_view' },
  { id: 'marketing', label: 'Marketing', path: '/admin/marketing', icon: Megaphone, permission: 'coupons_view' },
  { id: 'admin', label: 'Admin', path: '/admin/users', icon: Shield, permission: 'admin_users' },
];
