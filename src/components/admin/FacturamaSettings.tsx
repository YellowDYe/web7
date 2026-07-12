import React, { useState, useEffect } from 'react';
import {
  FileText, Save, Edit, Key, Globe, Shield, Eye, EyeOff, Loader2,
  CheckCircle, AlertCircle, Settings, Building2, MapPin, Tag
} from 'lucide-react';
import { facturamaConfigService } from '../../services/facturamaConfigService';
import { facturamaService } from '../../services/facturamaService';
import { FacturamaConfigForm, SAT_TAX_REGIMES } from '../../types/facturamaConfig';

const DEFAULT_FORM: FacturamaConfigForm = {
  username: '',
  password: '',
  environment: 'sandbox',
  issuer_rfc: '',
  issuer_name: '',
  issuer_tax_regime: '',
  issuer_street: '',
  issuer_exterior_number: '',
  issuer_interior_number: '',
  issuer_neighborhood: '',
  issuer_municipality: '',
  issuer_state: '',
  issuer_postal_code: '',
  default_product_key: '50192200',
  default_unit_key: 'E48',
  default_unit_name: 'Unidad de servicio',
};

const FacturamaSettings: React.FC = () => {
  const [config, setConfig] = useState<FacturamaConfigForm>(DEFAULT_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null, message: ''
  });
  const [fetchIssuerLoading, setFetchIssuerLoading] = useState(false);
  const [fetchIssuerResult, setFetchIssuerResult] = useState<{ type: 'success' | 'warning' | 'error' | null; message: string }>({
    type: null, message: ''
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      setConfigError(null);
      const data = await facturamaConfigService.getFacturamaConfigForm();
      setConfig(data);
    } catch (err) {
      console.error('Error loading Facturama config:', err);
      setConfigError('Error al cargar la configuración de Facturama');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaveLoading(true);
      setConfigError(null);

      if (!config.username || !config.password) {
        setConfigError('El usuario y contraseña son obligatorios');
        return;
      }
      if (!config.issuer_postal_code) {
        setConfigError('El código postal del emisor es obligatorio');
        return;
      }

      await facturamaConfigService.updateFacturamaConfig(config);
      facturamaConfigService.clearCache();

      setSaveSuccess(true);
      setIsEditing(false);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving Facturama config:', err);
      setConfigError(err.message || 'Error al guardar la configuración');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveSuccess(false);
    setShowPassword(false);
    setFetchIssuerResult({ type: null, message: '' });
    loadConfig();
  };

  const handleFetchIssuer = async () => {
    try {
      setFetchIssuerLoading(true);
      setFetchIssuerResult({ type: null, message: '' });

      const issuer = await facturamaService.fetchIssuerFromApi();
      if (!issuer || !issuer.name) {
        setFetchIssuerResult({
          type: 'error',
          message: 'No se encontró ningún perfil fiscal en la cuenta de Facturama. Verifica que las credenciales sean correctas y que hayas cargado tu CSD en el portal de Facturama.'
        });
        return;
      }

      setConfig(prev => ({
        ...prev,
        issuer_rfc: issuer.rfc || prev.issuer_rfc,
        issuer_name: issuer.name || prev.issuer_name,
      }));

      if (issuer.nameMismatch && issuer.csdName) {
        setFetchIssuerResult({
          type: 'warning',
          message: `ADVERTENCIA: El nombre en el Perfil Fiscal de Facturama ("${issuer.name}") no coincide con el nombre en el CSD ("${issuer.csdName}"). El SAT validara contra el CSD. Considera actualizar el perfil en Facturama para que coincida exactamente.`
        });
      } else if (issuer.csdName) {
        setFetchIssuerResult({
          type: 'success',
          message: `Datos obtenidos: RFC ${issuer.rfc} — "${issuer.name}" (confirmado en CSD). Revisa y guarda la configuracion.`
        });
      } else {
        setFetchIssuerResult({
          type: 'success',
          message: `Datos del perfil fiscal: RFC ${issuer.rfc} — "${issuer.name}". No se encontro CSD cargado — asegurate de subir tu CSD en el portal de Facturama para poder timbrar. Revisa y guarda la configuracion.`
        });
      }
    } catch (err: any) {
      setFetchIssuerResult({
        type: 'error',
        message: err.message || 'Error al consultar los datos del emisor en Facturama'
      });
    } finally {
      setFetchIssuerLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTestLoading(true);
      setTestResult({ type: null, message: '' });

      await facturamaService.testConnection();

      setTestResult({
        type: 'success',
        message: 'Conexión exitosa con Facturama. Las credenciales son válidas.'
      });
    } catch (error: any) {
      console.error('Error testing Facturama connection:', error);
      setTestResult({
        type: 'error',
        message: error.message || 'Verifique las credenciales y el entorno configurado'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const inputClass = (editing: boolean) =>
    `w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
      editing ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
    }`;

  return (
    <div className="space-y-6">
      <div>
        {/* Section header + Edit/Save controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Settings className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 font-poppins">
              Credenciales y Datos del Emisor
            </h3>
          </div>

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <Edit className="w-4 h-4" />
              <span>Editar</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                disabled={saveLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saveLoading}
                className="bg-success-500 hover:bg-success-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Guardar</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Security notice */}
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800">
              <p className="font-medium mb-1">Configuración Segura:</p>
              <ul className="space-y-1 text-emerald-700">
                <li>• Las credenciales se almacenan de forma segura en la base de datos</li>
                <li>• Use el entorno Sandbox para pruebas antes de facturar en producción</li>
                <li>• Se usa la <strong>API Web de Facturama</strong>: el emisor se toma automáticamente del perfil fiscal de tu cuenta</li>
                <li>• Solo es obligatorio el código postal de expedición; los demás datos del emisor son de referencia</li>
              </ul>
            </div>
          </div>
        </div>

        {configLoading ? (
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
              <span className="text-sm text-gray-600">Cargando configuración...</span>
            </div>
          </div>
        ) : configError && !isEditing ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-600">{configError}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* --- API Credentials --- */}
            <div>
              <h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                <Key className="w-4 h-4 text-gray-500" />
                <span>Credenciales de API</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Environment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Entorno *</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                      name="environment"
                      value={config.environment}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={inputClass(isEditing)}
                    >
                      <option value="sandbox">Sandbox (Pruebas)</option>
                      <option value="production">Production (En vivo)</option>
                    </select>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usuario *</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="username"
                      value={config.username}
                      onChange={handleChange}
                      readOnly={!isEditing}
                      placeholder="usuario@empresa.com"
                      className={inputClass(isEditing)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña *</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type={isEditing && showPassword ? 'text' : 'password'}
                      name="password"
                      value={config.password}
                      onChange={handleChange}
                      readOnly={!isEditing}
                      placeholder="••••••••"
                      className={`${inputClass(isEditing)} pr-12`}
                    />
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* --- Issuer data --- */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-gray-800 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  <span>Datos del Emisor (Empresa)</span>
                </h4>
                <button
                  type="button"
                  onClick={handleFetchIssuer}
                  disabled={fetchIssuerLoading || !config.username || !config.password}
                  className="flex items-center space-x-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetchIssuerLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{fetchIssuerLoading ? 'Consultando...' : 'Obtener datos desde Facturama'}</span>
                </button>
              </div>

              {fetchIssuerResult.type && (
                <div className={`mb-3 p-3 rounded-xl flex items-start space-x-2 text-sm ${
                  fetchIssuerResult.type === 'success'
                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                    : fetchIssuerResult.type === 'warning'
                    ? 'bg-amber-50 border border-amber-300 text-amber-900'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {fetchIssuerResult.type === 'success'
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                    : <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${fetchIssuerResult.type === 'warning' ? 'text-amber-600' : 'text-red-600'}`} />
                  }
                  <span>{fetchIssuerResult.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">RFC del Emisor *</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="issuer_rfc"
                      value={config.issuer_rfc}
                      onChange={handleChange}
                      readOnly={!isEditing}
                      placeholder="XAXX010101000"
                      maxLength={13}
                      className={`${inputClass(isEditing)} uppercase`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombre / Razón Social *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      name="issuer_name"
                      value={config.issuer_name}
                      onChange={handleChange}
                      readOnly={!isEditing}
                      placeholder="MI EMPRESA S.A. DE C.V."
                      className={inputClass(isEditing)}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Solo de referencia. La API Web de Facturama toma el nombre del emisor directamente del perfil fiscal de tu cuenta.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Régimen Fiscal *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                      name="issuer_tax_regime"
                      value={config.issuer_tax_regime}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={inputClass(isEditing)}
                    >
                      <option value="">Seleccionar régimen fiscal...</option>
                      {SAT_TAX_REGIMES.map(r => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Issuer address --- */}
            <div>
              <h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span>Domicilio Fiscal del Emisor</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Calle</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="issuer_street" value={config.issuer_street} onChange={handleChange} readOnly={!isEditing} placeholder="Av. Reforma" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. Exterior</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="issuer_exterior_number" value={config.issuer_exterior_number} onChange={handleChange} readOnly={!isEditing} placeholder="100" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">No. Interior</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="issuer_interior_number" value={config.issuer_interior_number} onChange={handleChange} readOnly={!isEditing} placeholder="Piso 3" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Colonia</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="issuer_neighborhood" value={config.issuer_neighborhood} onChange={handleChange} readOnly={!isEditing} placeholder="Juárez" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Municipio / Alcaldía</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="issuer_municipality" value={config.issuer_municipality} onChange={handleChange} readOnly={!isEditing} placeholder="Cuauhtémoc" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="issuer_state" value={config.issuer_state} onChange={handleChange} readOnly={!isEditing} placeholder="Ciudad de México" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Código Postal *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="issuer_postal_code" value={config.issuer_postal_code} onChange={handleChange} readOnly={!isEditing} placeholder="06600" maxLength={5} className={inputClass(isEditing)} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Código postal del lugar de expedición (obligatorio para CFDI)</p>
                </div>
              </div>
            </div>

            {/* --- Default SAT codes --- */}
            <div>
              <h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                <Tag className="w-4 h-4 text-gray-500" />
                <span>Códigos SAT por Defecto para Conceptos</span>
              </h4>
              <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
                Estos códigos se aplican a todos los conceptos (líneas de factura). La clave de producto <strong>50192200</strong> corresponde a "Servicios de preparación y suministro de comida" y la unidad <strong>E48</strong> corresponde a "Unidad de servicio".
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Clave Producto/Servicio SAT</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="default_product_key" value={config.default_product_key} onChange={handleChange} readOnly={!isEditing} placeholder="50192200" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Clave Unidad SAT</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="default_unit_key" value={config.default_unit_key} onChange={handleChange} readOnly={!isEditing} placeholder="E48" className={inputClass(isEditing)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de Unidad</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" name="default_unit_name" value={config.default_unit_name} onChange={handleChange} readOnly={!isEditing} placeholder="Unidad de servicio" className={inputClass(isEditing)} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error after form */}
        {configError && isEditing && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 mt-4">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-600">{configError}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-4 bg-success-50 border border-success-200 rounded-xl flex items-center space-x-2 mt-4">
            <CheckCircle className="w-5 h-5 text-success-600" />
            <span className="text-sm text-success-800">Configuración guardada exitosamente</span>
          </div>
        )}

        {/* Test Connection */}
        <div className="space-y-4 pt-6 border-t border-gray-200 mt-6">
          <h4 className="text-lg font-medium text-gray-900">Probar Conexión</h4>
          <p className="text-gray-600 text-sm">
            Verifica que las credenciales de Facturama funcionan correctamente antes de generar facturas.
          </p>

          <button
            onClick={handleTest}
            disabled={testLoading || !config.username || !config.password}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {testLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Probando...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Probar Conexión</span>
              </>
            )}
          </button>

          {testResult.type && (
            <div className={`p-4 rounded-xl flex items-start space-x-3 ${
              testResult.type === 'success'
                ? 'bg-success-50 border border-success-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {testResult.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-medium ${testResult.type === 'success' ? 'text-success-800' : 'text-red-800'}`}>
                  {testResult.type === 'success' ? 'Conexión exitosa' : 'Error de conexión'}
                </p>
                <p className={`text-sm mt-1 ${testResult.type === 'success' ? 'text-success-700' : 'text-red-700'}`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Setup instructions */}
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-start space-x-2">
            <Shield className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-800">
              <p className="font-medium mb-2">Cómo configurar Facturama:</p>
              <ol className="space-y-1 text-gray-700 list-decimal list-inside">
                <li>Crea una cuenta en <a href="https://www.facturama.mx" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">facturama.mx</a></li>
                <li>Carga tu Certificado de Sello Digital (CSD) y configura tu perfil fiscal en el portal de Facturama</li>
                <li>Ingresa tu usuario y contraseña de Facturama arriba</li>
                <li>Ingresa el <strong>código postal del lugar de expedición</strong> (campo obligatorio para el CFDI)</li>
                <li>Prueba la conexión con el botón "Probar Conexión"</li>
                <li>Asegúrate de configurar el <strong>Uso CFDI</strong> en el perfil de cada cliente</li>
                <li>El emisor (RFC, nombre, régimen fiscal) se toma automáticamente del perfil de tu cuenta en Facturama — no necesitas ingresarlo aquí</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacturamaSettings;
