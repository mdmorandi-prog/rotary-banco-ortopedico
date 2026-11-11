// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - REPOSITORY FACADE & CLOUD/LOCAL DISPATCHER
// Uses real-time PostgreSQL (postgresRepository) by default in production.
// ==============================================================================

import {
  Equipment,
  Beneficiary,
  Loan,
  EquipmentFilter,
  LoanFilter,
  CreateLoanInput,
  ReturnLoanInput,
  RenewLoanResult,
  ReturnLoanResult,
  DashboardMetrics,
  EquipmentStatus,
  LoanEventLog,
  IDataRepository,
} from './types';
import { localStore } from '../mock-store/local-store';
import { postgresRepository } from './postgres-repository';

export type { IDataRepository };

/**
 * Detects whether the application should operate in local Demo Mode.
 * Defaults to false (Cloud PostgreSQL active) unless explicitly forced via localStorage or env.
 */
export const isDemoMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const forced = localStorage.getItem('rotary_force_demo_mode');
    if (forced !== null) {
      return forced === 'true';
    }
  }

  return process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === 'true';
};

/**
 * Allows programmatic toggling of demo mode from UI or test fixtures.
 */
export const setForceDemoMode = (force: boolean | null): void => {
  if (typeof window === 'undefined') return;
  if (force === null) {
    localStorage.removeItem('rotary_force_demo_mode');
  } else {
    localStorage.setItem('rotary_force_demo_mode', String(force));
  }
};

function getActiveRepo(): IDataRepository {
  if (isDemoMode()) {
    return localStore;
  }
  return postgresRepository;
}

/**
 * Unified dataRepository facade singleton.
 * Every application route and UI component imports and calls this object.
 */
export const dataRepository: IDataRepository = {
  getEquipments: (filters) => getActiveRepo().getEquipments(filters),
  getEquipmentById: (id) => getActiveRepo().getEquipmentById(id),
  getEquipmentByQrToken: (qr_token) => getActiveRepo().getEquipmentByQrToken(qr_token),
  createEquipment: (data) => getActiveRepo().createEquipment(data),
  updateEquipment: (id, data) => getActiveRepo().updateEquipment(id, data),

  getBeneficiaries: (search) => getActiveRepo().getBeneficiaries(search),
  getBeneficiaryById: (id) => getActiveRepo().getBeneficiaryById(id),
  getBeneficiaryByCpf: (cpf) => getActiveRepo().getBeneficiaryByCpf(cpf),
  createBeneficiary: (data) => getActiveRepo().createBeneficiary(data),

  getLoans: (filters) => getActiveRepo().getLoans(filters),
  getLoanById: (id) => getActiveRepo().getLoanById(id),
  getLoanByMagicToken: (magic_token) => getActiveRepo().getLoanByMagicToken(magic_token),
  getActiveLoanByEquipmentId: (equipment_id) =>
    getActiveRepo().getActiveLoanByEquipmentId(equipment_id),
  createLoan: (data) => getActiveRepo().createLoan(data),
  renewLoan: (magic_token) => getActiveRepo().renewLoan(magic_token),
  notifyReturnIntent: (magic_token, intent, notes) =>
    getActiveRepo().notifyReturnIntent(magic_token, intent, notes),
  returnLoan: (loan_id, triage) => getActiveRepo().returnLoan(loan_id, triage),

  releaseEquipment: (equipment_id, destination, notes) =>
    getActiveRepo().releaseEquipment(equipment_id, destination, notes),
  getDashboardMetrics: () => getActiveRepo().getDashboardMetrics(),

  getLoanEvents: (loan_id) => getActiveRepo().getLoanEvents(loan_id),
  addLoanEvent: (event) => getActiveRepo().addLoanEvent(event),
};
