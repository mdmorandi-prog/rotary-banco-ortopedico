// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - REPOSITORY FACADE & DUAL-MODE DISPATCHER
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
import { supabaseRepository } from './supabase-repository';

export type { IDataRepository };

/**
 * Detects whether the application should operate in local Demo Mode.
 * Checks localStorage manual override first, then inspects Supabase environment keys.
 */
export const isDemoMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const forced = localStorage.getItem('rotary_force_demo_mode');
    if (forced !== null) {
      return forced === 'true';
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isUnconfigured =
    !url ||
    !anonKey ||
    url.includes('your-project') ||
    url === 'undefined' ||
    anonKey === 'your-anon-key-here' ||
    anonKey === 'undefined';

  const isExplicitDemo = process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === 'true';

  return isUnconfigured || isExplicitDemo;
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

/**
 * Returns the currently active repository implementation.
 * Currently defaults to localStore. When Supabase is configured in subsequent milestones,
 * this delegates to SupabaseRepository with automatic fallback to localStore on network error.
 */
function getActiveRepo(): IDataRepository {
  // Always use localStore if demo mode is active
  if (isDemoMode()) {
    return localStore;
  }
  // When cloud mode is configured, delegate to the production SupabaseRepository
  return supabaseRepository;
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
  getActiveLoanByEquipmentId: (equipment_id) => getActiveRepo().getActiveLoanByEquipmentId(equipment_id),
  createLoan: (data) => getActiveRepo().createLoan(data),
  renewLoan: (magic_token) => getActiveRepo().renewLoan(magic_token),
  returnLoan: (loan_id, triage) => getActiveRepo().returnLoan(loan_id, triage),

  getDashboardMetrics: () => getActiveRepo().getDashboardMetrics(),
  releaseEquipment: (equipment_id, destination, notes) => getActiveRepo().releaseEquipment(equipment_id, destination, notes),

  getLoanEvents: (loan_id) => getActiveRepo().getLoanEvents(loan_id),
  addLoanEvent: (event) => getActiveRepo().addLoanEvent(event),

  resetDemoData: async () => {
    if (localStore.resetToInitialSeed) {
      localStore.resetToInitialSeed();
    }
  },
};
