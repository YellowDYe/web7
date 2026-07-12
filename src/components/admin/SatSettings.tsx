import React, { useState, useEffect } from 'react';
import { Shield, Upload, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2, Trash2, FileKey, Calendar, Info } from 'lucide-react';
import { satDescargaService } from '../../services/satDescargaService';

const SatSettings: React.FC = () => {
  const [configStatus, setConfigStatus] = useState<{
    configured: boolean;
    config: { rfc: string; isActive: boolean; expiresAt: string; updatedAt: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    rfc?: string;
    expiresAt?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const status = await satDescargaService.getConfigStatus();
      setConfigStatus(status);
    } catch (err) {
      console.error('Error loading SAT config:', err);
      setError('Error al cargar la configuracion de e.firma');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!cerFile || !keyFile || !password) {
      setError('Se requieren los archivos .cer, .key y la contrasena');
      return;
    }

    try {
      setValidating(true);
      setError(null);
      setValidationResult(null);

      const result = await satDescargaService.validateFiel(cerFile, keyFile, password);
      setValidationResult(result);

      if (!result.valid) {
        setError(result.error || 'La e.firma no es valida');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al validar';
      setError(msg);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!cerFile || !keyFile || !password) {
      setError('Se requieren los archivos .cer, .key y la contrasena');
      return;
    }

    if (!validationResult?.valid) {
      setError('Primero valida la e.firma antes de guardar');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await satDescargaService.uploadEfirma(
        cerFile,
        keyFile,
        password,
        validationResult.rfc || '',
        validationResult.expiresAt
      );

      setSuccess('Configuracion de e.firma guardada exitosamente');
      setCerFile(null);
      setKeyFile(null);
      setPassword('');
      setValidationResult(null);
      await loadConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Estas seguro de que deseas desactivar la configuracion de e.firma?')) return;

    try {
      setError(null);
      await satDescargaService.deleteConfig();
      setSuccess('Configuracion desactivada');
      await loadConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      setError(msg);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Cargando configuracion...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Sobre la e.firma (FIEL)</p>
            <p>
              La e.firma es necesaria para conectarse al Web Service de Descarga Masiva del SAT
              y recuperar tus CFDI emitidos y recibidos. Necesitas los archivos .cer y .key
              junto con la contrasena de la llave privada.
            </p>
          </div>
        </div>
      </div>

      {/* Current Config Status */}
      {configStatus?.configured && configStatus.config && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">E.firma configurada</p>
                <p className="text-sm text-green-700">
                  RFC: <span className="font-mono font-semibold">{configStatus.config.rfc}</span>
                  {configStatus.config.expiresAt && (
                    <span className="ml-3">
                      Vence: {formatDate(configStatus.config.expiresAt)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleDelete}
              className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
              title="Desactivar configuracion"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error / Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Upload Form */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          {configStatus?.configured ? 'Actualizar e.firma' : 'Subir e.firma'}
        </h3>

        {/* .cer file */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivo de certificado (.cer)
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".cer"
              onChange={(e) => {
                setCerFile(e.target.files?.[0] || null);
                setValidationResult(null);
              }}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer border border-gray-300 rounded-lg"
            />
            {cerFile && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {cerFile.name}
              </p>
            )}
          </div>
        </div>

        {/* .key file */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivo de llave privada (.key)
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".key"
              onChange={(e) => {
                setKeyFile(e.target.files?.[0] || null);
                setValidationResult(null);
              }}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer border border-gray-300 rounded-lg"
            />
            {keyFile && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {keyFile.name}
              </p>
            )}
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contrasena de la llave privada
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setValidationResult(null);
              }}
              placeholder="Ingresa la contrasena de tu e.firma"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Validation Result */}
        {validationResult?.valid && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">E.firma valida</span>
            </div>
            <div className="text-sm text-green-700 space-y-1 ml-6">
              <p>RFC: <span className="font-mono font-semibold">{validationResult.rfc}</span></p>
              {validationResult.expiresAt && (
                <p className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Vigente hasta: {formatDate(validationResult.expiresAt)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleValidate}
            disabled={!cerFile || !keyFile || !password || validating}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {validating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileKey className="w-4 h-4" />
            )}
            Validar e.firma
          </button>

          <button
            onClick={handleSave}
            disabled={!validationResult?.valid || saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Guardar configuracion
          </button>
        </div>
      </div>

      {/* Security Note */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-500">
          <span className="font-medium">Seguridad:</span> Los archivos de la e.firma se almacenan
          en un bucket privado. La comunicacion con el SAT se realiza exclusivamente desde el servidor.
          Nunca se transmiten las credenciales al navegador.
        </p>
      </div>
    </div>
  );
};

export default SatSettings;
