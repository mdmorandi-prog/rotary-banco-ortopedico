/**
 * Rotary Banco Ortopédico — Opaque-box Test Harness & Utilities
 * 
 * Provides:
 * 1. Standard and domain-specific assertion helpers (Legal Comodato CCB 579-585, CCB 320 Quittance, State Machines, CPF/Phone, WCAG Contrast)
 * 2. Contract verification utilities (SQL migrations, Enums, Tables, Triggers, RLS, Seed, Mock Repository, PWA Manifest, Env Config)
 * 3. Mock data generators & fixtures (Equipments, Beneficiaries, Loans, Magic Tokens, QR Tokens)
 * 4. In-Memory Repository reference implementation for isolated E2E testing
 * 5. Test authoring DSL exports
 */

const fs = require('node:fs');
const path = require('node:path');
const nodeAssert = require('node:assert');

// ======================================================================
// 1. CORE ASSERTION HELPERS
// ======================================================================

const assert = {
  ...nodeAssert,

  strictEqual: nodeAssert.strictEqual,
  deepStrictEqual: nodeAssert.deepStrictEqual,
  notStrictEqual: nodeAssert.notStrictEqual,
  ok: nodeAssert.ok,
  match: nodeAssert.match,
  rejects: nodeAssert.rejects,
  doesNotReject: nodeAssert.doesNotReject,

  /**
   * Asserts that a contract document text contains all mandatory clauses
   * required by Articles 579 to 585 of the Brazilian Civil Code (CCB).
   */
  assertLegalComodatoClauses(content) {
    nodeAssert.ok(typeof content === 'string' && content.length > 0, 'Contract content must be a non-empty string');
    const lower = content.toLowerCase();

    // 1. Must cite Comodato and Civil Code
    const hasComodato = lower.includes('comodato');
    const hasCivilCode = lower.includes('código civil') || lower.includes('codigo civil') || lower.includes('10.406') || lower.includes('ccb');
    nodeAssert.ok(hasComodato, 'Termo must explicitly designate the legal relation as Comodato');
    nodeAssert.ok(hasCivilCode, 'Termo must cite the Brazilian Civil Code (Lei 10.406/2002)');

    // 2. Must cite Articles 579 to 585
    const hasArtsCitation = /579/i.test(content) && /585/i.test(content);
    nodeAssert.ok(hasArtsCitation, 'Termo must cite Articles 579 to 585 of CCB');

    // 3. Must specify gratuitous nature (Art. 579 CCB)
    const hasGratuito = lower.includes('gratuito') || lower.includes('a título gratuito') || lower.includes('sem encargo');
    nodeAssert.ok(hasGratuito, 'Termo must state the gratuitous nature of comodato under Art. 579 CCB');

    // 4. Must specify conservation obligations (Art. 582 CCB)
    const hasConservacao = lower.includes('conservar') || lower.includes('guarda') || lower.includes('zelar') || lower.includes('conservação');
    nodeAssert.ok(hasConservacao, 'Termo must define borrower duty of custody and conservation under Art. 582 CCB');

    // 5. Must specify default / mora consequences (Art. 582 CCB)
    const hasMora = lower.includes('mora') || lower.includes('perdas e danos') || lower.includes('atraso');
    nodeAssert.ok(hasMora, 'Termo must define legal consequences of default/mora under Art. 582 CCB');

    // 6. Must specify joint liability (Art. 585 CCB)
    const hasSolidariedade = lower.includes('solidári') || lower.includes('solidari') || lower.includes('conjuntamente');
    nodeAssert.ok(hasSolidariedade, 'Termo must define joint liability (solidariedade passiva) under Art. 585 CCB');

    // 7. Must include declared replacement value
    const hasReplacementVal = /valor.*reposi[çc][ãa]o/i.test(content) || /r\$\s*\d+/i.test(content);
    nodeAssert.ok(hasReplacementVal, 'Termo must include declared replacement value (valor declarado de reposição)');
  },

  /**
   * Asserts that a quittance receipt complies with CCB Article 320.
   */
  assertQuittanceReceipt(content) {
    nodeAssert.ok(typeof content === 'string' && content.length > 0, 'Quittance content must be a non-empty string');
    const lower = content.toLowerCase();

    const hasQuitacao = lower.includes('quitação') || lower.includes('quitacao');
    nodeAssert.ok(hasQuitacao, 'Receipt must state "Quitação"');

    const hasDischarge = lower.includes('plena') || lower.includes('geral') || lower.includes('extingue') || lower.includes('320');
    nodeAssert.ok(hasDischarge, 'Receipt must express total discharge or cite CCB Art. 320');

    const hasCondition = lower.includes('estado') || lower.includes('condição') || lower.includes('condicao') || lower.includes('bom') || lower.includes('reparo');
    nodeAssert.ok(hasCondition, 'Receipt must register physical return condition');
  },

  /**
   * Asserts valid Equipment Lifecycle State Transitions.
   */
  assertEquipmentStateTransition(currentStatus, action, expectedStatus) {
    const validTransitions = {
      'DISPONIVEL': {
        'CREATE_LOAN': 'EMPRESTADO',
        'SEND_MAINTENANCE': 'MANUTENCAO',
        'SEND_HYGIENE': 'HIGIENIZACAO',
        'WRITE_OFF': 'BAIXADO'
      },
      'EMPRESTADO': {
        'MARK_OVERDUE': 'ATRASADO',
        'RETURN_CLEAN': 'HIGIENIZACAO',
        'RETURN_DIRECT': 'DISPONIVEL',
        'RETURN_REPAIR': 'MANUTENCAO'
      },
      'ATRASADO': {
        'RENEW_LOAN': 'EMPRESTADO',
        'RETURN_CLEAN': 'HIGIENIZACAO',
        'RETURN_DIRECT': 'DISPONIVEL',
        'RETURN_REPAIR': 'MANUTENCAO'
      },
      'HIGIENIZACAO': {
        'COMPLETE_HYGIENE': 'DISPONIVEL',
        'SEND_MAINTENANCE': 'MANUTENCAO'
      },
      'MANUTENCAO': {
        'COMPLETE_REPAIR': 'DISPONIVEL',
        'WRITE_OFF': 'BAIXADO'
      },
      'BAIXADO': {} // Terminal state
    };

    const allowed = validTransitions[currentStatus];
    nodeAssert.ok(allowed, `Invalid source status: "${currentStatus}"`);

    const result = allowed[action];
    nodeAssert.ok(result, `Action "${action}" is illegal from status "${currentStatus}"`);
    nodeAssert.strictEqual(
      result,
      expectedStatus,
      `State transition mismatch: from "${currentStatus}" via "${action}", expected "${expectedStatus}" but got "${result}"`
    );
  },

  /**
   * Asserts mathematical and formatting validity of Brazilian CPF.
   */
  assertBrazilianCPF(cpf) {
    nodeAssert.ok(typeof cpf === 'string', 'CPF must be a string');
    const clean = cpf.replace(/\D/g, '');
    nodeAssert.strictEqual(clean.length, 11, `CPF must have exactly 11 digits (got "${cpf}")`);

    // Reject all identical digits (e.g. 111.111.111-11)
    if (/^(\d)\1{10}$/.test(clean)) {
      throw new nodeAssert.AssertionError({
        message: `CPF with all identical digits is invalid: "${cpf}"`
      });
    }

    // Verify 1st digit
    let sum1 = 0;
    for (let i = 0; i < 9; i++) {
      sum1 += parseInt(clean.charAt(i), 10) * (10 - i);
    }
    let rest1 = (sum1 * 10) % 11;
    if (rest1 === 10 || rest1 === 11) rest1 = 0;
    nodeAssert.strictEqual(
      parseInt(clean.charAt(9), 10),
      rest1,
      `CPF 1st verification digit mismatch in "${cpf}"`
    );

    // Verify 2nd digit
    let sum2 = 0;
    for (let i = 0; i < 10; i++) {
      sum2 += parseInt(clean.charAt(i), 10) * (11 - i);
    }
    let rest2 = (sum2 * 10) % 11;
    if (rest2 === 10 || rest2 === 11) rest2 = 0;
    nodeAssert.strictEqual(
      parseInt(clean.charAt(10), 10),
      rest2,
      `CPF 2nd verification digit mismatch in "${cpf}"`
    );
  },

  /**
   * Asserts validity of Brazilian phone number.
   */
  assertBrazilianPhone(phone) {
    nodeAssert.ok(typeof phone === 'string', 'Phone must be a string');
    const clean = phone.replace(/\D/g, '');
    // Standard BR phone with DDD is 10 or 11 digits (or 12-13 with country code 55)
    nodeAssert.ok(
      clean.length === 10 || clean.length === 11 || (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)),
      `Phone number "${phone}" does not match valid Brazilian phone length (10-11 digits)`
    );
  },

  /**
   * Asserts mandatory secondary contact validation constraints.
   */
  assertSecondaryContactValidation(beneficiary) {
    nodeAssert.ok(beneficiary, 'Beneficiary record required');

    // 1. Full name of secondary contact >= 2 words
    const secName = (beneficiary.secondary_name || '').trim();
    const words = secName.split(/\s+/).filter(w => w.length >= 2);
    nodeAssert.ok(words.length >= 2, `Secondary contact name "${secName}" must contain at least 2 words`);

    // 2. Non-empty relationship
    const rel = (beneficiary.secondary_relationship || '').trim();
    nodeAssert.ok(rel.length > 0, 'Secondary contact relationship cannot be empty');

    // 3. Valid secondary phone
    assert.assertBrazilianPhone(beneficiary.secondary_phone);

    // 4. Non-collision check: secondary phone cannot equal primary phone
    const cleanPrim = (beneficiary.phone || '').replace(/\D/g, '');
    const cleanSec = (beneficiary.secondary_phone || '').replace(/\D/g, '');
    nodeAssert.notStrictEqual(cleanPrim, cleanSec, 'Secondary phone cannot be identical to primary phone');

    // 5. Non-collision check: secondary name cannot equal primary beneficiary name
    nodeAssert.notStrictEqual(
      secName.toLowerCase(),
      (beneficiary.full_name || '').trim().toLowerCase(),
      'Secondary contact cannot be the same person as primary beneficiary'
    );
  },

  /**
   * Asserts WCAG 2.1 AA/AAA Contrast Ratio between two HEX colors.
   */
  assertWCAGContrast(hexFg, hexBg, minRatio = 4.5) {
    function parseHex(h) {
      const clean = h.replace('#', '');
      return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16),
      };
    }

    function relativeLuminance(rgb) {
      const sRGB = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(val => {
        return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    }

    const l1 = relativeLuminance(parseHex(hexFg));
    const l2 = relativeLuminance(parseHex(hexBg));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ratio = (lighter + 0.05) / (darker + 0.05);

    nodeAssert.ok(
      ratio >= minRatio,
      `WCAG contrast ratio between ${hexFg} and ${hexBg} is ${ratio.toFixed(2)}:1, which fails required minimum ${minRatio}:1`
    );
    return ratio;
  }
};

// ======================================================================
// 2. CONTRACT VERIFICATION UTILITIES
// ======================================================================

const contracts = {
  /**
   * Verifies that the SQL migration file satisfies all database requirements:
   * 6 Enums, 6 Tables, Foreign Keys, Triggers, RLS, and Seed Data.
   */
  verifyDatabaseMigrationContract(sqlFilePath) {
    nodeAssert.ok(fs.existsSync(sqlFilePath), `SQL migration file not found at: ${sqlFilePath}`);
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // 1. Check all 6 Enums
    const requiredEnums = [
      { name: 'user_role', values: ['admin', 'operator', 'volunteer'] },
      { name: 'equipment_category', values: ['CADEIRA_RODAS', 'CADEIRA_BANHO', 'MULETA', 'ANDADOR', 'CAMA_HOSPITALAR', 'OUTROS'] },
      { name: 'equipment_status', values: ['DISPONIVEL', 'EMPRESTADO', 'ATRASADO', 'HIGIENIZACAO', 'MANUTENCAO', 'BAIXADO'] },
      { name: 'equipment_condition', values: ['NOVO', 'BOM', 'REGULAR', 'PRECISA_REPARO'] },
      { name: 'loan_status', values: ['ATIVO', 'RENOVADO', 'ATRASADO', 'DEVOLVIDO'] },
      { name: 'close_reason', values: ['RECUPERACAO_ALTA', 'OBITO_PACIENTE', 'COMPRA_PROPRIA', 'TROCA_EQUIPAMENTO', 'OUTROS', 'DESISTENCIA'] }
    ];

    for (const en of requiredEnums) {
      const enumRegex = new RegExp(`CREATE\\s+TYPE\\s+(?:public\\.)?${en.name}\\s+AS\\s+ENUM`, 'i');
      nodeAssert.ok(enumRegex.test(sql), `Missing SQL ENUM definition: ${en.name}`);
      for (const val of en.values) {
        nodeAssert.ok(
          sql.includes(`'${val}'`),
          `Enum "${en.name}" missing required value "${val}" in migration SQL`
        );
      }
    }

    // 2. Check all 6 Tables
    const requiredTables = [
      'profiles',
      'equipments',
      'beneficiaries',
      'loans',
      'loan_events_log',
      'maintenance_logs'
    ];

    for (const table of requiredTables) {
      const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b`, 'i');
      nodeAssert.ok(tableRegex.test(sql), `Missing SQL table definition: ${table}`);
      // Must contain PRIMARY KEY
      nodeAssert.ok(
        new RegExp(`${table}[\\s\\S]*?PRIMARY\\s+KEY`, 'i').test(sql) || sql.includes('PRIMARY KEY'),
        `Table "${table}" must define a PRIMARY KEY`
      );
    }

    // 3. Check Foreign Keys and Constraints
    nodeAssert.ok(/REFERENCES\s+(?:public\.)?equipments/i.test(sql), 'Migration must define FK reference to equipments');
    nodeAssert.ok(/REFERENCES\s+(?:public\.)?beneficiaries/i.test(sql), 'Migration must define FK reference to beneficiaries');
    nodeAssert.ok(/ON\\s+DELETE\\s+RESTRICT/i.test(sql) || /RESTRICT/i.test(sql), 'Migration must specify RESTRICT deletion policies on equipment/beneficiary');

    // 4. Check Triggers for Automated Status Transitions
    nodeAssert.ok(/CREATE\\s+TRIGGER/i.test(sql), 'Migration must define database triggers');
    nodeAssert.ok(
      /EMPRESTADO/i.test(sql) && (/trigger/i.test(sql) || /FUNCTION/i.test(sql)),
      'Migration must include trigger/function updating equipment to EMPRESTADO'
    );
    nodeAssert.ok(
      /DEVOLVIDO/i.test(sql) || /post_return_destination/i.test(sql) || /HIGIENIZACAO/i.test(sql),
      'Migration must include trigger/function updating equipment upon return'
    );

    // 5. Check Row Level Security (RLS)
    nodeAssert.ok(/ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY/i.test(sql), 'Migration must enable Row Level Security (RLS)');
    nodeAssert.ok(/CREATE\\s+POLICY/i.test(sql), 'Migration must define RLS security policies');

    // 6. Check Seed Data (at least 5 equipments and 2 loans)
    nodeAssert.ok(/INSERT\\s+INTO\\s+(?:public\\.)?equipments/i.test(sql), 'Migration must contain seed equipments');
    nodeAssert.ok(/INSERT\\s+INTO\\s+(?:public\\.)?beneficiaries/i.test(sql), 'Migration must contain seed beneficiaries');
    nodeAssert.ok(/INSERT\\s+INTO\\s+(?:public\\.)?loans/i.test(sql), 'Migration must contain seed loans');

    return {
      success: true,
      enumsChecked: requiredEnums.length,
      tablesChecked: requiredTables.length
    };
  },

  /**
   * Verifies that a repository instance implements all 11 required IDataRepository methods.
   */
  verifyMockStoreContract(repository) {
    nodeAssert.ok(repository && typeof repository === 'object', 'Repository must be an object');

    const expectedMethods = [
      'getEquipments',
      'getEquipmentById',
      'getEquipmentByQrToken',
      'createEquipment',
      'updateEquipment',
      'getLoans',
      'getLoanById',
      'getLoanByMagicToken',
      'createLoan',
      'renewLoan',
      'returnLoan'
    ];

    for (const method of expectedMethods) {
      nodeAssert.strictEqual(
        typeof repository[method],
        'function',
        `Repository fails IDataRepository contract: missing method "${method}"`
      );
    }
    return true;
  },

  /**
   * Verifies PWA manifest.json compliance.
   */
  verifyPWAContract(publicDir) {
    const manifestPath = path.join(publicDir, 'manifest.json');
    nodeAssert.ok(fs.existsSync(manifestPath), `PWA manifest.json not found at: ${manifestPath}`);
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    nodeAssert.ok(content.name, 'manifest.json must have "name"');
    nodeAssert.ok(content.short_name, 'manifest.json must have "short_name"');
    nodeAssert.strictEqual(content.display, 'standalone', 'PWA display mode must be "standalone"');
    nodeAssert.ok(content.icons && Array.isArray(content.icons) && content.icons.length >= 2, 'manifest.json must provide >= 2 icons');

    const sizes = content.icons.map(icon => icon.sizes);
    nodeAssert.ok(sizes.includes('192x192'), 'manifest.json must provide 192x192 icon');
    nodeAssert.ok(sizes.includes('512x512'), 'manifest.json must provide 512x512 icon');

    // Rotary Royal Blue theme color verification
    nodeAssert.ok(
      content.theme_color && content.theme_color.toLowerCase() === '#17458f',
      `manifest.json theme_color must match Rotary Royal Blue (#17458f), got: "${content.theme_color}"`
    );
    return true;
  },

  /**
   * Verifies .env.example contains all required environment variables.
   */
  verifyEnvironmentContract(envExamplePath) {
    nodeAssert.ok(fs.existsSync(envExamplePath), `.env.example not found at: ${envExamplePath}`);
    const content = fs.readFileSync(envExamplePath, 'utf8');

    const requiredKeys = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_ROTARY_CLUB_NAME',
      'NEXT_PUBLIC_ROTARY_PHONE',
      'CRON_SECRET'
    ];

    for (const key of requiredKeys) {
      const regex = new RegExp(`^${key}=`, 'm');
      nodeAssert.ok(regex.test(content), `.env.example missing required key: "${key}"`);
    }
    return true;
  }
};

// ======================================================================
// 3. MOCK DATA GENERATORS & FIXTURES
// ======================================================================

let _idCounter = 1000;

function nextId(prefix = 'id') {
  return `${prefix}-${++_idCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateValidCPF() {
  const digits = [];
  for (let i = 0; i < 9; i++) digits.push(Math.floor(Math.random() * 9) + 1);

  let sum1 = 0;
  for (let i = 0; i < 9; i++) sum1 += digits[i] * (10 - i);
  let rest1 = (sum1 * 10) % 11;
  if (rest1 === 10 || rest1 === 11) rest1 = 0;
  digits.push(rest1);

  let sum2 = 0;
  for (let i = 0; i < 10; i++) sum2 += digits[i] * (11 - i);
  let rest2 = (sum2 * 10) % 11;
  if (rest2 === 10 || rest2 === 11) rest2 = 0;
  digits.push(rest2);

  const str = digits.join('');
  return `${str.substring(0, 3)}.${str.substring(3, 6)}.${str.substring(6, 9)}-${str.substring(9, 11)}`;
}

const fixtures = {
  generateValidCPF,

  generateMockQrToken(patrimony = 'ROT-001') {
    return `QR-${patrimony.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  },

  generateMockMagicToken(loanCode = 'L-001') {
    return `MAGIC-${loanCode.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).substring(2, 10)}`;
  },

  createMockEquipment(status = 'DISPONIVEL', overrides = {}) {
    const pCode = overrides.patrimony_code || `ROT-EQ-${Math.floor(Math.random() * 9000 + 1000)}`;
    return {
      id: overrides.id || nextId('eq'),
      patrimony_code: pCode,
      qr_token: overrides.qr_token || fixtures.generateMockQrToken(pCode),
      category: overrides.category || 'CADEIRA_RODAS',
      name: overrides.name || 'Cadeira de Rodas Standard Dobrável',
      model_description: overrides.model_description || 'Modelo Jaguaribe Aço Carbono',
      serial_number: overrides.serial_number || `SN-${Math.floor(Math.random() * 100000)}`,
      status: status,
      condition: overrides.condition || (status === 'DISPONIVEL' ? 'BOM' : 'REGULAR'),
      replacement_value: overrides.replacement_value !== undefined ? overrides.replacement_value : 850.00,
      created_at: overrides.created_at || new Date(Date.now() - 30 * 86400000).toISOString(),
      updated_at: overrides.updated_at || new Date().toISOString(),
      ...overrides
    };
  },

  createMockBeneficiary(overrides = {}) {
    return {
      id: overrides.id || nextId('ben'),
      full_name: overrides.full_name || 'Maria Silva Oliveira',
      cpf: overrides.cpf || generateValidCPF(),
      rg: overrides.rg || '12.345.678-9',
      phone: overrides.phone || '(11) 98765-4321',
      email: overrides.email || 'maria.silva@exemplo.com.br',
      address_street: overrides.address_street || 'Rua Rotary Club',
      address_number: overrides.address_number || '1905',
      address_complement: overrides.address_complement || 'Apto 42',
      address_neighborhood: overrides.address_neighborhood || 'Centro',
      address_city: overrides.address_city || 'São Paulo',
      address_state: overrides.address_state || 'SP',
      address_zipcode: overrides.address_zipcode || '01001-000',
      secondary_name: overrides.secondary_name || 'Carlos Oliveira Silva',
      secondary_relationship: overrides.secondary_relationship || 'Filho',
      secondary_phone: overrides.secondary_phone || '(11) 91234-5678',
      created_at: overrides.created_at || new Date().toISOString(),
      ...overrides
    };
  },

  createInvalidBeneficiary(failureType) {
    const valid = fixtures.createMockBeneficiary();
    switch (failureType) {
      case 'missing_secondary_name':
        return { ...valid, secondary_name: '' };
      case 'single_word_secondary_name':
        return { ...valid, secondary_name: 'Carlos' };
      case 'missing_secondary_phone':
        return { ...valid, secondary_phone: '' };
      case 'colliding_phone':
        return { ...valid, secondary_phone: valid.phone };
      case 'colliding_name':
        return { ...valid, secondary_name: valid.full_name };
      case 'invalid_cpf':
        return { ...valid, cpf: '111.111.111-11' };
      default:
        return valid;
    }
  },

  createMockLoan(overrides = {}) {
    const now = Date.now();
    const termDays = overrides.term_days || 30;
    const loanDate = overrides.loan_date || new Date(now - 10 * 86400000).toISOString();
    const expectedReturn = overrides.expected_return_date || new Date(now + 20 * 86400000).toISOString();
    const loanCode = overrides.loan_code || `EMP-${Math.floor(Math.random() * 9000 + 1000)}`;

    return {
      id: overrides.id || nextId('loan'),
      loan_code: loanCode,
      equipment_id: overrides.equipment_id || nextId('eq'),
      beneficiary_id: overrides.beneficiary_id || nextId('ben'),
      loan_date: loanDate,
      expected_return_date: expectedReturn,
      actual_return_date: overrides.actual_return_date || null,
      status: overrides.status || 'ATIVO',
      renewal_count: overrides.renewal_count || 0,
      max_renewals: overrides.max_renewals !== undefined ? overrides.max_renewals : 3,
      magic_token: overrides.magic_token || fixtures.generateMockMagicToken(loanCode),
      notes: overrides.notes || 'Empréstimo concedido conforme indicação médica.',
      replacement_value: overrides.replacement_value !== undefined ? overrides.replacement_value : 850.00,
      signature_url: overrides.signature_url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      contract_pdf_url: overrides.contract_pdf_url || '/contracts/contract-001.pdf',
      created_at: loanDate,
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }
};

// ======================================================================
// 4. IN-MEMORY REPOSITORY REFERENCE IMPLEMENTATION
// ======================================================================

function createInMemoryRepository(initialData = {}) {
  const equipments = [...(initialData.equipments || [])];
  const beneficiaries = [...(initialData.beneficiaries || [])];
  const loans = [...(initialData.loans || [])];
  const maintenanceLogs = [...(initialData.maintenance_logs || [])];
  const eventLogs = [...(initialData.loan_events_log || [])];

  return {
    async getEquipments(filters = {}) {
      return equipments.filter(eq => {
        if (filters.status && eq.status !== filters.status) return false;
        if (filters.category && eq.category !== filters.category) return false;
        if (filters.search) {
          const s = filters.search.toLowerCase();
          const match = eq.name.toLowerCase().includes(s) || eq.patrimony_code.toLowerCase().includes(s);
          if (!match) return false;
        }
        return true;
      });
    },

    async getEquipmentById(id) {
      return equipments.find(e => e.id === id) || null;
    },

    async getEquipmentByQrToken(qr_token) {
      return equipments.find(e => e.qr_token === qr_token) || null;
    },

    async createEquipment(data) {
      const newEq = {
        id: nextId('eq'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...data
      };
      equipments.push(newEq);
      return newEq;
    },

    async updateEquipment(id, data) {
      const idx = equipments.findIndex(e => e.id === id);
      if (idx === -1) throw new Error(`Equipment not found: ${id}`);
      equipments[idx] = {
        ...equipments[idx],
        ...data,
        updated_at: new Date().toISOString()
      };
      return equipments[idx];
    },

    async getLoans(filters = {}) {
      return loans
        .filter(l => !filters.status || l.status === filters.status)
        .map(l => ({
          ...l,
          equipment: equipments.find(e => e.id === l.equipment_id),
          beneficiary: beneficiaries.find(b => b.id === l.beneficiary_id)
        }));
    },

    async getLoanById(id) {
      const loan = loans.find(l => l.id === id);
      if (!loan) return null;
      return {
        ...loan,
        equipment: equipments.find(e => e.id === loan.equipment_id),
        beneficiary: beneficiaries.find(b => b.id === loan.beneficiary_id)
      };
    },

    async getLoanByMagicToken(magic_token) {
      const loan = loans.find(l => l.magic_token === magic_token);
      if (!loan) return null;
      return {
        ...loan,
        equipment: equipments.find(e => e.id === loan.equipment_id),
        beneficiary: beneficiaries.find(b => b.id === loan.beneficiary_id)
      };
    },

    async createLoan(data) {
      // Validate equipment availability
      const eq = equipments.find(e => e.id === data.equipment_id);
      if (!eq) throw new Error('Equipment not found');
      if (eq.status !== 'DISPONIVEL') {
        throw new Error(`Equipment is not available for loan (current status: ${eq.status})`);
      }

      // Validate secondary contact
      assert.assertSecondaryContactValidation(data.beneficiary);

      // Create or find beneficiary
      let ben = beneficiaries.find(b => b.cpf === data.beneficiary.cpf);
      if (!ben) {
        ben = {
          id: nextId('ben'),
          created_at: new Date().toISOString(),
          ...data.beneficiary
        };
        beneficiaries.push(ben);
      }

      // Create loan
      const termDays = data.term_days || 30;
      const loanCode = `EMP-${Math.floor(Math.random() * 9000 + 1000)}`;
      const now = new Date();
      const expectedReturn = new Date(now.getTime() + termDays * 86400000);

      const newLoan = {
        id: nextId('loan'),
        loan_code: loanCode,
        equipment_id: eq.id,
        beneficiary_id: ben.id,
        loan_date: now.toISOString(),
        expected_return_date: expectedReturn.toISOString(),
        status: 'ATIVO',
        renewal_count: 0,
        max_renewals: 3,
        magic_token: fixtures.generateMockMagicToken(loanCode),
        replacement_value: eq.replacement_value,
        signature_url: data.signature_data_url,
        contract_pdf_url: `/contracts/comodato-${loanCode}.pdf`,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      loans.push(newLoan);

      // Trigger: update equipment status to EMPRESTADO
      eq.status = 'EMPRESTADO';
      eq.updated_at = now.toISOString();

      eventLogs.push({
        id: nextId('evt'),
        loan_id: newLoan.id,
        event_type: 'LOAN_CREATED',
        created_at: now.toISOString()
      });

      return {
        ...newLoan,
        equipment: eq,
        beneficiary: ben
      };
    },

    async renewLoan(magic_token) {
      const loan = loans.find(l => l.magic_token === magic_token);
      if (!loan) return { success: false, message: 'Magic token inválido ou expirado' };

      if (loan.status !== 'ATIVO' && loan.status !== 'RENOVADO' && loan.status !== 'ATRASADO') {
        return { success: false, message: `Empréstimo em status ${loan.status} não pode ser renovado` };
      }

      if (loan.renewal_count >= loan.max_renewals) {
        return {
          success: false,
          message: `Limite máximo de ${loan.max_renewals} renovações atingido. Entre em contato com a equipe Rotary.`
        };
      }

      const currentReturn = new Date(loan.expected_return_date);
      const newReturn = new Date(currentReturn.getTime() + 30 * 86400000);

      loan.renewal_count += 1;
      loan.expected_return_date = newReturn.toISOString();
      loan.status = 'RENOVADO';
      loan.updated_at = new Date().toISOString();

      // If equipment was ATRASADO, return it to EMPRESTADO
      const eq = equipments.find(e => e.id === loan.equipment_id);
      if (eq && eq.status === 'ATRASADO') {
        eq.status = 'EMPRESTADO';
        eq.updated_at = new Date().toISOString();
      }

      eventLogs.push({
        id: nextId('evt'),
        loan_id: loan.id,
        event_type: 'LOAN_RENEWED',
        renewal_number: loan.renewal_count,
        created_at: new Date().toISOString()
      });

      return { success: true, loan };
    },

    async returnLoan(loan_id, triage) {
      const loan = loans.find(l => l.id === loan_id);
      if (!loan) throw new Error(`Loan not found: ${loan_id}`);
      if (loan.status === 'DEVOLVIDO') throw new Error('Empréstimo já foi devolvido');

      const eq = equipments.find(e => e.id === loan.equipment_id);
      if (!eq) throw new Error('Equipment not found');

      const now = new Date().toISOString();
      loan.status = 'DEVOLVIDO';
      loan.actual_return_date = now;
      loan.updated_at = now;

      // Update equipment condition and destination
      eq.condition = triage.condition || eq.condition;
      eq.status = triage.destination || 'HIGIENIZACAO';
      eq.updated_at = now;

      if (triage.destination === 'MANUTENCAO') {
        maintenanceLogs.push({
          id: nextId('maint'),
          equipment_id: eq.id,
          loan_id: loan.id,
          reason: triage.close_reason,
          notes: triage.notes || 'Encaminhado para manutenção após triagem de devolução',
          created_at: now
        });
      }

      eventLogs.push({
        id: nextId('evt'),
        loan_id: loan.id,
        event_type: 'LOAN_RETURNED',
        close_reason: triage.close_reason,
        created_at: now
      });

      const discharge_receipt_url = `/receipts/quitacao-${loan.loan_code}.pdf`;

      return {
        success: true,
        loan,
        discharge_receipt_url
      };
    },

    // Diagnostic access
    _internal: {
      equipments,
      beneficiaries,
      loans,
      maintenanceLogs,
      eventLogs
    }
  };
}

module.exports = {
  assert,
  contracts,
  fixtures,
  createInMemoryRepository,
  // Re-export registry DSL
  describe: global.describe,
  test: global.test,
  it: global.it,
  beforeAll: global.beforeAll,
  afterAll: global.afterAll,
  beforeEach: global.beforeEach,
  afterEach: global.afterEach
};
