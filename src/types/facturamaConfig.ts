export interface FacturamaConfig {
  id: string;
  username: string;
  password: string;
  environment: 'sandbox' | 'production';
  issuer_rfc: string;
  issuer_name: string;
  issuer_tax_regime: string;
  issuer_street: string;
  issuer_exterior_number: string;
  issuer_interior_number: string;
  issuer_neighborhood: string;
  issuer_municipality: string;
  issuer_state: string;
  issuer_postal_code: string;
  default_product_key: string;
  default_unit_key: string;
  default_unit_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacturamaConfigForm {
  username: string;
  password: string;
  environment: 'sandbox' | 'production';
  issuer_rfc: string;
  issuer_name: string;
  issuer_tax_regime: string;
  issuer_street: string;
  issuer_exterior_number: string;
  issuer_interior_number: string;
  issuer_neighborhood: string;
  issuer_municipality: string;
  issuer_state: string;
  issuer_postal_code: string;
  default_product_key: string;
  default_unit_key: string;
  default_unit_name: string;
}

// SAT Tax Regime catalog
export const SAT_TAX_REGIMES = [
  { key: '601', label: '601 - General de Ley Personas Morales' },
  { key: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { key: '605', label: '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { key: '606', label: '606 - Arrendamiento' },
  { key: '607', label: '607 - Régimen de Enajenación o Adquisición de Bienes' },
  { key: '608', label: '608 - Demás ingresos' },
  { key: '609', label: '609 - Consolidación' },
  { key: '610', label: '610 - Residentes en el Extranjero sin Establecimiento Permanente en México' },
  { key: '611', label: '611 - Ingresos por Dividendos (socios y accionistas)' },
  { key: '612', label: '612 - Personas Físicas con Actividades Empresariales y Profesionales' },
  { key: '614', label: '614 - Ingresos por intereses' },
  { key: '615', label: '615 - Régimen de los ingresos por obtención de premios' },
  { key: '616', label: '616 - Sin obligaciones fiscales' },
  { key: '620', label: '620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos' },
  { key: '621', label: '621 - Incorporación Fiscal' },
  { key: '622', label: '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { key: '623', label: '623 - Opcional para Grupos de Sociedades' },
  { key: '624', label: '624 - Coordinados' },
  { key: '625', label: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { key: '626', label: '626 - Régimen Simplificado de Confianza' },
];

// SAT CFDI Use catalog
export const SAT_CFDI_USES = [
  { key: 'G01', label: 'G01 - Adquisición de mercancias' },
  { key: 'G02', label: 'G02 - Devoluciones, descuentos o bonificaciones' },
  { key: 'G03', label: 'G03 - Gastos en general' },
  { key: 'I01', label: 'I01 - Construcciones' },
  { key: 'I02', label: 'I02 - Mobilario y equipo de oficina por inversiones' },
  { key: 'I03', label: 'I03 - Equipo de transporte' },
  { key: 'I04', label: 'I04 - Equipo de computo y accesorios' },
  { key: 'I05', label: 'I05 - Dados, troqueles, moldes, matrices y herramental' },
  { key: 'I06', label: 'I06 - Comunicaciones telefónicas' },
  { key: 'I07', label: 'I07 - Comunicaciones satelitales' },
  { key: 'I08', label: 'I08 - Otra maquinaria y equipo' },
  { key: 'D01', label: 'D01 - Honorarios médicos, dentales y gastos hospitalarios' },
  { key: 'D02', label: 'D02 - Gastos médicos por incapacidad o discapacidad' },
  { key: 'D03', label: 'D03 - Gastos funerales' },
  { key: 'D04', label: 'D04 - Donativos' },
  { key: 'D05', label: 'D05 - Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)' },
  { key: 'D06', label: 'D06 - Aportaciones voluntarias al SAR' },
  { key: 'D07', label: 'D07 - Primas por seguros de gastos médicos' },
  { key: 'D08', label: 'D08 - Gastos de transportación escolar obligatoria' },
  { key: 'D09', label: 'D09 - Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones' },
  { key: 'D10', label: 'D10 - Pagos por servicios educativos (colegiaturas)' },
  { key: 'P01', label: 'P01 - Por definir' },
  { key: 'S01', label: 'S01 - Sin efectos fiscales' },
  { key: 'CP01', label: 'CP01 - Pagos' },
  { key: 'CN01', label: 'CN01 - Nómina' },
];

// SAT compatibility matrix: maps each fiscal regime to its valid CFDI use codes
// Source: SAT catalog c_UsoCFDI cross-referenced with c_RegimenFiscal
export const SAT_REGIME_CFDI_USE_COMPAT: Record<string, string[]> = {
  '601': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '603': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '605': ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CN01', 'CP01'],
  '606': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '607': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '608': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '609': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '610': ['S01', 'CP01'],
  '611': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '612': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '614': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '615': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '616': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '620': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '621': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '622': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '623': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '624': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'S01', 'CP01'],
  '625': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
  '626': ['G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'S01', 'CP01'],
};

export function getCompatibleCfdiUses(taxRegime: string) {
  const regimeCode = taxRegime.split(' ')[0].trim();
  const compatible = SAT_REGIME_CFDI_USE_COMPAT[regimeCode];
  if (!compatible) return SAT_CFDI_USES;
  return SAT_CFDI_USES.filter(u => compatible.includes(u.key));
}

export function isCfdiUseCompatible(taxRegime: string, cfdiUse: string): boolean {
  if (!taxRegime || !cfdiUse) return true;
  const regimeCode = taxRegime.split(' ')[0].trim();
  const compatible = SAT_REGIME_CFDI_USE_COMPAT[regimeCode];
  if (!compatible) return true;
  return compatible.includes(cfdiUse);
}

// Facturama API request/response types
export interface FacturamaTax {
  Total: number;
  Name: string;
  Base: number;
  Rate: number;
  IsRetention: boolean;
  IsQuota?: boolean;
  TaxObject?: string;
}

export interface FacturamaItem {
  ProductCode: string;
  IdentificationNumber?: string;
  Description: string;
  Unit: string;
  UnitCode: string;
  UnitPrice: number;
  Quantity: number;
  Subtotal: number;
  Discount?: number;
  TaxObject: string;
  Taxes: FacturamaTax[];
  Total: number;
}

export interface FacturamaNameId {
  Id: string;
  Name: string;
}

export interface FacturamaTaxEntityAddress {
  Street?: string;
  ExteriorNumber?: string;
  InteriorNumber?: string;
  Neighborhood?: string;
  ZipCode: string;
  Municipality?: string;
  State?: string;
  Country?: string;
}

export interface FacturamaIssuer {
  FiscalRegime: string;
  Rfc: string;
  Name: string;
  Address?: FacturamaTaxEntityAddress;
}

export interface FacturamaReceiver {
  Rfc: string;
  Name: string;
  CfdiUse: string;
  FiscalRegime: string;
  TaxZipCode: string;
}

export interface FacturamaGlobalInformation {
  Periodicity: string;
  Months: string;
  Year: string;
}

export interface FacturamaRelation {
  Type: string;
  Cfdis: { Uuid: string }[];
}

export interface FacturamaCfdiRequest {
  Issuer?: FacturamaIssuer;
  Receiver: FacturamaReceiver;
  CfdiType: string;
  NameId: string;
  PaymentForm: string;
  PaymentMethod: string;
  Currency: string;
  ExpeditionPlace: string;
  Exportation: string;
  Date?: string;
  Serie?: string;
  Folio?: string;
  GlobalInformation?: FacturamaGlobalInformation;
  Relations?: FacturamaRelation;
  Items: FacturamaItem[];
}

export interface FacturamaCfdiResponse {
  Id: string;
  CfdiType: string;
  Type: string;
  Serie?: string;
  Folio?: string;
  Date: string;
  CertNumber: string;
  PaymentTerms?: string;
  PaymentConditions?: string;
  Currency: string;
  SubTotal: number;
  Discount?: number;
  Total: number;
  Observations?: string;
  Issuer: FacturamaIssuer;
  Receiver: FacturamaReceiver;
  Items: FacturamaItem[];
  Complement?: { TaxStamp?: { Uuid: string; Date: string; SatCertNumber: string; SatSign: string; CfdiSign: string } };
  Status: string;
  OriginalString?: string;
}

export interface FacturamaErrorResponse {
  Details?: Record<string, string[]>;
  Message?: string;
  ModelState?: Record<string, string[]>;
}
