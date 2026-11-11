// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - POSTGRESQL CONNECTION & SCHEMA INITIALIZATION
// Real-time cloud persistence in Neon PostgreSQL (schema: rotary)
// ==============================================================================

import { Pool } from 'pg';
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
} from '../data-layer/types';

declare global {
  // eslint-disable-next-line no-var
  var __rotaryPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __rotaryPgInitPromise: Promise<void> | undefined;
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));
}

export function getPgPool(): Pool {
  if (!global.__rotaryPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada no servidor.');
    }
    global.__rotaryPgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return global.__rotaryPgPool;
}

const BASIC_EQUIPMENTS_SEED: Array<Omit<Equipment, 'created_at' | 'updated_at'>> = [
  {
    id: 'eq-bas-001',
    patrimony_code: 'ROT-CR-001',
    qr_token: 'rotary-item-rot-cr-001',
    category: 'CADEIRA_RODAS',
    name: 'Cadeira de Rodas Standard Adulto',
    brand_model: 'Ortobras K3 Dobrável em X',
    model_description: 'Estrutura em aço carbono, pintura epóxi, suporta até 100kg',
    serial_number: 'ORT-CR-001',
    status: 'DISPONIVEL',
    condition: 'BOM',
    replacement_value: 850.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
  {
    id: 'eq-bas-002',
    patrimony_code: 'ROT-CB-001',
    qr_token: 'rotary-item-rot-cb-001',
    category: 'CADEIRA_BANHO',
    name: 'Cadeira de Banho Sanitária com Rodízios',
    brand_model: 'Inox Sanitário Perfetto',
    model_description: 'Aço inox sanitário, com coletor removível e rodas com trava',
    serial_number: 'PER-CB-001',
    status: 'DISPONIVEL',
    condition: 'NOVO',
    replacement_value: 420.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
  {
    id: 'eq-bas-003',
    patrimony_code: 'ROT-AND-001',
    qr_token: 'rotary-item-rot-and-001',
    category: 'ANDADOR',
    name: 'Andador Articulado em Alumínio Regulável',
    brand_model: 'Sequencial 3 Barras Dobrável',
    model_description: 'Alumínio anodizado, dobrável com ponteiras de borracha',
    serial_number: 'SEQ-AND-001',
    status: 'DISPONIVEL',
    condition: 'BOM',
    replacement_value: 280.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
  {
    id: 'eq-bas-004',
    patrimony_code: 'ROT-MUL-001',
    qr_token: 'rotary-item-rot-mul-001',
    category: 'MULETA_CANADENSE',
    name: 'Par de Muletas Canadenses Reguláveis',
    brand_model: 'Indaiá Alumínio Anatômica',
    model_description: 'Braçadeira articulada em nylon, regulagem de altura por pino click',
    serial_number: 'IND-MUL-001',
    status: 'DISPONIVEL',
    condition: 'BOM',
    replacement_value: 180.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
  {
    id: 'eq-bas-005',
    patrimony_code: 'ROT-MAX-001',
    qr_token: 'rotary-item-rot-max-001',
    category: 'MULETA_AXILAR',
    name: 'Par de Muletas Axilares em Alumínio',
    brand_model: 'Mercur Regulável Adulto',
    model_description: 'Apoio axilar e de mão acolchoados em espuma de alta densidade',
    serial_number: 'MER-MAX-001',
    status: 'DISPONIVEL',
    condition: 'BOM',
    replacement_value: 160.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
  {
    id: 'eq-bas-006',
    patrimony_code: 'ROT-CAM-001',
    qr_token: 'rotary-item-rot-cam-001',
    category: 'CAMA_HOSPITALAR',
    name: 'Cama Hospitalar Fowler 2 Manivelas',
    brand_model: 'Pilati Confort com Grades Laterais',
    model_description: 'Elevação de cabeceira e peseira, grades articuláveis e rodízios com freio',
    serial_number: 'PIL-CAM-001',
    status: 'DISPONIVEL',
    condition: 'BOM',
    replacement_value: 2500.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
  {
    id: 'eq-bas-007',
    patrimony_code: 'ROT-COL-001',
    qr_token: 'rotary-item-rot-col-001',
    category: 'COLCHAO_PNEUMATICO',
    name: 'Colchão Pneumático Anti-Escaras com Compressor',
    brand_model: 'Dellamed Air Plus 110/220V',
    model_description: 'Sistema de alívio de pressão alternada com unidade compressora silenciosa',
    serial_number: 'DEL-COL-001',
    status: 'DISPONIVEL',
    condition: 'NOVO',
    replacement_value: 450.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
  {
    id: 'eq-bas-008',
    patrimony_code: 'ROT-SUP-001',
    qr_token: 'rotary-item-rot-sup-001',
    category: 'SUPORTE_SORO',
    name: 'Suporte de Soro Hospitalar com Rodízios',
    brand_model: 'Inox 4 Ganchos Haste Regulável',
    model_description: 'Haste telescópica em inox com base estabilizadora anti-tombamento',
    serial_number: 'SUP-SOR-001',
    status: 'DISPONIVEL',
    condition: 'NOVO',
    replacement_value: 150.0,
    acquisition_date: '2026-01-15',
    notes: 'Equipamento básico do acervo do Rotary Club de Farroupilha.',
  },
];

export async function ensureRotarySchema(): Promise<void> {
  if (global.__rotaryPgInitPromise) {
    return global.__rotaryPgInitPromise;
  }

  global.__rotaryPgInitPromise = (async () => {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS rotary;`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rotary.users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT 'volunteer',
          rotary_club TEXT NOT NULL DEFAULT 'Rotary Club de Farroupilha',
          active BOOLEAN NOT NULL DEFAULT true,
          mfa_verified BOOLEAN NOT NULL DEFAULT false,
          mfa_enabled BOOLEAN NOT NULL DEFAULT true,
          last_mfa_sent_at TIMESTAMPTZ,
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rotary.mfa_challenges (
          challenge_id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          masked_email TEXT NOT NULL,
          user_name TEXT NOT NULL,
          purpose TEXT NOT NULL,
          code TEXT NOT NULL,
          delivered_via_email BOOLEAN NOT NULL DEFAULT false,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rotary.equipments (
          id TEXT PRIMARY KEY,
          patrimony_code TEXT UNIQUE NOT NULL,
          qr_token TEXT UNIQUE NOT NULL,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          model_description TEXT,
          brand_model TEXT,
          serial_number TEXT,
          status TEXT NOT NULL DEFAULT 'DISPONIVEL',
          condition TEXT NOT NULL DEFAULT 'BOM',
          replacement_value NUMERIC(12,2) NOT NULL DEFAULT 0,
          acquisition_date TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rotary.beneficiaries (
          id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          cpf TEXT UNIQUE NOT NULL,
          rg TEXT,
          phone TEXT NOT NULL,
          email TEXT,
          birth_date TEXT,
          address_street TEXT NOT NULL,
          address_number TEXT NOT NULL,
          address_complement TEXT,
          address_neighborhood TEXT NOT NULL,
          address_city TEXT NOT NULL,
          address_state TEXT NOT NULL,
          address_zipcode TEXT NOT NULL,
          address_cep TEXT,
          is_patient_same_as_responsible BOOLEAN DEFAULT true,
          patient_name TEXT,
          patient_cpf TEXT,
          patient_rg TEXT,
          patient_relationship TEXT,
          patient_condition_notes TEXT,
          secondary_name TEXT NOT NULL,
          secondary_relationship TEXT NOT NULL,
          secondary_phone TEXT NOT NULL,
          secondary_contact_name TEXT,
          secondary_contact_relationship TEXT,
          secondary_contact_phone TEXT,
          document_photo_url TEXT,
          proof_of_residence_url TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rotary.loans (
          id TEXT PRIMARY KEY,
          loan_code TEXT UNIQUE NOT NULL,
          equipment_id TEXT NOT NULL REFERENCES rotary.equipments(id) ON DELETE RESTRICT,
          beneficiary_id TEXT NOT NULL REFERENCES rotary.beneficiaries(id) ON DELETE RESTRICT,
          loan_date TIMESTAMPTZ NOT NULL,
          expected_return_date TIMESTAMPTZ NOT NULL,
          actual_return_date TIMESTAMPTZ,
          status TEXT NOT NULL DEFAULT 'ATIVO',
          renewal_count INTEGER NOT NULL DEFAULT 0,
          max_renewals INTEGER NOT NULL DEFAULT 3,
          magic_token TEXT UNIQUE NOT NULL,
          notes TEXT,
          replacement_value NUMERIC(12,2) NOT NULL DEFAULT 0,
          signature_url TEXT,
          signature_image_url TEXT,
          contract_pdf_url TEXT,
          witness_name TEXT,
          witness_document TEXT,
          return_condition TEXT,
          close_reason TEXT,
          post_return_destination TEXT,
          return_notes TEXT,
          quittance_issued BOOLEAN DEFAULT false,
          quittance_issued_at TIMESTAMPTZ,
          discharge_receipt_url TEXT,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rotary.loan_events (
          id TEXT PRIMARY KEY,
          loan_id TEXT NOT NULL REFERENCES rotary.loans(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          notes TEXT,
          metadata JSONB,
          performed_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rotary.settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Safe Alter Migrations for GPS & Geolocation
        ALTER TABLE rotary.loans ADD COLUMN IF NOT EXISTS lat NUMERIC(10,6);
        ALTER TABLE rotary.loans ADD COLUMN IF NOT EXISTS lng NUMERIC(10,6);
        ALTER TABLE rotary.loans ADD COLUMN IF NOT EXISTS last_gps_at TIMESTAMPTZ;
        ALTER TABLE rotary.loans ADD COLUMN IF NOT EXISTS last_gps_accuracy NUMERIC(10,2);
        ALTER TABLE rotary.beneficiaries ADD COLUMN IF NOT EXISTS lat NUMERIC(10,6);
        ALTER TABLE rotary.beneficiaries ADD COLUMN IF NOT EXISTS lng NUMERIC(10,6);
      `);

      // Seed basic equipments only if table is empty
      const { rows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM rotary.equipments;`);
      if ((rows[0]?.cnt ?? 0) === 0) {
        for (const eq of BASIC_EQUIPMENTS_SEED) {
          await client.query(
            `INSERT INTO rotary.equipments (
              id, patrimony_code, qr_token, category, name,
              model_description, brand_model, serial_number,
              status, condition, replacement_value, acquisition_date, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (patrimony_code) DO NOTHING;`,
            [
              eq.id,
              eq.patrimony_code,
              eq.qr_token,
              eq.category,
              eq.name,
              eq.model_description || null,
              eq.brand_model || null,
              eq.serial_number || null,
              eq.status,
              eq.condition,
              eq.replacement_value,
              eq.acquisition_date || null,
              eq.notes || null,
            ]
          );
        }
      }
    } finally {
      client.release();
    }
  })().catch((err) => {
    global.__rotaryPgInitPromise = undefined;
    throw err;
  });

  return global.__rotaryPgInitPromise;
}

function mapEquipmentRow(row: any): Equipment {
  return {
    id: row.id,
    patrimony_code: row.patrimony_code,
    qr_token: row.qr_token,
    category: row.category,
    name: row.name,
    model_description: row.model_description || undefined,
    brand_model: row.brand_model || undefined,
    serial_number: row.serial_number || undefined,
    status: row.status,
    condition: row.condition,
    replacement_value: Number(row.replacement_value || 0),
    acquisition_date: row.acquisition_date || undefined,
    notes: row.notes || undefined,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

function mapBeneficiaryRow(row: any): Beneficiary {
  return {
    id: row.id,
    full_name: row.full_name,
    cpf: row.cpf,
    rg: row.rg || undefined,
    phone: row.phone,
    email: row.email || undefined,
    birth_date: row.birth_date || undefined,
    address_street: row.address_street,
    address_number: row.address_number,
    address_complement: row.address_complement || undefined,
    address_neighborhood: row.address_neighborhood,
    address_city: row.address_city,
    address_state: row.address_state,
    address_zipcode: row.address_zipcode,
    address_cep: row.address_cep || row.address_zipcode,
    is_patient_same_as_responsible: row.is_patient_same_as_responsible ?? true,
    patient_name: row.patient_name || undefined,
    patient_cpf: row.patient_cpf || undefined,
    patient_rg: row.patient_rg || undefined,
    patient_relationship: row.patient_relationship || undefined,
    patient_condition_notes: row.patient_condition_notes || undefined,
    secondary_name: row.secondary_name,
    secondary_relationship: row.secondary_relationship,
    secondary_phone: row.secondary_phone,
    secondary_contact_name: row.secondary_contact_name || row.secondary_name,
    secondary_contact_relationship:
      row.secondary_contact_relationship || row.secondary_relationship,
    secondary_contact_phone: row.secondary_contact_phone || row.secondary_phone,
    document_photo_url: row.document_photo_url || undefined,
    proof_of_residence_url: row.proof_of_residence_url || undefined,
    notes: row.notes || undefined,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : undefined,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : undefined,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

function mapLoanRow(row: any, equipment?: Equipment, beneficiary?: Beneficiary): Loan {
  return {
    id: row.id,
    loan_code: row.loan_code,
    equipment_id: row.equipment_id,
    beneficiary_id: row.beneficiary_id,
    loan_date: new Date(row.loan_date).toISOString(),
    expected_return_date: new Date(row.expected_return_date).toISOString(),
    actual_return_date: row.actual_return_date
      ? new Date(row.actual_return_date).toISOString()
      : undefined,
    status: row.status,
    renewal_count: Number(row.renewal_count || 0),
    max_renewals: Number(row.max_renewals || 3),
    magic_token: row.magic_token,
    notes: row.notes || undefined,
    replacement_value: Number(row.replacement_value || 0),
    signature_url: row.signature_url || undefined,
    signature_image_url: row.signature_image_url || undefined,
    contract_pdf_url: row.contract_pdf_url || undefined,
    witness_name: row.witness_name || undefined,
    witness_document: row.witness_document || undefined,
    return_condition: row.return_condition || undefined,
    close_reason: row.close_reason || undefined,
    post_return_destination: row.post_return_destination || undefined,
    return_notes: row.return_notes || undefined,
    quittance_issued: Boolean(row.quittance_issued),
    quittance_issued_at: row.quittance_issued_at
      ? new Date(row.quittance_issued_at).toISOString()
      : undefined,
    discharge_receipt_url: row.discharge_receipt_url || undefined,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : undefined,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : undefined,
    last_gps_at: row.last_gps_at ? new Date(row.last_gps_at).toISOString() : undefined,
    last_gps_accuracy:
      row.last_gps_accuracy !== null && row.last_gps_accuracy !== undefined
        ? Number(row.last_gps_accuracy)
        : undefined,
    created_by: row.created_by || undefined,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    equipment,
    beneficiary,
  };
}

export const pgDataService = {
  async getEquipments(filters?: EquipmentFilter): Promise<Equipment[]> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.equipments ORDER BY patrimony_code ASC;`
    );
    let result = rows.map(mapEquipmentRow);

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
    return result;
  },

  async getEquipmentById(id: string): Promise<Equipment | null> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.equipments WHERE id = $1 LIMIT 1;`,
      [id]
    );
    return rows[0] ? mapEquipmentRow(rows[0]) : null;
  },

  async getEquipmentByQrToken(qr_token: string): Promise<Equipment | null> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const tokenClean = qr_token.trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.equipments WHERE LOWER(qr_token) = $1 OR LOWER(patrimony_code) = $1 LIMIT 1;`,
      [tokenClean]
    );
    return rows[0] ? mapEquipmentRow(rows[0]) : null;
  },

  async createEquipment(
    data: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Equipment> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const id = `eq-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const qr_token =
      data.qr_token ||
      `rotary-item-${data.patrimony_code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const { rows } = await pool.query(
      `INSERT INTO rotary.equipments (
        id, patrimony_code, qr_token, category, name,
        model_description, brand_model, serial_number,
        status, condition, replacement_value, acquisition_date, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *;`,
      [
        id,
        data.patrimony_code,
        qr_token,
        data.category,
        data.name,
        data.model_description || null,
        data.brand_model || null,
        data.serial_number || null,
        data.status || 'DISPONIVEL',
        data.condition || 'BOM',
        data.replacement_value || 0,
        data.acquisition_date || null,
        data.notes || null,
      ]
    );
    return mapEquipmentRow(rows[0]);
  },

  async updateEquipment(id: string, data: Partial<Equipment>): Promise<Equipment> {
    await ensureRotarySchema();
    const existing = await this.getEquipmentById(id);
    if (!existing) throw new Error(`Equipamento ${id} não encontrado.`);

    const merged = { ...existing, ...data };
    const pool = getPgPool();
    const { rows } = await pool.query(
      `UPDATE rotary.equipments SET
        patrimony_code = $2,
        qr_token = $3,
        category = $4,
        name = $5,
        model_description = $6,
        brand_model = $7,
        serial_number = $8,
        status = $9,
        condition = $10,
        replacement_value = $11,
        acquisition_date = $12,
        notes = $13,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;`,
      [
        id,
        merged.patrimony_code,
        merged.qr_token,
        merged.category,
        merged.name,
        merged.model_description || null,
        merged.brand_model || null,
        merged.serial_number || null,
        merged.status,
        merged.condition,
        merged.replacement_value,
        merged.acquisition_date || null,
        merged.notes || null,
      ]
    );
    return mapEquipmentRow(rows[0]);
  },

  async getBeneficiaries(search?: string): Promise<Beneficiary[]> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.beneficiaries ORDER BY created_at DESC;`
    );
    let result = rows.map(mapBeneficiaryRow);
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
  },

  async getBeneficiaryById(id: string): Promise<Beneficiary | null> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.beneficiaries WHERE id = $1 LIMIT 1;`,
      [id]
    );
    return rows[0] ? mapBeneficiaryRow(rows[0]) : null;
  },

  async getBeneficiaryByCpf(cpf: string): Promise<Beneficiary | null> {
    await ensureRotarySchema();
    const clean = cpf.replace(/[^\d]/g, '');
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.beneficiaries WHERE REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = $1 LIMIT 1;`,
      [clean]
    );
    return rows[0] ? mapBeneficiaryRow(rows[0]) : null;
  },

  async createBeneficiary(
    data: Omit<Beneficiary, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Beneficiary> {
    await ensureRotarySchema();
    const existing = await this.getBeneficiaryByCpf(data.cpf);
    const pool = getPgPool();

    if (existing) {
      const { rows } = await pool.query(
        `UPDATE rotary.beneficiaries SET
          full_name = $2,
          rg = $3,
          phone = $4,
          email = $5,
          birth_date = $6,
          address_street = $7,
          address_number = $8,
          address_complement = $9,
          address_neighborhood = $10,
          address_city = $11,
          address_state = $12,
          address_zipcode = $13,
          address_cep = $14,
          is_patient_same_as_responsible = $15,
          patient_name = $16,
          patient_cpf = $17,
          patient_rg = $18,
          patient_relationship = $19,
          patient_condition_notes = $20,
          secondary_name = $21,
          secondary_relationship = $22,
          secondary_phone = $23,
          secondary_contact_name = $24,
          secondary_contact_relationship = $25,
          secondary_contact_phone = $26,
          document_photo_url = $27,
          proof_of_residence_url = $28,
          notes = $29,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;`,
        [
          existing.id,
          data.full_name,
          data.rg || null,
          data.phone,
          data.email || null,
          data.birth_date || null,
          data.address_street,
          data.address_number,
          data.address_complement || null,
          data.address_neighborhood,
          data.address_city,
          data.address_state,
          data.address_zipcode,
          data.address_cep || data.address_zipcode,
          data.is_patient_same_as_responsible ?? true,
          data.patient_name || null,
          data.patient_cpf || null,
          data.patient_rg || null,
          data.patient_relationship || null,
          data.patient_condition_notes || null,
          data.secondary_name,
          data.secondary_relationship,
          data.secondary_phone,
          data.secondary_contact_name || data.secondary_name,
          data.secondary_contact_relationship || data.secondary_relationship,
          data.secondary_contact_phone || data.secondary_phone,
          data.document_photo_url || null,
          data.proof_of_residence_url || null,
          data.notes || null,
        ]
      );
      return mapBeneficiaryRow(rows[0]);
    }

    const id = `ben-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const { rows } = await pool.query(
      `INSERT INTO rotary.beneficiaries (
        id, full_name, cpf, rg, phone, email, birth_date,
        address_street, address_number, address_complement,
        address_neighborhood, address_city, address_state,
        address_zipcode, address_cep, is_patient_same_as_responsible,
        patient_name, patient_cpf, patient_rg, patient_relationship,
        patient_condition_notes, secondary_name, secondary_relationship,
        secondary_phone, secondary_contact_name, secondary_contact_relationship,
        secondary_contact_phone, document_photo_url, proof_of_residence_url, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30
      ) RETURNING *;`,
      [
        id,
        data.full_name,
        data.cpf,
        data.rg || null,
        data.phone,
        data.email || null,
        data.birth_date || null,
        data.address_street,
        data.address_number,
        data.address_complement || null,
        data.address_neighborhood,
        data.address_city,
        data.address_state,
        data.address_zipcode,
        data.address_cep || data.address_zipcode,
        data.is_patient_same_as_responsible ?? true,
        data.patient_name || null,
        data.patient_cpf || null,
        data.patient_rg || null,
        data.patient_relationship || null,
        data.patient_condition_notes || null,
        data.secondary_name,
        data.secondary_relationship,
        data.secondary_phone,
        data.secondary_contact_name || data.secondary_name,
        data.secondary_contact_relationship || data.secondary_relationship,
        data.secondary_contact_phone || data.secondary_phone,
        data.document_photo_url || null,
        data.proof_of_residence_url || null,
        data.notes || null,
      ]
    );
    return mapBeneficiaryRow(rows[0]);
  },

  async hydrateLoans(loanRows: any[]): Promise<Loan[]> {
    const equipments = await this.getEquipments();
    const beneficiaries = await this.getBeneficiaries();
    const eqMap = new Map(equipments.map((e) => [e.id, e]));
    const benMap = new Map(beneficiaries.map((b) => [b.id, b]));
    return loanRows.map((r) =>
      mapLoanRow(r, eqMap.get(r.equipment_id), benMap.get(r.beneficiary_id))
    );
  },

  async getLoans(filters?: LoanFilter): Promise<Loan[]> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.loans ORDER BY expected_return_date ASC;`
    );
    let result = await this.hydrateLoans(rows);

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
    return result;
  },

  async getLoanById(id: string): Promise<Loan | null> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.loans WHERE id = $1 LIMIT 1;`,
      [id]
    );
    if (!rows[0]) return null;
    const hydrated = await this.hydrateLoans(rows);
    return hydrated[0] || null;
  },

  async getLoanByMagicToken(magic_token: string): Promise<Loan | null> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const tokenClean = magic_token.trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.loans WHERE LOWER(magic_token) = $1 LIMIT 1;`,
      [tokenClean]
    );
    if (!rows[0]) return null;
    const hydrated = await this.hydrateLoans(rows);
    return hydrated[0] || null;
  },

  async getActiveLoanByEquipmentId(equipment_id: string): Promise<Loan | null> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.loans
       WHERE equipment_id = $1 AND status IN ('ATIVO', 'ATRASADO', 'RENOVADO')
       ORDER BY created_at DESC LIMIT 1;`,
      [equipment_id]
    );
    if (!rows[0]) return null;
    const hydrated = await this.hydrateLoans(rows);
    return hydrated[0] || null;
  },

  async createLoan(data: CreateLoanInput): Promise<Loan> {
    await ensureRotarySchema();
    const equipment = await this.getEquipmentById(data.equipment_id);
    if (!equipment) {
      throw new Error('Equipamento não encontrado.');
    }
    if (equipment.status !== 'DISPONIVEL') {
      throw new Error(
        `Equipamento ${equipment.patrimony_code} não está DISPONÍVEL (Status atual: ${equipment.status}).`
      );
    }

    const beneficiary = await this.createBeneficiary(data.beneficiary);
    const now = new Date();
    const expectedReturn = new Date(
      now.getTime() + data.term_days * 24 * 60 * 60 * 1000
    );

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const loan_code = `EMP-${now.getFullYear()}-${randomSuffix}`;
    const magic_token = `renovar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const loan_id = `loan-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const pool = getPgPool();
    const { rows } = await pool.query(
      `INSERT INTO rotary.loans (
        id, loan_code, equipment_id, beneficiary_id,
        loan_date, expected_return_date, status,
        renewal_count, max_renewals, magic_token,
        replacement_value, signature_url, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,'ATIVO',0,3,$7,$8,$9,$10)
      RETURNING *;`,
      [
        loan_id,
        loan_code,
        equipment.id,
        beneficiary.id,
        now.toISOString(),
        expectedReturn.toISOString(),
        magic_token,
        equipment.replacement_value,
        data.signature_data_url || null,
        data.notes || '',
      ]
    );

    await this.updateEquipment(equipment.id, { status: 'EMPRESTADO' });
    await this.addLoanEvent({
      loan_id,
      event_type: 'CREATED',
      new_status: 'ATIVO',
      notes: `Empréstimo ${loan_code} gerado com prazo de ${data.term_days} dias.`,
    });

    const hydrated = await this.hydrateLoans(rows);
    return hydrated[0];
  },

  async renewLoan(magic_token: string): Promise<RenewLoanResult> {
    await ensureRotarySchema();
    const loan = await this.getLoanByMagicToken(magic_token);
    if (!loan) {
      return { success: false, message: 'Token de renovação inválido ou expirado.' };
    }
    if (loan.status === 'DEVOLVIDO' || loan.status === 'CANCELADO') {
      return {
        success: false,
        message: 'Este empréstimo já foi encerrado e não pode ser renovado.',
      };
    }
    if (loan.renewal_count >= loan.max_renewals) {
      return {
        success: false,
        max_reached: true,
        message: `Limite de renovações atingido (${loan.max_renewals} renovações). Entre em contato com o Rotary Club de Farroupilha.`,
      };
    }

    const now = new Date();
    const currentExpected = new Date(loan.expected_return_date);
    const baseDate = currentExpected > now ? currentExpected : now;
    const newExpected = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const newRenewalCount = loan.renewal_count + 1;

    const pool = getPgPool();
    await pool.query(
      `UPDATE rotary.loans SET
        expected_return_date = $2,
        renewal_count = $3,
        status = 'ATIVO',
        updated_at = NOW()
      WHERE id = $1;`,
      [loan.id, newExpected.toISOString(), newRenewalCount]
    );

    await pool.query(
      `UPDATE rotary.equipments SET status = 'EMPRESTADO', updated_at = NOW()
       WHERE id = $1 AND status = 'ATRASADO';`,
      [loan.equipment_id]
    );

    await this.addLoanEvent({
      loan_id: loan.id,
      event_type: 'RENEWED',
      new_status: 'ATIVO',
      notes: `Renovação #${newRenewalCount} realizada (+30 dias até ${newExpected.toLocaleDateString('pt-BR')}).`,
    });

    const updated = await this.getLoanById(loan.id);
    return {
      success: true,
      loan: updated || undefined,
      message: `Empréstimo renovado com sucesso por mais 30 dias! Nova data de retorno: ${newExpected.toLocaleDateString('pt-BR')}.`,
    };
  },

  async notifyReturnIntent(
    magic_token: string,
    intent: 'SEDE' | 'COLETA',
    notes?: string
  ): Promise<{ success: boolean; message: string; loan?: Loan }> {
    await ensureRotarySchema();
    const loan = await this.getLoanByMagicToken(magic_token);
    if (!loan) {
      return { success: false, message: 'Empréstimo não encontrado.' };
    }

    const nowFormatted = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const noteText =
      intent === 'SEDE'
        ? `[AVISO DE DEVOLUÇÃO NA SEDE] Beneficiário avisou em ${nowFormatted} que levará o equipamento à sede do Rotary.${notes ? ` Obs: "${notes}".` : ''}`
        : `[SOLICITAÇÃO DE COLETA EM DOMICÍLIO] Beneficiário solicitou retirada domiciliar em ${nowFormatted}.${notes ? ` Obs: "${notes}".` : ''}`;

    const pool = getPgPool();
    await pool.query(
      `UPDATE rotary.loans SET
        return_notes = $2,
        updated_at = NOW()
      WHERE id = $1;`,
      [loan.id, noteText]
    );

    await this.addLoanEvent({
      loan_id: loan.id,
      event_type: 'STATUS_CHANGE',
      old_status: loan.status,
      new_status: loan.status,
      notes: noteText,
    });

    const updated = await this.getLoanById(loan.id);
    return {
      success: true,
      loan: updated || undefined,
      message:
        intent === 'SEDE'
          ? 'Aviso de entrega registrado com sucesso! Nossos voluntários aguardam o equipamento na sede do Rotary.'
          : 'Solicitação de coleta registrada com sucesso! Nossos voluntários entrarão em contato para combinar a retirada.',
    };
  },

  async returnLoan(loan_id: string, triage: ReturnLoanInput): Promise<ReturnLoanResult> {
    await ensureRotarySchema();
    const loan = await this.getLoanById(loan_id);
    if (!loan) {
      throw new Error(`Empréstimo ${loan_id} não encontrado.`);
    }

    const dischargeReceiptUrl = `/loans/${loan.id}/receipt`;
    const pool = getPgPool();
    await pool.query(
      `UPDATE rotary.loans SET
        status = 'DEVOLVIDO',
        actual_return_date = NOW(),
        return_condition = $2,
        close_reason = $3,
        post_return_destination = $4,
        return_notes = $5,
        quittance_issued = true,
        quittance_issued_at = NOW(),
        discharge_receipt_url = $6,
        updated_at = NOW()
      WHERE id = $1;`,
      [
        loan.id,
        triage.condition,
        triage.close_reason,
        triage.destination,
        triage.notes || '',
        dischargeReceiptUrl,
      ]
    );

    await pool.query(
      `UPDATE rotary.equipments SET
        status = $2,
        condition = $3,
        updated_at = NOW()
      WHERE id = $1;`,
      [loan.equipment_id, triage.destination, triage.condition]
    );

    await this.addLoanEvent({
      loan_id: loan.id,
      event_type: 'RETURNED',
      new_status: 'DEVOLVIDO',
      notes: `Devolução concluída. Motivo: ${triage.close_reason}. Condição: ${triage.condition}. Destino: ${triage.destination}.`,
    });

    const updated = await this.getLoanById(loan.id);
    return {
      success: true,
      loan: updated!,
      discharge_receipt_url: dischargeReceiptUrl,
      message: 'Devolução registrada e termo de quitação emitido com sucesso.',
    };
  },

  async releaseEquipment(
    equipment_id: string,
    destination: EquipmentStatus,
    notes?: string
  ): Promise<Equipment> {
    await ensureRotarySchema();
    const eq = await this.getEquipmentById(equipment_id);
    if (!eq) throw new Error('Equipamento não encontrado.');

    const updatedNotes = notes
      ? `${eq.notes ? eq.notes + ' | ' : ''}${new Date().toLocaleDateString('pt-BR')}: ${notes}`
      : eq.notes;

    return this.updateEquipment(equipment_id, {
      status: destination,
      notes: updatedNotes,
    });
  },

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    await ensureRotarySchema();
    const equipments = await this.getEquipments();
    const beneficiaries = await this.getBeneficiaries();
    const loans = await this.getLoans();

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
        .filter(
          (l) => l.status === 'ATIVO' || l.status === 'ATRASADO' || l.status === 'RENOVADO'
        )
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
  },

  async getLoanEvents(loan_id: string): Promise<LoanEventLog[]> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.loan_events WHERE loan_id = $1 ORDER BY created_at DESC;`,
      [loan_id]
    );
    return rows.map((r) => ({
      id: r.id,
      loan_id: r.loan_id,
      event_type: r.event_type,
      old_status: r.old_status || undefined,
      new_status: r.new_status || undefined,
      notes: r.notes || undefined,
      metadata: r.metadata || undefined,
      performed_by: r.performed_by || undefined,
      created_at: new Date(r.created_at).toISOString(),
    }));
  },

  async addLoanEvent(
    event: Omit<LoanEventLog, 'id' | 'created_at'>
  ): Promise<LoanEventLog> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const id = `evt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const { rows } = await pool.query(
      `INSERT INTO rotary.loan_events (
        id, loan_id, event_type, old_status, new_status, notes, metadata, performed_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;`,
      [
        id,
        event.loan_id,
        event.event_type,
        event.old_status || null,
        event.new_status || null,
        event.notes || null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.performed_by || null,
      ]
    );
    const r = rows[0];
    return {
      id: r.id,
      loan_id: r.loan_id,
      event_type: r.event_type,
      old_status: r.old_status || undefined,
      new_status: r.new_status || undefined,
      notes: r.notes || undefined,
      metadata: r.metadata || undefined,
      performed_by: r.performed_by || undefined,
      created_at: new Date(r.created_at).toISOString(),
    };
  },

  async getSettings(): Promise<Record<string, string>> {
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(`SELECT key, value FROM rotary.settings;`);
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return map;
  },

  async setSettings(entries: Record<string, string>): Promise<void> {
    await ensureRotarySchema();
    const pool = getPgPool();
    for (const [key, value] of Object.entries(entries)) {
      await pool.query(
        `INSERT INTO rotary.settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
        [key, String(value ?? '')]
      );
    }
  },

  async updateLoanGps(
    loanId: string,
    lat: number,
    lng: number,
    accuracy?: number
  ): Promise<boolean> {
    await ensureRotarySchema();
    const pool = getPgPool();
    await pool.query(
      `UPDATE rotary.loans 
       SET lat = $1, lng = $2, last_gps_at = NOW(), last_gps_accuracy = $3, updated_at = NOW() 
       WHERE id = $4 OR magic_token = $4;`,
      [lat, lng, accuracy || null, loanId]
    );
    return true;
  },
};

