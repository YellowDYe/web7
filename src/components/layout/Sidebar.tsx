import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Shield, Globe } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const navigationItems: NavigationItem[] = [
  { id: 'website', label: 'Sitio Web', path: '/admin/website', icon: Globe, permission: 'website_view' },
  { id: 'admin', label: 'Admin', path: '/admin/users', icon: Shield, permission: 'admin_users' },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  return (
    <aside className="app-sidebar bg-white w-64 min-h-screen shadow-lg border-r border-gray-200 no-print">
      <nav className="p-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            // Check permission if required
            if (item.permission && !hasPermission(item.permission)) {
              return null;
            }

            const Icon = item.icon;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-primary-600 hover:transform hover:scale-102'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;