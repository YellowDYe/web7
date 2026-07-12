import { supabase } from '../config/supabase';
import { Employee, CreateEmployeeData, UpdateEmployeeData } from '../types/employee';

export class EmployeeService {
  // Generate next employee ID (EMP1, EMP2, EMP3...)
  private async generateNextEmployeeId(): Promise<string> {
    const { data, error } = await supabase
      .from('employees')
      .select('employee_id');

    if (error) {
      console.error('Error fetching last employee ID:', error);
      return 'EMP1';
    }

    if (!data || data.length === 0) {
      return 'EMP1';
    }

    // Parse all numeric parts and find the maximum
    const numericParts = data
      .map(item => parseInt(item.employee_id.replace('EMP', '')))
      .filter(num => !isNaN(num));
    
    const maxNumber = numericParts.length > 0 ? Math.max(...numericParts) : 0;
    return `EMP${maxNumber + 1}`;
  }

  // Generate next employee number
  private async generateNextEmployeeNumber(): Promise<number> {
    const { data, error } = await supabase
      .from('employees')
      .select('numero_empleado')
      .order('numero_empleado', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching last employee number:', error);
      return 1;
    }

    if (!data || data.length === 0) {
      return 1;
    }

    return (data[0].numero_empleado || 0) + 1;
  }

  // Create new employee
  async createEmployee(employeeData: CreateEmployeeData): Promise<Employee> {
    const employee_id = await this.generateNextEmployeeId();
    const numero_empleado = employeeData.numero_empleado || await this.generateNextEmployeeNumber();

    const { data, error } = await supabase
      .from('employees')
      .insert([
        {
          employee_id,
          numero_empleado,
          ...employeeData
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating employee: ${error.message}`);
    }

    return data;
  }

  // Get all employees
  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching employees: ${error.message}`);
    }

    return data || [];
  }

  // Get single employee by ID
  async getEmployeeById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Error fetching employee: ${error.message}`);
    }

    return data;
  }

  // Update employee
  async updateEmployee(id: string, updateData: UpdateEmployeeData): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating employee: ${error.message}`);
    }

    return data;
  }

  // Delete employee
  async deleteEmployee(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting employee: ${error.message}`);
    }
  }

  // Search employees by name or email
  async searchEmployees(searchTerm: string): Promise<Employee[]> {
    if (!searchTerm.trim()) {
      return this.getEmployees();
    }

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .or(`nombre.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,employee_id.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error searching employees: ${error.message}`);
    }

    return data || [];
  }
}

export const employeeService = new EmployeeService();