import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, User, Mail, CreditCard, MapPin, DollarSign, Building } from 'lucide-react';
import { Employee, CreateEmployeeData } from '../../types/employee';

interface EmployeeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEmployeeData) => Promise<void>;
  editingEmployee?: Employee | null;
  loading?: boolean;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingEmployee,
  loading = false
}) => {
  const [formData, setFormData] = useState<CreateEmployeeData>({
    puesto: '',
    numero_empleado: 0,
    nombre: '',
    rfc: '',
    curp: '',
    email: '',
    codigo_postal: '',
    colonia: '',
    delegacion: '',
    estado: '',
    sueldo_bruto: 0,
    isr: 0,
    otras_retenciones: 0,
    sueldo_neto: 0,
    banco: '',
    clabe_interbancaria: '',
    is_active: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or editing employee changes
  useEffect(() => {
    if (isOpen) {
      if (editingEmployee) {
        setFormData({
          puesto: editingEmployee.puesto,
          numero_empleado: editingEmployee.numero_empleado,
          nombre: editingEmployee.nombre,
          rfc: editingEmployee.rfc,
          curp: editingEmployee.curp,
          email: editingEmployee.email,
          codigo_postal: editingEmployee.codigo_postal,
          colonia: editingEmployee.colonia,
          delegacion: editingEmployee.delegacion,
          estado: editingEmployee.estado,
          sueldo_bruto: editingEmployee.sueldo_bruto,
          isr: editingEmployee.isr,
          otras_retenciones: editingEmployee.otras_retenciones,
          sueldo_neto: editingEmployee.sueldo_neto,
          banco: editingEmployee.banco,
          clabe_interbancaria: editingEmployee.clabe_interbancaria,
          is_active: editingEmployee.is_active
        });
      } else {
        setFormData({
          puesto: '',
          numero_empleado: 0,
          nombre: '',
          rfc: '',
          curp: '',
          email: '',
          codigo_postal: '',
          colonia: '',
          delegacion: '',
          estado: '',
          sueldo_bruto: 0,
          isr: 0,
          otras_retenciones: 0,
          sueldo_neto: 0,
          banco: '',
          clabe_interbancaria: '',
          is_active: true
        });
      }
      setErrors({});
    }
  }, [isOpen, editingEmployee]);

  // Calculate net salary when gross salary or deductions change
  useEffect(() => {
    const netSalary = formData.sueldo_bruto - formData.isr - formData.otras_retenciones;
    if (netSalary !== formData.sueldo_neto) {
      setFormData(prev => ({
        ...prev,
        sueldo_neto: Math.max(0, netSalary)
      }));
    }
  }, [formData.sueldo_bruto, formData.isr, formData.otras_retenciones]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.puesto.trim()) {
      newErrors.puesto = 'El puesto es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'El formato del email no es válido';
    }

    if (!formData.rfc.trim()) {
      newErrors.rfc = 'El RFC es requerido';
    } else if (!/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(formData.rfc.toUpperCase())) {
      newErrors.rfc = 'El formato del RFC no es válido';
    }

    if (!formData.curp.trim()) {
      newErrors.curp = 'El CURP es requerido';
    } else if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z][0-9]$/.test(formData.curp.toUpperCase())) {
      newErrors.curp = 'El formato del CURP no es válido';
    }

    if (formData.numero_empleado <= 0) {
      newErrors.numero_empleado = 'El número de empleado debe ser mayor a 0';
    }

    if (formData.sueldo_bruto < 0) {
      newErrors.sueldo_bruto = 'El sueldo bruto no puede ser negativo';
    }

    if (formData.isr < 0) {
      newErrors.isr = 'El ISR no puede ser negativo';
    }

    if (formData.otras_retenciones < 0) {
      newErrors.otras_retenciones = 'Las otras retenciones no pueden ser negativas';
    }

    if (formData.clabe_interbancaria && !/^[0-9]{18}$/.test(formData.clabe_interbancaria)) {
      newErrors.clabe_interbancaria = 'La CLABE debe tener exactamente 18 dígitos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
               type === 'number' ? parseFloat(value) || 0 : 
               value.toUpperCase() // Convert RFC and CURP to uppercase
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 font-poppins">
            {editingEmployee ? 'Editar Empleado' : 'Agregar Empleado'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Personal Information Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Personal
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nombre */}
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      errors.nombre ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Nombre completo del empleado"
                    disabled={loading}
                  />
                </div>
                {errors.nombre && (
                  <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="empleado@empresa.com"
                    disabled={loading}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              {/* RFC */}
              <div>
                <label htmlFor="rfc" className="block text-sm font-medium text-gray-700 mb-2">
                  RFC *
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="rfc"
                    name="rfc"
                    value={formData.rfc}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      errors.rfc ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="ABCD123456EFG"
                    maxLength={13}
                    disabled={loading}
                  />
                </div>
                {errors.rfc && (
                  <p className="mt-1 text-sm text-red-600">{errors.rfc}</p>
                )}
              </div>

              {/* CURP */}
              <div>
                <label htmlFor="curp" className="block text-sm font-medium text-gray-700 mb-2">
                  CURP *
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="curp"
                    name="curp"
                    value={formData.curp}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      errors.curp ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="ABCD123456HEFGHI01"
                    maxLength={18}
                    disabled={loading}
                  />
                </div>
                {errors.curp && (
                  <p className="mt-1 text-sm text-red-600">{errors.curp}</p>
                )}
              </div>
            </div>
          </div>

          {/* Employment Information Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Laboral
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Puesto */}
              <div>
                <label htmlFor="puesto" className="block text-sm font-medium text-gray-700 mb-2">
                  Puesto *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="puesto"
                    name="puesto"
                    value={formData.puesto}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      errors.puesto ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Ej: Gerente, Cocinero, Repartidor"
                    disabled={loading}
                  />
                </div>
                {errors.puesto && (
                  <p className="mt-1 text-sm text-red-600">{errors.puesto}</p>
                )}
              </div>

              {/* Número de Empleado */}
              <div>
                <label htmlFor="numero_empleado" className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Empleado *
                </label>
                <input
                  type="number"
                  id="numero_empleado"
                  name="numero_empleado"
                  value={formData.numero_empleado}
                  onChange={handleChange}
                  min="1"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                    errors.numero_empleado ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="1"
                  disabled={loading}
                />
                {errors.numero_empleado && (
                  <p className="mt-1 text-sm text-red-600">{errors.numero_empleado}</p>
                )}
              </div>
            </div>
          </div>

          {/* Address Information Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información de Domicilio
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Código Postal */}
              <div>
                <label htmlFor="codigo_postal" className="block text-sm font-medium text-gray-700 mb-2">
                  Código Postal
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="codigo_postal"
                    name="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    placeholder="12345"
                    maxLength={5}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Colonia */}
              <div>
                <label htmlFor="colonia" className="block text-sm font-medium text-gray-700 mb-2">
                  Colonia
                </label>
                <input
                  type="text"
                  id="colonia"
                  name="colonia"
                  value={formData.colonia}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="Nombre de la colonia"
                  disabled={loading}
                />
              </div>

              {/* Delegación */}
              <div>
                <label htmlFor="delegacion" className="block text-sm font-medium text-gray-700 mb-2">
                  Delegación/Municipio
                </label>
                <input
                  type="text"
                  id="delegacion"
                  name="delegacion"
                  value={formData.delegacion}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="Delegación o municipio"
                  disabled={loading}
                />
              </div>

              {/* Estado */}
              <div>
                <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <input
                  type="text"
                  id="estado"
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="Estado"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Salary Information Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Salarial
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Sueldo Bruto */}
              <div>
                <label htmlFor="sueldo_bruto" className="block text-sm font-medium text-gray-700 mb-2">
                  Sueldo Bruto (MXN)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="number"
                    id="sueldo_bruto"
                    name="sueldo_bruto"
                    value={formData.sueldo_bruto}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      errors.sueldo_bruto ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                    disabled={loading}
                  />
                </div>
                {errors.sueldo_bruto && (
                  <p className="mt-1 text-sm text-red-600">{errors.sueldo_bruto}</p>
                )}
              </div>

              {/* ISR */}
              <div>
                <label htmlFor="isr" className="block text-sm font-medium text-gray-700 mb-2">
                  ISR (MXN)
                </label>
                <input
                  type="number"
                  id="isr"
                  name="isr"
                  value={formData.isr}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                    errors.isr ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  disabled={loading}
                />
                {errors.isr && (
                  <p className="mt-1 text-sm text-red-600">{errors.isr}</p>
                )}
              </div>

              {/* Otras Retenciones */}
              <div>
                <label htmlFor="otras_retenciones" className="block text-sm font-medium text-gray-700 mb-2">
                  Otras Retenciones (MXN)
                </label>
                <input
                  type="number"
                  id="otras_retenciones"
                  name="otras_retenciones"
                  value={formData.otras_retenciones}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                    errors.otras_retenciones ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  disabled={loading}
                />
                {errors.otras_retenciones && (
                  <p className="mt-1 text-sm text-red-600">{errors.otras_retenciones}</p>
                )}
              </div>

              {/* Sueldo Neto (Read-only, calculated) */}
              <div>
                <label htmlFor="sueldo_neto" className="block text-sm font-medium text-gray-700 mb-2">
                  Sueldo Neto (MXN)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-5 h-5" />
                  <input
                    type="number"
                    id="sueldo_neto"
                    name="sueldo_neto"
                    value={formData.sueldo_neto}
                    readOnly
                    className="w-full pl-10 pr-4 py-3 border border-green-300 bg-green-50 rounded-xl outline-none text-green-900 font-medium"
                    placeholder="0.00"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Calculado automáticamente: Bruto - ISR - Otras retenciones
                </p>
              </div>
            </div>
          </div>

          {/* Banking Information Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Información Bancaria
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Banco */}
              <div>
                <label htmlFor="banco" className="block text-sm font-medium text-gray-700 mb-2">
                  Banco
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="banco"
                    name="banco"
                    value={formData.banco}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    placeholder="Ej: BBVA, Santander, Banamex"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* CLABE Interbancaria */}
              <div>
                <label htmlFor="clabe_interbancaria" className="block text-sm font-medium text-gray-700 mb-2">
                  CLABE Interbancaria
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="clabe_interbancaria"
                    name="clabe_interbancaria"
                    value={formData.clabe_interbancaria}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all ${
                      errors.clabe_interbancaria ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="123456789012345678"
                    maxLength={18}
                    disabled={loading}
                  />
                </div>
                {errors.clabe_interbancaria && (
                  <p className="mt-1 text-sm text-red-600">{errors.clabe_interbancaria}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  18 dígitos de la CLABE interbancaria
                </p>
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Empleado activo
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Los empleados inactivos no aparecen en reportes activos
              </p>
            </div>
            <button
              type="button"
              id="is_active"
              onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                formData.is_active ? 'bg-primary-600' : 'bg-gray-300'
              }`}
              aria-pressed={formData.is_active}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Form Actions */}
          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingEmployee ? 'Actualizar' : 'Crear'} Empleado
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;