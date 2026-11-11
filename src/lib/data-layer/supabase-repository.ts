// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - PRODUCTION SUPABASE REPOSITORY
// Real PostgreSQL + Storage implementation of IDataRepository with automatic
// schema normalization and graceful fallback to LocalStore if offline.
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
} from './types';
import { getSupabaseClient, DEFAULT_STORAGE_BUCKET } from './supabase-client';
import { localStore } from '../mock-store/local-store';

/**
 * Normalizes a Beneficiary row from Supabase (`secondary_contact_*`, `address_cep`)
 * to the canonical frontend `Beneficiary` interface.
 */
function mapBeneficiaryFromDb(row: Record<string, any>): Beneficiary {
  return {
    id: row.id,
    full_name: row.full_name,
    cpf: row.cpf,
    rg: row.rg || undefined,
    phone: row.phone,
    email: row.email || undefined,
    birth_date: row.birth_date || undefined,
    address_street: row.address_street || '',
    address_number: row.address_number || '',
    address_complement: row.address_complement || undefined,
    address_neighborhood: row.address_neighborhood || '',
    address_city: row.address_city || '',
    address_state: row.address_state || 'RS',
    address_zipcode: row.address_cep || row.address_zipcode || '',
    address_cep: row.address_cep || row.address_zipcode || '',
    is_patient_same_as_responsible: row.is_patient_same_as_responsible ?? true,
    patient_name: row.patient_name || undefined,
    patient_cpf: row.patient_cpf || undefined,
    patient_rg: row.patient_rg || undefined,
    patient_relationship: row.patient_relationship || undefined,
    patient_condition_notes: row.patient_condition_notes || undefined,
    secondary_name: row.secondary_contact_name || row.secondary_name || '',
    secondary_relationship: row.secondary_contact_relationship || row.secondary_relationship || '',
    secondary_phone: row.secondary_contact_phone || row.secondary_phone || '',
    secondary_contact_name: row.secondary_contact_name || row.secondary_name || '',
    secondary_contact_relationship: row.secondary_contact_relationship || row.secondary_relationship || '',
    secondary_contact_phone: row.secondary_contact_phone || row.secondary_phone || '',
    document_photo_url: row.document_photo_url || undefined,
    proof_of_residence_url: row.proof_of_residence_url || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Normalizes a Loan row (with joined `equipments` and `beneficiaries`) from Supabase.
 */
function mapLoanFromDb(row: Record<string, any>): Loan {
  const equipmentRaw = row.equipments || row.equipment;
  const beneficiaryRaw = row.beneficiaries || row.beneficiary;

  return {
    id: row.id,
    loan_code: row.loan_code,
    equipment_id: row.equipment_id,
    beneficiary_id: row.beneficiary_id,
    loan_date: row.loan_date,
    expected_return_date: row.expected_return_date,
    actual_return_date: row.actual_return_date || undefined,
    status: row.status,
    renewal_count: Number(row.renewal_count ?? 0),
    max_renewals: Number(row.max_renewals ?? 3),
    magic_token: row.magic_token,
    notes: row.notes || undefined,
    replacement_value: Number(row.replacement_value ?? 0),
    signature_url: row.signature_image_url || row.signature_url || undefined,
    signature_image_url: row.signature_image_url || row.signature_url || undefined,
    contract_pdf_url: row.contract_pdf_url || undefined,
    witness_name: row.witness_name || undefined,
    witness_document: row.witness_document || undefined,
    return_condition: row.return_condition || undefined,
    close_reason: row.close_reason || undefined,
    post_return_destination: row.post_return_destination || undefined,
    return_notes: row.return_notes || undefined,
    quittance_issued: Boolean(row.quittance_issued),
    quittance_issued_at: row.quittance_issued_at || undefined,
    discharge_receipt_url: row.quittance_issued ? `/loans/${row.id}/receipt` : undefined,
    created_by: row.created_by || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    equipment: equipmentRaw
      ? {
          ...equipmentRaw,
          replacement_value: Number(equipmentRaw.replacement_value ?? 0),
        }
      : undefined,
    beneficiary: beneficiaryRaw ? mapBeneficiaryFromDb(beneficiaryRaw) : undefined,
  };
}

/**
 * Uploads a Base64 Data URL image (document photo or signature) to Supabase Storage
 * (`orthopedic-bank` bucket) if possible, or returns the Data URL directly if bucket
 * is not public/created yet.
 */
async function uploadDataUrlToStorage(
  dataUrl: string,
  folder: string,
  filePrefix: string
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  try {
    const supabase = getSupabaseClient();
    const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) return dataUrl;

    const mimeType = matches[1];
    const base64Data = matches[2];
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('svg') ? 'svg' : 'jpg';
    const filePath = `${folder}/${filePrefix}-${Date.now()}.${ext}`;

    const binaryStr = typeof atob === 'function' ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error } = await supabase.storage
      .from(DEFAULT_STORAGE_BUCKET)
      .upload(filePath, bytes, { contentType: mimeType, upsert: true });

    if (error) {
      // Fallback to storing Data URL directly in the text column if bucket isn't created yet
      return dataUrl;
    }

    const { data } = supabase.storage.from(DEFAULT_STORAGE_BUCKET).getPublicUrl(filePath);
    return data.publicUrl || dataUrl;
  } catch {
    return dataUrl;
  }
}

export class SupabaseRepository implements IDataRepository {
  async getEquipments(filters?: EquipmentFilter): Promise<Equipment[]> {
    const supabase = getSupabaseClient();
    let query = supabase.from('equipments').select('*').order('patrimony_code', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn('Supabase getEquipments fallback to LocalStore:', error?.message);
      return localStore.getEquipments(filters);
    }

    let items: Equipment[] = data.map((r: any) => ({
      ...r,
      replacement_value: Number(r.replacement_value ?? 0),
    }));

    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.patrimony_code.toLowerCase().includes(q) ||
          (item.brand_model && item.brand_model.toLowerCase().includes(q)) ||
          (item.serial_number && item.serial_number.toLowerCase().includes(q))
      );
    }

    return items;
  }

  async getEquipmentById(id: string): Promise<Equipment | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('equipments').select('*').eq('id', id).maybeSingle();
    if (error) {
      return localStore.getEquipmentById(id);
    }
    if (!data) return null;
    return { ...data, replacement_value: Number(data.replacement_value ?? 0) };
  }

  async getEquipmentByQrToken(qr_token: string): Promise<Equipment | null> {
    const supabase = getSupabaseClient();
    const clean = qr_token.trim();

    const { data, error } = await supabase
      .from('equipments')
      .select('*')
      .or(`qr_token.ilike.${clean},patrimony_code.ilike.${clean}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      return localStore.getEquipmentByQrToken(qr_token);
    }
    if (!data) return null;
    return { ...data, replacement_value: Number(data.replacement_value ?? 0) };
  }

  async createEquipment(
    data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Equipment> {
    const supabase = getSupabaseClient();
    const qr_token =
      data.qr_token ||
      `rotary-item-${data.patrimony_code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const payload = {
      patrimony_code: data.patrimony_code,
      qr_token,
      category: data.category === 'MULETA' ? 'MULETA_CANADENSE' : data.category,
      name: data.name,
      brand_model: data.brand_model || data.model_description || null,
      serial_number: data.serial_number || null,
      status: data.status || 'DISPONIVEL',
      condition: data.condition === 'SUCATA' ? 'SUCATEADO' : data.condition || 'BOM',
      replacement_value: data.replacement_value,
      notes: data.notes || null,
    };

    const { data: created, error } = await supabase
      .from('equipments')
      .insert(payload)
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(error?.message || 'Erro ao cadastrar equipamento no Supabase.');
    }

    return { ...created, replacement_value: Number(created.replacement_value ?? 0) };
  }

  async updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment> {
    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase
      .from('equipments')
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(error?.message || 'Erro ao atualizar equipamento no Supabase.');
    }

    return { ...updated, replacement_value: Number(updated.replacement_value ?? 0) };
  }

  async getBeneficiaries(search?: string): Promise<Beneficiary[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return localStore.getBeneficiaries(search);
    }

    let list = data.map(mapBeneficiaryFromDb);
    if (search && search.trim() !== '') {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.full_name.toLowerCase().includes(q) ||
          b.cpf.includes(q) ||
          b.phone.includes(q) ||
          b.secondary_name.toLowerCase().includes(q)
      );
    }
    return list;
  }

  async getBeneficiaryById(id: string): Promise<Beneficiary | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return localStore.getBeneficiaryById(id);
    if (!data) return null;
    return mapBeneficiaryFromDb(data);
  }

  async getBeneficiaryByCpf(cpf: string): Promise<Beneficiary | null> {
    const supabase = getSupabaseClient();
    const clean = cpf.replace(/[^\d]/g, '');
    const { data, error } = await supabase.from('beneficiaries').select('*');
    if (error || !data) return localStore.getBeneficiaryByCpf(cpf);

    const match = data.find((b: any) => String(b.cpf || '').replace(/[^\d]/g, '') === clean);
    return match ? mapBeneficiaryFromDb(match) : null;
  }

  async createBeneficiary(
    data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Beneficiary> {
    const supabase = getSupabaseClient();
    const existing = await this.getBeneficiaryByCpf(data.cpf);

    const docUrl = data.document_photo_url
      ? await uploadDataUrlToStorage(data.document_photo_url, 'documents', 'doc')
      : undefined;
    const resUrl = data.proof_of_residence_url
      ? await uploadDataUrlToStorage(data.proof_of_residence_url, 'residences', 'res')
      : undefined;

    const payload = {
      full_name: data.full_name,
      cpf: data.cpf,
      rg: data.rg || null,
      phone: data.phone,
      email: data.email || null,
      birth_date: data.birth_date || null,
      address_street: data.address_street,
      address_number: data.address_number,
      address_complement: data.address_complement || null,
      address_neighborhood: data.address_neighborhood,
      address_city: data.address_city,
      address_state: data.address_state || 'RS',
      address_cep: data.address_zipcode || data.address_cep || '95180-000',
      is_patient_same_as_responsible: data.is_patient_same_as_responsible ?? true,
      patient_name: data.patient_name || data.full_name,
      secondary_contact_name: data.secondary_name || data.secondary_contact_name,
      secondary_contact_relationship:
        data.secondary_relationship || data.secondary_contact_relationship,
      secondary_contact_phone: data.secondary_phone || data.secondary_contact_phone,
      document_photo_url: docUrl || null,
      proof_of_residence_url: resUrl || null,
      notes: data.notes || null,
    };

    if (existing) {
      const { data: updated, error } = await supabase
        .from('beneficiaries')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error || !updated) {
        throw new Error(error?.message || 'Erro ao atualizar beneficiário no Supabase.');
      }
      return mapBeneficiaryFromDb(updated);
    }

    const { data: created, error } = await supabase
      .from('beneficiaries')
      .insert(payload)
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(error?.message || 'Erro ao criar beneficiário no Supabase.');
    }

    return mapBeneficiaryFromDb(created);
  }

  async getLoans(filters?: LoanFilter): Promise<Loan[]> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('loans')
      .select('*, equipments(*), beneficiaries(*)')
      .order('expected_return_date', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error || !data) {
      return localStore.getLoans(filters);
    }

    let list = data.map(mapLoanFromDb);
    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.loan_code.toLowerCase().includes(q) ||
          (l.beneficiary && l.beneficiary.full_name.toLowerCase().includes(q)) ||
          (l.beneficiary && l.beneficiary.cpf.includes(q)) ||
          (l.equipment && l.equipment.patrimony_code.toLowerCase().includes(q)) ||
          (l.equipment && l.equipment.name.toLowerCase().includes(q))
      );
    }
    return list;
  }

  async getLoanById(id: string): Promise<Loan | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('loans')
      .select('*, equipments(*), beneficiaries(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) return localStore.getLoanById(id);
    if (!data) return null;
    return mapLoanFromDb(data);
  }

  async getLoanByMagicToken(magic_token: string): Promise<Loan | null> {
    const supabase = getSupabaseClient();
    const clean = magic_token.trim();

    const { data, error } = await supabase
      .from('loans')
      .select('*, equipments(*), beneficiaries(*)')
      .eq('magic_token', clean)
      .maybeSingle();

    if (!error && data) {
      return mapLoanFromDb(data);
    }

    // Also try public RPC if anonymous user has RLS enabled
    const { data: rpcRows } = await supabase.rpc('get_public_loan_by_magic_token', {
      p_token: clean,
    });

    if (Array.isArray(rpcRows) && rpcRows.length > 0) {
      const r = rpcRows[0];
      return {
        id: r.loan_id,
        loan_code: r.loan_code,
        equipment_id: '',
        beneficiary_id: '',
        loan_date: r.loan_date,
        expected_return_date: r.expected_return_date,
        status: r.status,
        renewal_count: Number(r.renewal_count ?? 0),
        max_renewals: Number(r.max_renewals ?? 3),
        magic_token: clean,
        replacement_value: 0,
        created_at: r.loan_date,
        updated_at: r.loan_date,
        equipment: {
          id: '',
          patrimony_code: r.equipment_patrimony,
          qr_token: '',
          category: r.equipment_category,
          name: r.equipment_name,
          status: 'EMPRESTADO',
          condition: 'BOM',
          replacement_value: 0,
          created_at: r.loan_date,
          updated_at: r.loan_date,
        },
        beneficiary: {
          id: '',
          full_name: r.beneficiary_first_name,
          cpf: '',
          phone: '',
          address_street: 'Endereço confirmado no cadastro',
          address_number: 'S/N',
          address_neighborhood: '',
          address_city: '',
          address_state: 'RS',
          address_zipcode: '',
          secondary_name: '',
          secondary_relationship: '',
          secondary_phone: '',
          created_at: r.loan_date,
        },
      };
    }

    return localStore.getLoanByMagicToken(magic_token);
  }

  async getActiveLoanByEquipmentId(equipment_id: string): Promise<Loan | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('loans')
      .select('*, equipments(*), beneficiaries(*)')
      .eq('equipment_id', equipment_id)
      .in('status', ['ATIVO', 'ATRASADO', 'RENOVADO'])
      .limit(1)
      .maybeSingle();

    if (error) return localStore.getActiveLoanByEquipmentId(equipment_id);
    if (!data) return null;
    return mapLoanFromDb(data);
  }

  async createLoan(data: CreateLoanInput): Promise<Loan> {
    const supabase = getSupabaseClient();
    const equipment = await this.getEquipmentById(data.equipment_id);
    if (!equipment) throw new Error('Equipamento não encontrado.');

    const beneficiary = await this.createBeneficiary(data.beneficiary);
    const sigUrl = await uploadDataUrlToStorage(
      data.signature_data_url,
      'signatures',
      `sig-${equipment.patrimony_code}`
    );

    const now = new Date();
    const expectedReturn = new Date(now.getTime() + data.term_days * 24 * 60 * 60 * 1000);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const loan_code = `ROT-${now.getFullYear()}-${randomSuffix}`;
    const magic_token = `renovar-${
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15)
    }`;

    const { data: created, error } = await supabase
      .from('loans')
      .insert({
        loan_code,
        equipment_id: equipment.id,
        beneficiary_id: beneficiary.id,
        status: 'ATIVO',
        loan_date: now.toISOString(),
        expected_return_date: expectedReturn.toISOString(),
        renewal_count: 0,
        max_renewals: 3,
        magic_token,
        replacement_value: equipment.replacement_value,
        signature_image_url: sigUrl,
        notes: data.notes || null,
      })
      .select('*, equipments(*), beneficiaries(*)')
      .single();

    if (error || !created) {
      throw new Error(error?.message || 'Erro ao registrar empréstimo no Supabase.');
    }

    return mapLoanFromDb(created);
  }

  async renewLoan(magic_token: string): Promise<RenewLoanResult> {
    const supabase = getSupabaseClient();
    const clean = magic_token.trim();

    // Try SECURITY DEFINER RPC first (works for both anonymous magic link & staff)
    const { data: rpcRes, error: rpcError } = await supabase.rpc('renew_loan_by_magic_token', {
      p_token: clean,
    });

    if (!rpcError && rpcRes) {
      if (rpcRes.success) {
        const updatedLoan = await this.getLoanByMagicToken(clean);
        return {
          success: true,
          loan: updatedLoan || undefined,
          message: `Empréstimo renovado com sucesso por +30 dias!`,
        };
      } else {
        return {
          success: false,
          max_reached: String(rpcRes.error || '').includes('Limite'),
          message: rpcRes.error || 'Não foi possível renovar este empréstimo.',
        };
      }
    }

    return localStore.renewLoan(magic_token);
  }

  async notifyReturnIntent(
    magic_token: string,
    intent: 'SEDE' | 'COLETA',
    notes?: string
  ): Promise<{ success: boolean; message: string; loan?: Loan }> {
    return localStore.notifyReturnIntent(magic_token, intent, notes);
  }

  async returnLoan(loan_id: string, triage: ReturnLoanInput): Promise<ReturnLoanResult> {
    const supabase = getSupabaseClient();
    const nowIso = new Date().toISOString();

    const mappedCondition =
      triage.condition === 'SUCATA' ? 'SUCATEADO' : triage.condition;

    const { data: updated, error } = await supabase
      .from('loans')
      .update({
        status: 'DEVOLVIDO',
        actual_return_date: nowIso,
        return_condition: mappedCondition,
        close_reason: triage.close_reason,
        post_return_destination: triage.destination,
        return_notes: triage.notes || null,
        quittance_issued: true,
        quittance_issued_at: nowIso,
      })
      .eq('id', loan_id)
      .select('*, equipments(*), beneficiaries(*)')
      .single();

    if (error || !updated) {
      throw new Error(error?.message || 'Erro ao registrar devolução no Supabase.');
    }

    const mapped = mapLoanFromDb(updated);
    return {
      success: true,
      loan: mapped,
      discharge_receipt_url: `/loans/${mapped.id}/receipt`,
      message: 'Devolução registrada e termo de quitação emitido com sucesso.',
    };
  }

  async releaseEquipment(
    equipment_id: string,
    destination: EquipmentStatus,
    notes?: string
  ): Promise<Equipment> {
    const supabase = getSupabaseClient();
    const eq = await this.getEquipmentById(equipment_id);
    if (!eq) throw new Error('Equipamento não encontrado.');

    const updatedNotes = notes
      ? `${eq.notes ? eq.notes + ' | ' : ''}${new Date().toLocaleDateString('pt-BR')}: ${notes}`
      : eq.notes;

    return this.updateEquipment(equipment_id, {
      status: destination,
      notes: updatedNotes,
    });
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [equipments, loans, beneficiaries] = await Promise.all([
      this.getEquipments(),
      this.getLoans(),
      this.getBeneficiaries(),
    ]);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const totalEquipments = equipments.length;
    const availableCount = equipments.filter((e) => e.status === 'DISPONIVEL').length;
    const loanedCount = equipments.filter((e) => e.status === 'EMPRESTADO').length;
    const overdueCount = loans.filter((l) => l.status === 'ATRASADO').length;
    const maintenanceCount = equipments.filter(
      (e) => e.status === 'MANUTENCAO' || e.status === 'HIGIENIZACAO'
    ).length;
    const totalBeneficiaries = beneficiaries.length;

    const activeLoanEquipmentIds = new Set(
      loans
        .filter((l) => l.status === 'ATIVO' || l.status === 'ATRASADO' || l.status === 'RENOVADO')
        .map((l) => l.equipment_id)
    );

    const valueAtRisk = equipments
      .filter((e) => activeLoanEquipmentIds.has(e.id))
      .reduce((sum, item) => sum + item.replacement_value, 0);

    const expiringIn7DaysCount = loans.filter((l) => {
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

  async getLoanEvents(loan_id: string): Promise<LoanEventLog[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('loan_events_log')
      .select('*')
      .eq('loan_id', loan_id)
      .order('created_at', { ascending: false });

    if (error || !data) return localStore.getLoanEvents(loan_id);
    return data as LoanEventLog[];
  }

  async addLoanEvent(event: Omit<LoanEventLog, 'id' | 'created_at'>): Promise<LoanEventLog> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('loan_events_log')
      .insert({
        loan_id: event.loan_id,
        event_type: event.event_type,
        old_status: event.old_status || null,
        new_status: event.new_status || null,
        notes: event.notes || null,
        metadata: event.metadata || {},
      })
      .select('*')
      .single();

    if (error || !data) return localStore.addLoanEvent(event);
    return data as LoanEventLog;
  }
}

export const supabaseRepository = new SupabaseRepository();

