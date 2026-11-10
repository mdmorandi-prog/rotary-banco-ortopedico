import { localStore } from '../../../src/lib/mock-store/local-store';

async function runAdversarialStressTests() {
  console.log('--- Adversarial Test 1: Double Loan Prevention ---');
  // Reset store to initial mock state
  localStore.resetToInitialSeed();

  const eqAvailable = await localStore.getEquipmentById('eq-001');
  if (!eqAvailable || eqAvailable.status !== 'DISPONIVEL') {
    throw new Error('eq-001 should be DISPONIVEL initially');
  }

  const loan1 = await localStore.createLoan({
    equipment_id: 'eq-001',
    beneficiary: {
      full_name: 'Test Beneficiary',
      cpf: '999.888.777-66',
      phone: '(11) 99999-8888',
      address_street: 'Rua Teste',
      address_number: '123',
      address_neighborhood: 'Centro',
      address_city: 'Santos',
      address_state: 'SP',
      address_zipcode: '11000-000',
      secondary_name: 'Secondary Test',
      secondary_relationship: 'Filha',
      secondary_phone: '(11) 98888-7777',
    },
    term_days: 30,
    signature_data_url: 'data:image/png;base64,fake',
  });

  const eqAfterLoan = await localStore.getEquipmentById('eq-001');
  if (eqAfterLoan?.status !== 'EMPRESTADO') {
    throw new Error('eq-001 did not transition to EMPRESTADO');
  }
  console.log('Loan 1 created successfully, eq-001 is now EMPRESTADO');

  // Attempting to loan the same item again MUST fail
  let doubleLoanFailed = false;
  try {
    await localStore.createLoan({
      equipment_id: 'eq-001',
      beneficiary: {
        full_name: 'Another Person',
        cpf: '111.222.333-44',
        phone: '(11) 91111-2222',
        address_street: 'Rua Outra',
        address_number: '456',
        address_neighborhood: 'Centro',
        address_city: 'Santos',
        address_state: 'SP',
        address_zipcode: '11000-000',
        secondary_name: 'Sec Contact',
        secondary_relationship: 'Esposa',
        secondary_phone: '(11) 92222-3333',
      },
      term_days: 30,
      signature_data_url: 'data:image/png;base64,fake',
    });
  } catch (err: any) {
    doubleLoanFailed = true;
    console.log('Double loan correctly rejected with error:', err.message);
  }
  if (!doubleLoanFailed) throw new Error('Double loan was NOT rejected!');

  console.log('--- Adversarial Test 2: Max Renewal Limit Guard ---');
  for (let i = 1; i <= 3; i++) {
    const res = await localStore.renewLoan(loan1.magic_token);
    if (!res.success) throw new Error(`Renewal ${i} failed unexpectedly: ${res.message}`);
    console.log(`Renewal ${i} succeeded. Renewal count: ${res.loan?.renewal_count}`);
  }
  // 4th renewal must be blocked
  const res4 = await localStore.renewLoan(loan1.magic_token);
  if (res4.success) throw new Error('4th renewal succeeded when max_renewals=3!');
  console.log('4th renewal blocked correctly:', res4.message);

  console.log('--- Adversarial Test 3: Return Triage State Transitions ---');
  const returnRes = await localStore.returnLoan(loan1.id, {
    condition: 'PRECISA_REPARO',
    close_reason: 'RECUPERACAO_ALTA',
    destination: 'MANUTENCAO',
    notes: 'Rodízio solto após 30 dias de uso',
  });
  if (!returnRes.success) throw new Error('Return loan failed');
  const eqAfterReturn = await localStore.getEquipmentById('eq-001');
  if (eqAfterReturn?.status !== 'MANUTENCAO') {
    throw new Error('Equipment status not updated to MANUTENCAO after return');
  }
  if (eqAfterReturn?.condition !== 'PRECISA_REPARO') {
    throw new Error('Equipment condition not updated to PRECISA_REPARO after return');
  }
  console.log('Return triage transitioned eq-001 to MANUTENCAO with condition PRECISA_REPARO');

  // Attempting to renew a returned loan must fail
  const renewAfterReturn = await localStore.renewLoan(loan1.magic_token);
  if (renewAfterReturn.success) throw new Error('Renewing closed loan succeeded!');
  console.log('Renewing closed loan correctly rejected:', renewAfterReturn.message);

  console.log('--- Adversarial Test 4: Dashboard Metrics Calculation ---');
  const metrics = await localStore.getDashboardMetrics();
  console.log('Metrics calculated:', metrics);
  if (metrics.totalEquipments !== 8) throw new Error('Total equipments mismatch');
  // Initially: eq-006 is HIGIENIZACAO, eq-007 is MANUTENCAO (2 items).
  // Now eq-001 was returned to MANUTENCAO, so total maintenance/sanitation items = 3.
  if (metrics.maintenanceCount !== 3) throw new Error(`Maintenance count expected 3, got ${metrics.maintenanceCount}`);

  console.log('ALL ADVERSARIAL STRESS TESTS PASSED SUCCESSFULLY!');
}

runAdversarialStressTests().catch(err => {
  console.error('STRESS TEST FAILED:', err);
  process.exit(1);
});
