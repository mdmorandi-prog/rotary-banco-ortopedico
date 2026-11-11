// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - DATA LAYER TYPE DEFINITIONS
// Canonical domain types matching PostgreSQL enums, tables, and wizard schemas
// ==============================================================================

export type EquipmentCategory =
  | 'CADEIRA_RODAS'
  | 'CADEIRA_BANHO'
  | 'MULETA'
  | 'MULETA_AXILAR'
  | 'MULETA_CANADENSE'
  | 'ANDADOR'
  | 'CAMA_HOSPITALAR'
  | 'COLCHAO_PNEUMATICO'
  | 'SUPORTE_SORO'
  | 'OUTROS';

export type EquipmentStatus =
  | 'DISPONIVEL'
  | 'EMPRESTADO'
  | 'ATRASADO'
  | 'HIGIENIZACAO'
  | 'MANUTENCAO'
  | 'BAIXADO';

export type EquipmentCondition =
  | 'NOVO'
  | 'BOM'
  | 'REGULAR'
  | 'PRECISA_REPARO'
  | 'SUCATA'
  | 'SUCATEADO';

export type LoanStatus =
  | 'ATIVO'
  | 'RENOVADO'
  | 'ATRASADO'
  | 'DEVOLVIDO'
  | 'CANCELADO'
  | 'PERDIDO_EXTRAVIADO';

export type CloseReason =
  | 'RECUPERACAO_ALTA'
  | 'OBITO_PACIENTE'
  | 'COMPRA_PROPRIA'
  | 'TROCA_EQUIPAMENTO'
  | 'OUTROS'
  | 'DESISTENCIA';

export type UserRole = 'admin' | 'operator' | 'volunteer';

export type MaintenanceType =
  | 'HIGIENIZACAO'
  | 'MANUTENCAO_PREVENTIVA'
  | 'MANUTENCAO_CORRETIVA'
  | 'BAIXA';

export type LoanEventType =
  | 'CREATED'
  | 'RENEWED'
  | 'STATUS_CHANGE'
  | 'RETURNED'
  | 'OVERDUE_NOTIFICATION'
  | 'QUITTANCE_ISSUED';

// ------------------------------------------------------------------------------
// Core Domain Entities
// ------------------------------------------------------------------------------

export interface Equipment {
  id: string;
  patrimony_code: string;
  qr_token: string;
  category: EquipmentCategory;
  name: string;
  model_description?: string;
  brand_model?: string;
  serial_number?: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  replacement_value: number; // Value in BRL, mandatory for CCB Art. 582
  acquisition_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Beneficiary {
  id: string;
  full_name: string;
  cpf: string;
  rg?: string;
  phone: string;
  email?: string;
  birth_date?: string;
  
  // Address
  address_street: string;
  address_number: string;
  address_complement?: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zipcode: string;
  address_cep?: string;

  // Patient vs Responsible qualification
  is_patient_same_as_responsible?: boolean;
  patient_name?: string;
  patient_cpf?: string;
  patient_rg?: string;
  patient_relationship?: string;
  patient_condition_notes?: string;

  // Mandatory Secondary Contact (Civil Code Art. 585 & Emergency Retrieval)
  secondary_name: string;
  secondary_relationship: string;
  secondary_phone: string;
  secondary_contact_name?: string;
  secondary_contact_relationship?: string;
  secondary_contact_phone?: string;

  // Attachments
  document_photo_url?: string;
  proof_of_residence_url?: string;
  notes?: string;

  // Geographic coordinates for Map & Field Retrieval
  lat?: number;
  lng?: number;

  created_at: string;
  updated_at?: string;
}

export interface Loan {
  id: string;
  loan_code: string;
  equipment_id: string;
  beneficiary_id: string;
  loan_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  status: LoanStatus;
  renewal_count: number;
  max_renewals: number;
  magic_token: string;
  notes?: string;

  // Comodato Legal & Monetary Fields (CCB Arts. 579-585)
  replacement_value: number;
  signature_url?: string;
  signature_image_url?: string;
  contract_pdf_url?: string;
  witness_name?: string;
  witness_document?: string;

  // Return Triage & Discharge Receipt
  return_condition?: EquipmentCondition;
  close_reason?: CloseReason;
  post_return_destination?: EquipmentStatus;
  return_notes?: string;
  quittance_issued?: boolean;
  quittance_issued_at?: string;
  discharge_receipt_url?: string;

  // Geographic coordinates & GPS Check-in Audit
  lat?: number;
  lng?: number;
  last_gps_at?: string;
  last_gps_accuracy?: number;

  created_by?: string;
  created_at: string;
  updated_at: string;

  // Expanded relations (hydrated by repository)
  equipment?: Equipment;
  beneficiary?: Beneficiary;
}

export interface LoanEventLog {
  id: string;
  loan_id: string;
  event_type: LoanEventType;
  old_status?: LoanStatus;
  new_status?: LoanStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
  performed_by?: string;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  equipment_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  cost: number;
  technician_name?: string;
  completed_at?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  rotary_club: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// Repository Input / Output / Filter Interfaces
// ------------------------------------------------------------------------------

export interface EquipmentFilter {
  status?: EquipmentStatus;
  category?: EquipmentCategory;
  search?: string;
}

export interface LoanFilter {
  status?: LoanStatus;
  search?: string;
}

export interface CreateLoanInput {
  equipment_id: string;
  beneficiary: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>;
  term_days: number;
  signature_data_url: string;
  document_urls?: string[];
  notes?: string;
}

export interface ReturnLoanInput {
  condition: EquipmentCondition;
  close_reason: CloseReason;
  destination: EquipmentStatus;
  notes?: string;
  receipt_signature_url?: string;
}

export interface RenewLoanResult {
  success: boolean;
  loan?: Loan;
  message?: string;
  already_renewed?: boolean;
  max_reached?: boolean;
}

export interface ReturnLoanResult {
  success: boolean;
  loan: Loan;
  discharge_receipt_url?: string;
  message?: string;
}

export interface DashboardMetrics {
  totalEquipments: number;
  availableCount: number;
  loanedCount: number;
  overdueCount: number;
  maintenanceCount: number;
  totalBeneficiaries: number;
  valueAtRisk: number; // Sum of replacement_value of loaned + overdue items in BRL
  expiringIn7DaysCount: number;
}

export interface IDataRepository {
  // Equipments
  getEquipments(filters?: EquipmentFilter): Promise<Equipment[]>;
  getEquipmentById(id: string): Promise<Equipment | null>;
  getEquipmentByQrToken(qr_token: string): Promise<Equipment | null>;
  createEquipment(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment>;
  updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment>;

  // Beneficiaries
  getBeneficiaries(search?: string): Promise<Beneficiary[]>;
  getBeneficiaryById(id: string): Promise<Beneficiary | null>;
  getBeneficiaryByCpf(cpf: string): Promise<Beneficiary | null>;
  createBeneficiary(data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>): Promise<Beneficiary>;

  // Loans
  getLoans(filters?: LoanFilter): Promise<Loan[]>;
  getLoanById(id: string): Promise<Loan | null>;
  getLoanByMagicToken(magic_token: string): Promise<Loan | null>;
  getActiveLoanByEquipmentId(equipment_id: string): Promise<Loan | null>;
  createLoan(data: CreateLoanInput): Promise<Loan>;
  renewLoan(magic_token: string): Promise<RenewLoanResult>;
  notifyReturnIntent(
    magic_token: string,
    intent: 'SEDE' | 'COLETA',
    notes?: string
  ): Promise<{ success: boolean; message: string; loan?: Loan }>;
  returnLoan(loan_id: string, triage: ReturnLoanInput): Promise<ReturnLoanResult>;
  updateLoanGps(loan_id: string, lat: number, lng: number, accuracy?: number): Promise<boolean>;

  // Metrics & State Machine Transitions
  getDashboardMetrics(): Promise<DashboardMetrics>;
  releaseEquipment(equipment_id: string, destination: EquipmentStatus, notes?: string): Promise<Equipment>;

  // Audit Events
  getLoanEvents(loan_id: string): Promise<LoanEventLog[]>;
  addLoanEvent(event: Omit<LoanEventLog, 'id' | 'created_at'>): Promise<LoanEventLog>;

  // Demo state management
  resetDemoData?(): Promise<void>;
}

