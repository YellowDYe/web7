import { supabase } from '../config/supabase';

const SAT_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sat-descarga-masiva`;

async function callEdgeFunction(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const response = await fetch(SAT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok && !data.error) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return data;
}

export interface SatConfigStatus {
  configured: boolean;
  config: {
    rfc: string;
    isActive: boolean;
    expiresAt: string;
    updatedAt: string;
  } | null;
}

export interface SatDownloadRequest {
  id: string;
  request_id: string;
  date_start: string;
  date_end: string;
  download_type: string;
  request_type: string;
  status: string;
  packages_count: number;
  cfdis_count: number;
  package_ids: string[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SatCfdi {
  id: string;
  uuid_cfdi: string;
  rfc_emisor: string;
  nombre_emisor: string;
  rfc_receptor: string;
  nombre_receptor: string;
  fecha_emision: string;
  fecha_certificacion: string;
  tipo_comprobante: string;
  efecto: string;
  total: number;
  subtotal: number;
  metodo_pago: string;
  forma_pago: string;
  moneda: string;
  estado: string;
  fecha_cancelacion: string | null;
  download_request_id: string;
  xml_storage_path: string | null;
  expense_id: string | null;
  iva_trasladado: number | null;
  isr_retenido: number | null;
  iva_retenido: number | null;
  ieps_trasladado: number | null;
  created_at: string;
}

export const satDescargaService = {
  async getConfigStatus(): Promise<SatConfigStatus> {
    return callEdgeFunction({ action: 'get-config-status' });
  },

  async validateFiel(cerFile: File, keyFile: File, password: string) {
    const cerBase64 = await fileToBase64(cerFile);
    const keyBase64 = await fileToBase64(keyFile);
    return callEdgeFunction({
      action: 'validate-fiel',
      cerBase64,
      keyBase64,
      password,
    });
  },

  async uploadEfirma(cerFile: File, keyFile: File, password: string, rfc: string, expiresAt?: string) {
    const timestamp = Date.now();
    const cerPath = `${rfc}/${timestamp}.cer`;
    const keyPath = `${rfc}/${timestamp}.key`;

    const { error: cerError } = await supabase.storage
      .from('sat-efirma')
      .upload(cerPath, cerFile, { upsert: true });
    if (cerError) throw new Error(`Error al subir archivo .cer: ${cerError.message}`);

    const { error: keyError } = await supabase.storage
      .from('sat-efirma')
      .upload(keyPath, keyFile, { upsert: true });
    if (keyError) throw new Error(`Error al subir archivo .key: ${keyError.message}`);

    // Deactivate any existing config
    await supabase
      .from('sat_efirma_config')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true);

    // Insert new config
    const { data, error } = await supabase
      .from('sat_efirma_config')
      .insert({
        rfc,
        cer_file_path: cerPath,
        key_file_path: keyPath,
        fiel_password: password,
        is_active: true,
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Error al guardar configuración: ${error.message}`);
    return data;
  },

  async deleteConfig() {
    const { error } = await supabase
      .from('sat_efirma_config')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true);
    if (error) throw new Error(`Error al eliminar configuración: ${error.message}`);
  },

  async submitQuery(
    dateStart: string,
    dateEnd: string,
    downloadType: 'emitidos' | 'recibidos' = 'emitidos',
    requestType: 'metadata' | 'xml' = 'metadata',
    documentStatus: 'active' | 'cancelled' | 'undefined' = 'undefined'
  ) {
    return callEdgeFunction({
      action: 'query',
      dateStart,
      dateEnd,
      downloadType,
      requestType,
      documentStatus,
    });
  },

  async verifyQuery(requestId: string) {
    return callEdgeFunction({
      action: 'verify',
      requestId,
    });
  },

  async downloadPackages(requestId: string, packageIds: string[]) {
    return callEdgeFunction({
      action: 'download',
      requestId,
      packageIds,
    });
  },

  async getDownloadRequests(): Promise<SatDownloadRequest[]> {
    const { data, error } = await supabase
      .from('sat_download_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getCfdis(filters?: {
    downloadRequestId?: string;
    rfcEmisor?: string;
    rfcReceptor?: string;
    tipoComprobante?: string;
    estado?: string;
    fechaInicio?: string;
    fechaFin?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: SatCfdi[]; count: number }> {
    const page = filters?.page || 0;
    const pageSize = filters?.pageSize || 50;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('sat_cfdis')
      .select('*', { count: 'exact' });

    if (filters?.downloadRequestId) {
      query = query.eq('download_request_id', filters.downloadRequestId);
    }
    if (filters?.rfcEmisor) {
      query = query.ilike('rfc_emisor', `%${filters.rfcEmisor}%`);
    }
    if (filters?.rfcReceptor) {
      query = query.ilike('rfc_receptor', `%${filters.rfcReceptor}%`);
    }
    if (filters?.tipoComprobante) {
      query = query.eq('tipo_comprobante', filters.tipoComprobante);
    }
    if (filters?.estado) {
      query = query.eq('estado', filters.estado);
    }
    if (filters?.fechaInicio) {
      query = query.gte('fecha_emision', filters.fechaInicio);
    }
    if (filters?.fechaFin) {
      query = query.lte('fecha_emision', filters.fechaFin);
    }

    const { data, error, count } = await query
      .order('fecha_emision', { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    return { data: data || [], count: count || 0 };
  },

  async getXmlContent(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('sat-efirma')
      .download(storagePath);
    if (error) throw new Error(error.message);
    return await data.text();
  },

  async downloadZip(requestId: string, packageId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    return callEdgeFunction({
      action: 'download-zip',
      requestId,
      packageId,
    });
  },

  async backfillTaxes(): Promise<{ success: boolean; updated: number; message: string }> {
    return callEdgeFunction({ action: 'backfill-taxes' });
  },

  async getCfdisByMonth(year: number, month: number): Promise<{ emitidos: SatCfdi[]; recibidos: SatCfdi[] }> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const { data, error } = await supabase
      .from('sat_cfdis')
      .select('*, sat_download_requests!inner(download_type)')
      .gte('fecha_emision', startDate)
      .lte('fecha_emision', endDate)
      .eq('estado', 'vigente')
      .order('fecha_emision', { ascending: true });

    if (error) throw new Error(error.message);

    const emitidos: SatCfdi[] = [];
    const recibidos: SatCfdi[] = [];

    for (const row of data || []) {
      const downloadType = (row as any).sat_download_requests?.download_type;
      const cfdi: SatCfdi = { ...row, sat_download_requests: undefined } as any;
      if (downloadType === 'emitidos') {
        emitidos.push(cfdi);
      } else {
        recibidos.push(cfdi);
      }
    }

    return { emitidos, recibidos };
  },

  async getAvailableMonths(): Promise<{ year: number; month: number }[]> {
    const { data, error } = await supabase
      .from('sat_cfdis')
      .select('fecha_emision')
      .not('fecha_emision', 'is', null)
      .order('fecha_emision', { ascending: false });

    if (error) throw new Error(error.message);

    const monthSet = new Set<string>();
    const months: { year: number; month: number }[] = [];

    for (const row of data || []) {
      const date = new Date(row.fecha_emision);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!monthSet.has(key)) {
        monthSet.add(key);
        months.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
      }
    }

    return months;
  },
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
