export interface Employee {
  id: string;
  employee_id: string;
  puesto: string;
  numero_empleado: number;
  nombre: string;
  rfc: string;
  curp: string;
  email: string;
  codigo_postal: string;
  colonia: string;
  delegacion: string;
  estado: string;
  sueldo_bruto: number;
  isr: number;
  otras_retenciones: number;
  sueldo_neto: number;
  banco: string;
  clabe_interbancaria: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeData {
  puesto: string;
  numero_empleado: number;
  nombre: string;
  rfc: string;
  curp: string;
  email: string;
  codigo_postal: string;
  colonia: string;
  delegacion: string;
  estado: string;
  sueldo_bruto: number;
  isr: number;
  otras_retenciones: number;
  sueldo_neto: number;
  banco: string;
  clabe_interbancaria: string;
  is_active?: boolean;
}

export interface UpdateEmployeeData {
  puesto?: string;
  numero_empleado?: number;
  nombre?: string;
  rfc?: string;
  curp?: string;
  email?: string;
  codigo_postal?: string;
  colonia?: string;
  delegacion?: string;
  estado?: string;
  sueldo_bruto?: number;
  isr?: number;
  otras_retenciones?: number;
  sueldo_neto?: number;
  banco?: string;
  clabe_interbancaria?: string;
  is_active?: boolean;
}