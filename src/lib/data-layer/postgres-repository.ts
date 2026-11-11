// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - POSTGRESQL CLOUD REPOSITORY CLIENT
// Calls /api/db for real-time persistence in Neon PostgreSQL
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

async function callDbApi<T>(action: string, ...args: unknown[]): Promise<T> {
  const res = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ action, args }),
  });

  const payload = await res.json();
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error || `Erro na operação de banco de dados (${action})`);
  }
  return payload.data as T;
}

export class PostgresRepository implements IDataRepository {
  getEquipments(filters?: EquipmentFilter): Promise<Equipment[]> {
    return callDbApi<Equipment[]>('getEquipments', filters);
  }
  getEquipmentById(id: string): Promise<Equipment | null> {
    return callDbApi<Equipment | null>('getEquipmentById', id);
  }
  getEquipmentByQrToken(qr_token: string): Promise<Equipment | null> {
    return callDbApi<Equipment | null>('getEquipmentByQrToken', qr_token);
  }
  createEquipment(
    data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Equipment> {
    return callDbApi<Equipment>('createEquipment', data);
  }
  updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment> {
    return callDbApi<Equipment>('updateEquipment', id, data);
  }

  getBeneficiaries(search?: string): Promise<Beneficiary[]> {
    return callDbApi<Beneficiary[]>('getBeneficiaries', search);
  }
  getBeneficiaryById(id: string): Promise<Beneficiary | null> {
    return callDbApi<Beneficiary | null>('getBeneficiaryById', id);
  }
  getBeneficiaryByCpf(cpf: string): Promise<Beneficiary | null> {
    return callDbApi<Beneficiary | null>('getBeneficiaryByCpf', cpf);
  }
  createBeneficiary(
    data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Beneficiary> {
    return callDbApi<Beneficiary>('createBeneficiary', data);
  }

  getLoans(filters?: LoanFilter): Promise<Loan[]> {
    return callDbApi<Loan[]>('getLoans', filters);
  }
  getLoanById(id: string): Promise<Loan | null> {
    return callDbApi<Loan | null>('getLoanById', id);
  }
  getLoanByMagicToken(magic_token: string): Promise<Loan | null> {
    return callDbApi<Loan | null>('getLoanByMagicToken', magic_token);
  }
  getActiveLoanByEquipmentId(equipment_id: string): Promise<Loan | null> {
    return callDbApi<Loan | null>('getActiveLoanByEquipmentId', equipment_id);
  }
  createLoan(data: CreateLoanInput): Promise<Loan> {
    return callDbApi<Loan>('createLoan', data);
  }
  renewLoan(magic_token: string): Promise<RenewLoanResult> {
    return callDbApi<RenewLoanResult>('renewLoan', magic_token);
  }
  notifyReturnIntent(
    magic_token: string,
    intent: 'SEDE' | 'COLETA',
    notes?: string
  ): Promise<{ success: boolean; message: string; loan?: Loan }> {
    return callDbApi<{ success: boolean; message: string; loan?: Loan }>(
      'notifyReturnIntent',
      magic_token,
      intent,
      notes
    );
  }
  returnLoan(loan_id: string, triage: ReturnLoanInput): Promise<ReturnLoanResult> {
    return callDbApi<ReturnLoanResult>('returnLoan', loan_id, triage);
  }
  updateLoanGps(
    loan_id: string,
    lat: number,
    lng: number,
    accuracy?: number
  ): Promise<boolean> {
    return callDbApi<boolean>('updateLoanGps', loan_id, lat, lng, accuracy);
  }

  releaseEquipment(
    equipment_id: string,
    destination: EquipmentStatus,
    notes?: string
  ): Promise<Equipment> {
    return callDbApi<Equipment>('releaseEquipment', equipment_id, destination, notes);
  }
  getDashboardMetrics(): Promise<DashboardMetrics> {
    return callDbApi<DashboardMetrics>('getDashboardMetrics');
  }

  getLoanEvents(loan_id: string): Promise<LoanEventLog[]> {
    return callDbApi<LoanEventLog[]>('getLoanEvents', loan_id);
  }
  addLoanEvent(event: Omit<LoanEventLog, 'id' | 'created_at'>): Promise<LoanEventLog> {
    return callDbApi<LoanEventLog>('addLoanEvent', event);
  }
}

export const postgresRepository = new PostgresRepository();

