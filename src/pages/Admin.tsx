import React from 'react';
import { useState } from 'react';
import { Users, Shield, Settings, UserCheck } from 'lucide-react';
import UserManagement from '../components/admin/UserManagement';
import RoleManagement from '../components/admin/RoleManagement';
import SystemSettings from '../components/admin/SystemSettings';
import EmployeeManagement from '../components/admin/EmployeeManagement';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'employees' | 'settings'>('users');

  const tabs = [
    { id: 'users', label: 'Usuarios', icon: Users, component: UserManagement },
    { id: 'roles', label: 'Roles y Permisos', icon: Shield, component: RoleManagement },
    { id: 'employees', label: 'Empleados', icon: UserCheck, component: EmployeeManagement },
    { id: 'settings', label: 'Configuración', icon: Settings, component: SystemSettings }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || UserManagement;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-8">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-primary-100 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-poppins">
                Panel de Administración
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
                Gestiona usuarios, roles, permisos y configuración del sistema
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default Admin;