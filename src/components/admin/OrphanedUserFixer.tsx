import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, CheckCircle, User, Loader2 } from 'lucide-react';
import { supabase } from '../../config/supabase';

interface OrphanedUser {
  auth_id: string;
  email: string;
  created_at: string;
  full_name?: string;
}

const OrphanedUserFixer: React.FC = () => {
  const [orphanedUsers, setOrphanedUsers] = useState<OrphanedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOrphanedUsers = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.rpc('find_orphaned_auth_users');

      if (error) throw error;

      setOrphanedUsers(data || []);

      if (!data || data.length === 0) {
        setMessage({ type: 'success', text: 'No se encontraron usuarios huérfanos' });
      }
    } catch (error) {
      console.error('Error loading orphaned users:', error);
      setMessage({ type: 'error', text: 'Error al cargar usuarios huérfanos' });
    } finally {
      setLoading(false);
    }
  };

  const fixOrphanedUser = async (authId: string, email: string) => {
    setFixing(authId);
    setMessage(null);

    try {
      const { data, error } = await supabase.rpc('fix_orphaned_user', {
        p_auth_user_id: authId
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Usuario ${email} reparado correctamente`
      });

      await loadOrphanedUsers();
    } catch (error) {
      console.error('Error fixing orphaned user:', error);
      setMessage({
        type: 'error',
        text: `Error al reparar usuario ${email}: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    } finally {
      setFixing(null);
    }
  };

  useEffect(() => {
    loadOrphanedUsers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Usuarios Huérfanos</h3>
          <p className="text-sm text-gray-600">
            Usuarios autenticados sin registro en app_users
          </p>
        </div>
        <button
          onClick={loadOrphanedUsers}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Cargando...</span>
        </div>
      ) : orphanedUsers.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-green-800 font-medium">Todo está en orden</p>
          <p className="text-green-600 text-sm mt-1">
            No hay usuarios huérfanos en el sistema
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de Creación
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orphanedUsers.map((user) => (
                <tr key={user.auth_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <User className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleString('es-ES')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => fixOrphanedUser(user.auth_id, user.email)}
                      disabled={fixing === user.auth_id}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {fixing === user.auth_id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Reparando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Reparar</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">¿Qué son los usuarios huérfanos?</p>
            <p className="text-blue-700">
              Son cuentas de autenticación (Supabase Auth) que se crearon correctamente,
              pero no tienen un registro correspondiente en la tabla app_users.
              Esto puede ocurrir si el trigger de base de datos falla por falta de roles
              o problemas de permisos. Usa el botón "Reparar" para crear automáticamente
              el registro faltante.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrphanedUserFixer;
