import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginPage } from '../components/auth/LoginPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { PageManager } from '../components/admin/PageManager';
import { ModuleEditor } from '../components/admin/ModuleEditor';
import { MediaManager } from '../components/admin/MediaManager';
import { SettingsManager } from '../components/admin/SettingsManager';
import { Button } from '../components/ui/button';
import { 
  FileText, 
  Layers, 
  Image, 
  Settings, 
  Home,
  Menu,
  X,
  User,
  LogOut
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const { appUser, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigationItems = [
    { path: '/admin', label: 'Pages', icon: FileText },
    { path: '/admin/modules', label: 'Modules', icon: Layers },
    { path: '/admin/media', label: 'Media', icon: Image },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <div className="min-h-screen bg-gray-50">
            {/* Mobile Header */}
            <div className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link to="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                  <Home className="w-5 h-5" />
                  <span className="text-sm">Back to Site</span>
                </Link>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">CMS Admin</h1>
              <div className="flex items-center space-x-2">
                {appUser && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">{appUser.full_name}</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2"
                >
                  {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            <div className="flex">
              {/* Sidebar */}
              <div className={`
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 transition-transform duration-200 ease-in-out
                fixed lg:static inset-y-0 left-0 z-50
                w-64 bg-white shadow-lg border-r border-gray-200
                flex flex-col
              `}>
                {/* Desktop Header */}
                <div className="hidden lg:block p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900">CMS Admin</h1>
                    <Link to="/" className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1">
                      <Home className="w-4 h-4" />
                      <span>Site</span>
                    </Link>
                  </div>
                </div>

                {/* User Info - Desktop */}
                {appUser && (
                  <div className="hidden lg:block p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {appUser.full_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {appUser.role_id}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`
                          flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                          ${isActive(item.path)
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                {/* Sign Out Button */}
                <div className="p-4 border-t border-gray-200">
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="w-full justify-start text-gray-700 hover:text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </Button>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Hola Dieta CMS v1.0
                  </p>
                </div>
              </div>

              {/* Mobile Overlay */}
              {isSidebarOpen && (
                <div 
                  className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                  onClick={() => setIsSidebarOpen(false)}
                />
              )}

              {/* Main Content */}
              <div className="flex-1 lg:ml-0">
                <div className="p-6">
                  <Routes>
                    <Route path="/" element={<PageManager />} />
                    <Route path="/modules" element={<ModuleEditor />} />
                    <Route path="/media" element={<MediaManager />} />
                    <Route path="/settings" element={<SettingsManager />} />
                  </Routes>
                </div>
              </div>
            </div>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
};