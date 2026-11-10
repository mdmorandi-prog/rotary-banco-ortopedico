// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - SMART LOCAL DEMO STORE
// In-memory + LocalStorage backing store implementing IDataRepository with
// relational hydration, simulated triggers, search, renewal, and return triage.
// ==============================================================================

import {
  Equipment,
  Beneficiary,
  Loan,
  LoanEventLog,
  EquipmentFilter,
  LoanFilter,
  CreateLoanInput,
  ReturnLoanInput,
  RenewLoanResult,
  ReturnLoanResult,
  DashboardMetrics,
  EquipmentStatus,
  IDataRepository,
} from '../data-layer/types';
import {
  initialMockEquipments,
  initialMockBeneficiaries,
  initialMockLoans,
  initialMockEvents,
} from './mock-data';

const STORAGE_KEYS = {
  EQUIPMENTS: 'rotary_demo_equipments',
  BENEFICIARIES: 'rotary_demo_beneficiaries',
  LOANS: 'rotary_demo_loans',
  EVENTS: 'rotary_demo_events',
};

export class LocalStore implements IDataRepository {
  private equipments: Equipment[] = [];
  private beneficiaries: Beneficiary[] = [];
  private loans: Loan[] = [];
  private events: LoanEventLog[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private init(): void {
    if (this.initialized) return;

    if (!this.isBrowser()) {
      // In server-side rendering, hydrate from initial mock datasets
      this.equipments = JSON.parse(JSON.stringify(initialMockEquipments));
      this.beneficiaries = JSON.parse(JSON.stringify(initialMockBeneficiaries));
      this.loans = JSON.parse(JSON.stringify(initialMockLoans));
      this.events = JSON.parse(JSON.stringify(initialMockEvents));
      this.initialized = true;
      return;
    }

    try {
      const eqRaw = localStorage.getItem(STORAGE_KEYS.EQUIPMENTS);
      const benRaw = localStorage.getItem(STORAGE_KEYS.BENEFICIARIES);
      const loanRaw = localStorage.getItem(STORAGE_KEYS.LOANS);
      const evtRaw = localStorage.getItem(STORAGE_KEYS.EVENTS);

      this.equipments = eqRaw ? JSON.parse(eqRaw) : JSON.parse(JSON.stringify(initialMockEquipments));
      this.beneficiaries = benRaw ? JSON.parse(benRaw) : JSON.parse(JSON.stringify(initialMockBeneficiaries));
      this.loans = loanRaw ? JSON.parse(loanRaw) : JSON.parse(JSON.stringify(initialMockLoans));
      this.events = evtRaw ? JSON.parse(evtRaw) : JSON.parse(JSON.stringify(initialMockEvents));

      // Save initial state if first visit
      if (!eqRaw) this.persist();
      this.initialized = true;
    } catch (e) {
      console.warn('Rotary LocalStore: Failed to read from localStorage, using in-memory fallbacks', e);
      this.equipments = JSON.parse(JSON.stringify(initialMockEquipments));
      this.beneficiaries = JSON.parse(JSON.stringify(initialMockBeneficiaries));
      this.loans = JSON.parse(JSON.stringify(initialMockLoans));
      this.events = JSON.parse(JSON.stringify(initialMockEvents));
      this.initialized = true;
    }
  }

  private persist(): void {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.EQUIPMENTS, JSON.stringify(this.equipments));
      localStorage.setItem(STORAGE_KEYS.BENEFICIARIES, JSON.stringify(this.beneficiaries));
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(this.loans));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(this.events));
    } catch (e) {
      console.error('Rotary LocalStore: Failed to persist to localStorage', e);
    }
  }

  public resetToInitialSeed(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(STORAGE_KEYS.EQUIPMENTS);
      localStorage.removeItem(STORAGE_KEYS.BENEFICIARIES);
      localStorage.removeItem(STORAGE_KEYS.LOANS);
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
    }
    this.equipments = JSON.parse(JSON.stringify(initialMockEquipments));
    this.beneficiaries = JSON.parse(JSON.stringify(initialMockBeneficiaries));
    this.loans = JSON.parse(JSON.stringify(initialMockLoans));
    this.events = JSON.parse(JSON.stringify(initialMockEvents));
    this.persist();
  }

  // ----------------------------------------------------------------------------
  // Equipment Operations
  // ----------------------------------------------------------------------------

  async getEquipments(filters?: EquipmentFilter): Promise<Equipment[]> {
    this.init();
    let result = [...this.equipments];

    if (filters) {
      if (filters.status) {
        result = result.filter((item) => item.status === filters.status);
      }
      if (filters.category) {
        result = result.filter((item) => item.category === filters.category);
      }
      if (filters.search && filters.search.trim() !== '') {
        const query = filters.search.toLowerCase().trim();
        result = result.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.patrimony_code.toLowerCase().includes(query) ||
            (item.brand_model && item.brand_model.toLowerCase().includes(query)) ||
            (item.serial_number && item.serial_number.toLowerCase().includes(query))
        );
      }
    }

    return result.sort((a, b) => a.patrimony_code.localeCompare(b.patrimony_code));
  }

  async getEquipmentById(id: string): Promise<Equipment | null> {
    this.init();
    return this.equipments.find((item) => item.id === id) || null;
  }

  async getEquipmentByQrToken(qr_token: string): Promise<Equipment | null> {
    this.init();
    const tokenClean = qr_token.trim().toLowerCase();
    return (
      this.equipments.find(
        (item) =>
          item.qr_token.toLowerCase() === tokenClean ||
          item.patrimony_code.toLowerCase() === tokenClean
      ) || null
    );
  }

  async createEquipment(data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>): Promise<Equipment> {
    this.init();
    const now = new Date().toISOString();
    const id = `eq-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
    const qr_token = data.qr_token || `rotary-item-${data.patrimony_code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const newEquipment: Equipment = {
      ...data,
      id,
      qr_token,
      created_at: now,
      updated_at: now,
    };

    this.equipments.unshift(newEquipment);
    this.persist();
    return newEquipment;
  }

  async updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment> {
    this.init();
    const idx = this.equipments.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Equipamento com ID ${id} não encontrado.`);

    const updated: Equipment = {
      ...this.equipments[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };

    this.equipments[idx] = updated;
    this.persist();
    return updated;
  }

  // ----------------------------------------------------------------------------
  // Beneficiary Operations
  // ----------------------------------------------------------------------------

  async getBeneficiaries(search?: string): Promise<Beneficiary[]> {
    this.init();
    let result = [...this.beneficiaries];
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.full_name.toLowerCase().includes(q) ||
          b.cpf.includes(q) ||
          b.phone.includes(q) ||
          b.secondary_name.toLowerCase().includes(q)
      );
    }
    return result;
  }

  async getBeneficiaryById(id: string): Promise<Beneficiary | null> {
    this.init();
    return this.beneficiaries.find((b) => b.id === id) || null;
  }

  async getBeneficiaryByCpf(cpf: string): Promise<Beneficiary | null> {
    this.init();
    const clean = cpf.replace(/[^\d]/g, '');
    return (
      this.beneficiaries.find((b) => b.cpf.replace(/[^\d]/g, '') === clean) || null
    );
  }

  async createBeneficiary(data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>): Promise<Beneficiary> {
    this.init();
    const existing = await this.getBeneficiaryByCpf(data.cpf);
    if (existing) {
      // Update existing record
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      const idx = this.beneficiaries.findIndex((b) => b.id === existing.id);
      this.beneficiaries[idx] = updated;
      this.persist();
      return updated;
    }

    const now = new Date().toISOString();
    const id = `ben-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
    const newBeneficiary: Beneficiary = {
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    this.beneficiaries.push(newBeneficiary);
    this.persist();
    return newBeneficiary;
  }

  // ----------------------------------------------------------------------------
  // Loan Operations
  // ----------------------------------------------------------------------------

  private hydrateLoan(loan: Loan): Loan {
    const equipment = this.equipments.find((e) => e.id === loan.equipment_id);
    const beneficiary = this.beneficiaries.find((b) => b.id === loan.beneficiary_id);
    return {
      ...loan,
      equipment,
      beneficiary,
    };
  }

  async getLoans(filters?: LoanFilter): Promise<Loan[]> {
    this.init();
    let result = this.loans.map((l) => this.hydrateLoan(l));

    if (filters) {
      if (filters.status) {
        result = result.filter((l) => l.status === filters.status);
      }
      if (filters.search && filters.search.trim() !== '') {
        const q = filters.search.toLowerCase().trim();
        result = result.filter(
          (l) =>
            l.loan_code.toLowerCase().includes(q) ||
            (l.beneficiary && l.beneficiary.full_name.toLowerCase().includes(q)) ||
            (l.beneficiary && l.beneficiary.cpf.includes(q)) ||
            (l.equipment && l.equipment.patrimony_code.toLowerCase().includes(q)) ||
            (l.equipment && l.equipment.name.toLowerCase().includes(q))
        );
      }
    }

    // Sort by expected_return_date ascending for overdue attention
    return result.sort((a, b) => new Date(a.expected_return_date).getTime() - new Date(b.expected_return_date).getTime());
  }

  async getLoanById(id: string): Promise<Loan | null> {
    this.init();
    const loan = this.loans.find((l) => l.id === id);
    if (!loan) return null;
    return this.hydrateLoan(loan);
  }

  async getLoanByMagicToken(magic_token: string): Promise<Loan | null> {
    this.init();
    const tokenClean = magic_token.trim().toLowerCase();
    const loan = this.loans.find((l) => l.magic_token.toLowerCase() === tokenClean);
    if (!loan) return null;
    return this.hydrateLoan(loan);
  }

  async getActiveLoanByEquipmentId(equipment_id: string): Promise<Loan | null> {
    this.init();
    const loan = this.loans.find(
      (l) => l.equipment_id === equipment_id && (l.status === 'ATIVO' || l.status === 'ATRASADO' || l.status === 'RENOVADO')
    );
    if (!loan) return null;
    return this.hydrateLoan(loan);
  }

  async createLoan(data: CreateLoanInput): Promise<Loan> {
    this.init();
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Verify equipment availability
    const equipment = this.equipments.find((e) => e.id === data.equipment_id);
    if (!equipment) {
      throw new Error('Equipamento não encontrado.');
    }
    if (equipment.status !== 'DISPONIVEL') {
      throw new Error(`Equipamento ${equipment.patrimony_code} não está DISPONÍVEL (Status atual: ${equipment.status}).`);
    }

    // 2. Upsert Beneficiary with mandatory secondary contact
    const beneficiary = await this.createBeneficiary(data.beneficiary);

    // 3. Compute expected return date
    const expectedReturn = new Date(now.getTime() + data.term_days * 24 * 60 * 60 * 1000);

    // 4. Generate unique identifiers
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const loan_code = `EMP-${now.getFullYear()}-${randomSuffix}`;
    const magic_token = `renovar-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)}`;
    const loan_id = `loan-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;

    // 5. Create Loan Record
    const newLoan: Loan = {
      id: loan_id,
      loan_code,
      equipment_id: equipment.id,
      beneficiary_id: beneficiary.id,
      loan_date: nowIso,
      expected_return_date: expectedReturn.toISOString(),
      status: 'ATIVO',
      renewal_count: 0,
      max_renewals: 3,
      magic_token,
      replacement_value: equipment.replacement_value,
      signature_url: data.signature_data_url,
      notes: data.notes || '',
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 6. Simulate Database Trigger: Equipment transitions to EMPRESTADO
    equipment.status = 'EMPRESTADO';
    equipment.updated_at = nowIso;

    // 7. Audit Log Event
    const event: LoanEventLog = {
      id: `evt-${Date.now()}`,
      loan_id: newLoan.id,
      event_type: 'CREATED',
      new_status: 'ATIVO',
      notes: `Empréstimo ${loan_code} gerado com prazo de ${data.term_days} dias.`,
      created_at: nowIso,
    };

    this.loans.unshift(newLoan);
    this.events.unshift(event);
    this.persist();

    return this.hydrateLoan(newLoan);
  }

  async renewLoan(magic_token: string): Promise<RenewLoanResult> {
    this.init();
    const loan = this.loans.find((l) => l.magic_token === magic_token.trim());
    if (!loan) {
      return { success: false, message: 'Token de renovação inválido ou expirado.' };
    }

    if (loan.status === 'DEVOLVIDO' || loan.status === 'CANCELADO') {
      return { success: false, message: 'Este empréstimo já foi encerrado e não pode ser renovado.' };
    }

    if (loan.renewal_count >= loan.max_renewals) {
      return {
        success: false,
        max_reached: true,
        message: `Limite de renovações atingido (${loan.max_renewals} renovações). Por favor, entre em contato com o Rotary para avaliação presencial do item.`,
      };
    }

    const now = new Date();
    const currentExpected = new Date(loan.expected_return_date);
    // If already overdue, extend 30 days from today; if still active, extend 30 days from expected_return_date
    const baseDate = currentExpected > now ? currentExpected : now;
    const newExpected = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const nowIso = now.toISOString();
    loan.expected_return_date = newExpected.toISOString();
    loan.renewal_count += 1;
    loan.status = 'ATIVO'; // Reset to active if was overdue
    loan.updated_at = nowIso;

    // Synchronize equipment status
    const eq = this.equipments.find((e) => e.id === loan.equipment_id);
    if (eq && eq.status === 'ATRASADO') {
      eq.status = 'EMPRESTADO';
      eq.updated_at = nowIso;
    }

    // Event Log
    this.events.unshift({
      id: `evt-${Date.now()}`,
      loan_id: loan.id,
      event_type: 'RENEWED',
      new_status: 'ATIVO',
      notes: `Renovação #${loan.renewal_count} realizada via portal self-service (+30 dias até ${newExpected.toLocaleDateString('pt-BR')}).`,
      created_at: nowIso,
    });

    this.persist();

    return {
      success: true,
      loan: this.hydrateLoan(loan),
      message: `Empréstimo renovado com sucesso por mais 30 dias! Nova data de retorno: ${newExpected.toLocaleDateString('pt-BR')}.`,
    };
  }

  async returnLoan(loan_id: string, triage: ReturnLoanInput): Promise<ReturnLoanResult> {
    this.init();
    const loan = this.loans.find((l) => l.id === loan_id);
    if (!loan) {
      throw new Error(`Empréstimo ${loan_id} não encontrado.`);
    }

    const nowIso = new Date().toISOString();

    // 1. Update Loan status and triage results
    loan.status = 'DEVOLVIDO';
    loan.actual_return_date = nowIso;
    loan.return_condition = triage.condition;
    loan.close_reason = triage.close_reason;
    loan.post_return_destination = triage.destination;
    loan.return_notes = triage.notes || '';
    loan.quittance_issued = true;
    loan.quittance_issued_at = nowIso;
    loan.discharge_receipt_url = `/loans/${loan.id}/receipt`;
    loan.updated_at = nowIso;

    // 2. Simulate Database Trigger: Equipment status and condition transition
    const equipment = this.equipments.find((e) => e.id === loan.equipment_id);
    if (equipment) {
      equipment.status = triage.destination; // HIGIENIZACAO, DISPONIVEL, or MANUTENCAO
      equipment.condition = triage.condition;
      equipment.updated_at = nowIso;
    }

    // 3. Log Return Event
    this.events.unshift({
      id: `evt-${Date.now()}`,
      loan_id: loan.id,
      event_type: 'RETURNED',
      new_status: 'DEVOLVIDO',
      notes: `Devolução concluída. Motivo: ${triage.close_reason}. Condição: ${triage.condition}. Destino do equipamento: ${triage.destination}.`,
      created_at: nowIso,
    });

    this.persist();

    return {
      success: true,
      loan: this.hydrateLoan(loan),
      discharge_receipt_url: loan.discharge_receipt_url,
      message: 'Devolução registrada e termo de quitação emitido com sucesso.',
    };
  }

  // ----------------------------------------------------------------------------
  // Equipment Lifecycle / Maintenance Release
  // ----------------------------------------------------------------------------

  async releaseEquipment(equipment_id: string, destination: EquipmentStatus, notes?: string): Promise<Equipment> {
    this.init();
    const eq = this.equipments.find((e) => e.id === equipment_id);
    if (!eq) throw new Error('Equipamento não encontrado.');

    const nowIso = new Date().toISOString();
    eq.status = destination;
    eq.updated_at = nowIso;
    if (notes) {
      eq.notes = `${eq.notes ? eq.notes + ' | ' : ''}${new Date().toLocaleDateString('pt-BR')}: ${notes}`;
    }

    this.persist();
    return eq;
  }

  // ----------------------------------------------------------------------------
  // Dashboard Metrics Computation
  // ----------------------------------------------------------------------------

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    this.init();
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const totalEquipments = this.equipments.length;
    const availableCount = this.equipments.filter((e) => e.status === 'DISPONIVEL').length;
    const loanedCount = this.equipments.filter((e) => e.status === 'EMPRESTADO').length;
    const overdueCount = this.loans.filter((l) => l.status === 'ATRASADO').length;
    const maintenanceCount = this.equipments.filter(
      (e) => e.status === 'MANUTENCAO' || e.status === 'HIGIENIZACAO'
    ).length;

    const totalBeneficiaries = this.beneficiaries.length;

    // Value at risk = replacement value of all currently loaned and overdue equipment
    const activeLoanEquipmentIds = new Set(
      this.loans
        .filter((l) => l.status === 'ATIVO' || l.status === 'ATRASADO' || l.status === 'RENOVADO')
        .map((l) => l.equipment_id)
    );

    const valueAtRisk = this.equipments
      .filter((e) => activeLoanEquipmentIds.has(e.id))
      .reduce((sum, item) => sum + item.replacement_value, 0);

    // Expiring in next 7 days
    const expiringIn7DaysCount = this.loans.filter((l) => {
      if (l.status !== 'ATIVO' && l.status !== 'RENOVADO') return false;
      const expected = new Date(l.expected_return_date);
      return expected >= now && expected <= in7Days;
    }).length;

    return {
      totalEquipments,
      availableCount,
      loanedCount,
      overdueCount,
      maintenanceCount,
      totalBeneficiaries,
      valueAtRisk,
      expiringIn7DaysCount,
    };
  }

  // ----------------------------------------------------------------------------
  // Audit Logs
  // ----------------------------------------------------------------------------

  async getLoanEvents(loan_id: string): Promise<LoanEventLog[]> {
    this.init();
    return this.events.filter((e) => e.loan_id === loan_id);
  }

  async addLoanEvent(event: Omit<LoanEventLog, 'id' | 'created_at'>): Promise<LoanEventLog> {
    this.init();
    const newEvt: LoanEventLog = {
      ...event,
      id: `evt-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.events.unshift(newEvt);
    this.persist();
    return newEvt;
  }
}

export const localStore = new LocalStore();
