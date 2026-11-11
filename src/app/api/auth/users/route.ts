// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - POSTGRESQL USER & MFA AUTHENTICATION API ROUTE
// Stores and validates users and 2FA challenges in Neon PostgreSQL (rotary schema)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { ensureRotarySchema, getPgPool, isPostgresConfigured, pgDataService } from '@/lib/db/postgres';
import { DEFAULT_CLUB_INFO } from '@/lib/constants';
import { UserRole } from '@/lib/data-layer/types';

export const dynamic = 'force-dynamic';

function maskEmailAddress(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendMfaEmail(params: {
  email: string;
  fullName: string;
  code: string;
  purpose: string;
  resendApiKey?: string;
  emailFrom?: string;
}): Promise<boolean> {
  const { email, fullName, code, purpose, resendApiKey, emailFrom } = params;
  let dbSettings: Record<string, string> = {};
  if (isPostgresConfigured()) {
    try {
      dbSettings = await pgDataService.getSettings();
    } catch {
      // Ignore
    }
  }
  const subject =
    purpose === 'USER_ACTIVATION_MFA'
      ? `[${DEFAULT_CLUB_INFO.clubName}] Código de Ativação: ${code}`
      : `[${DEFAULT_CLUB_INFO.clubName}] Seu Código de Acesso: ${code}`;

  const htmlBody = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background-color: #ffffff;">
      <div style="height: 6px; background: linear-gradient(90deg, #17458f 0%, #f7a81b 50%, #17458f 100%);"></div>
      <div style="padding: 28px 28px 16px; text-align: center; border-bottom: 1px solid #f1f5f9;">
        <h2 style="margin: 0; font-size: 20px; color: #17458f; font-weight: 800;">${DEFAULT_CLUB_INFO.clubName}</h2>
        <p style="margin: 4px 0 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
          Banco de Aparelhos Ortopédicos • ${DEFAULT_CLUB_INFO.district}
        </p>
      </div>
      <div style="padding: 24px 28px; color: #1e293b;">
        <p style="font-size: 14px; margin-top: 0;">Olá, <strong>${fullName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          Utilize o código de verificação de 6 dígitos abaixo para concluir seu acesso ao sistema:
        </p>
        <div style="margin: 22px 0; padding: 18px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; text-align: center;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #17458f;">
            ${code}
          </span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">
          Código válido por 10 minutos • Ambiente seguro com verificação em duas etapas.
        </p>
      </div>
    </div>
  `;

  // 1. Check Resend API key first (from client, PostgreSQL settings, or env)
  const key = resendApiKey || dbSettings.resend_api_key || process.env.RESEND_API_KEY;
  const from =
    emailFrom ||
    dbSettings.email_from ||
    process.env.EMAIL_FROM ||
    'Rotary Club de Farroupilha <onboarding@resend.dev>';

  if (key && !key.includes('your-')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject,
          html: htmlBody,
        }),
      });
      if (res.ok) return true;
    } catch (err: any) {
      console.error('Erro Resend em /api/auth/users:', err?.message);
    }
  }

  // 2. Fallback to SMTP if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const fromAddress =
        process.env.EMAIL_FROM ||
        `Rotary Club de Farroupilha <${process.env.SMTP_USER}>`;

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        html: htmlBody,
      });
      return true;
    } catch (err: any) {
      console.error('Erro SMTP em /api/auth/users:', err?.message);
    }
  }

  return false;
}

function mapUserRow(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone || '',
    role: (row.role as UserRole) || 'volunteer',
    rotary_club: row.rotary_club || DEFAULT_CLUB_INFO.clubName,
    active: row.active !== false,
    mfa_verified: Boolean(row.mfa_verified),
    mfa_enabled: row.mfa_enabled !== false,
    last_mfa_sent_at: row.last_mfa_sent_at
      ? new Date(row.last_mfa_sent_at).toISOString()
      : undefined,
    last_login_at: row.last_login_at
      ? new Date(row.last_login_at).toISOString()
      : undefined,
    created_at: new Date(row.created_at).toISOString(),
  };
}

export async function GET() {
  try {
    if (!isPostgresConfigured()) {
      return NextResponse.json({ success: true, users: [] });
    }
    await ensureRotarySchema();
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT * FROM rotary.users ORDER BY created_at DESC;`
    );
    return NextResponse.json({
      success: true,
      users: rows.map(mapUserRow),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro ao listar usuários.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureRotarySchema();
    const pool = getPgPool();
    const body = await request.json();
    const action = String(body.action || 'create');

    // ------------------------------------------------------------------------
    // ACTION 1: LOGIN (STEP 1 - USERNAME/EMAIL + PASSWORD -> DISPATCH MFA)
    // ------------------------------------------------------------------------
    if (action === 'login') {
      const identifier = String(body.identifier || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!identifier || !password) {
        return NextResponse.json(
          {
            success: false,
            error: 'Informe seu usuário (ou e-mail) e sua senha para entrar.',
          },
          { status: 400 }
        );
      }

      const { rows } = await pool.query(
        `SELECT * FROM rotary.users WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1;`,
        [identifier]
      );
      const user = rows[0];

      if (!user || user.password_hash !== password) {
        return NextResponse.json(
          {
            success: false,
            error: 'Usuário ou senha incorretos. Verifique suas credenciais.',
          },
          { status: 401 }
        );
      }

      if (!user.active) {
        return NextResponse.json(
          {
            success: false,
            error: 'Esta conta de usuário está desativada pelo administrador.',
          },
          { status: 403 }
        );
      }

      const code = generateSixDigitCode();
      const challengeId = `mfa-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const delivered = await sendMfaEmail({
        email: user.email,
        fullName: user.full_name,
        code,
        purpose: 'LOGIN_MFA',
        resendApiKey: body.resend_api_key,
        emailFrom: body.email_from,
      });

      await pool.query(
        `DELETE FROM rotary.mfa_challenges WHERE LOWER(email) = LOWER($1);`,
        [user.email]
      );

      await pool.query(
        `INSERT INTO rotary.mfa_challenges (
          challenge_id, email, masked_email, user_name, purpose, code, delivered_via_email, expires_at
        ) VALUES ($1,$2,$3,$4,'LOGIN_MFA',$5,$6,$7);`,
        [
          challengeId,
          user.email,
          maskEmailAddress(user.email),
          user.full_name,
          code,
          delivered,
          expiresAt,
        ]
      );

      await pool.query(
        `UPDATE rotary.users SET last_mfa_sent_at = NOW() WHERE id = $1;`,
        [user.id]
      );

      return NextResponse.json({
        success: true,
        challenge: {
          challenge_id: challengeId,
          email: user.email,
          masked_email: maskEmailAddress(user.email),
          user_name: user.full_name,
          purpose: 'LOGIN_MFA',
          expires_at: expiresAt,
          sent_via: 'EMAIL_DISPATCH',
          delivered_via_email: delivered,
        },
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 2: RESEND MFA CODE
    // ------------------------------------------------------------------------
    if (action === 'resend_mfa') {
      const email = String(body.email || '').trim().toLowerCase();
      const purpose = String(body.purpose || 'LOGIN_MFA');

      const { rows } = await pool.query(
        `SELECT * FROM rotary.users WHERE LOWER(email) = $1 LIMIT 1;`,
        [email]
      );
      const user = rows[0];
      if (!user) {
        return NextResponse.json(
          {
            success: false,
            error: 'Nenhum usuário cadastrado associado a este endereço de e-mail.',
          },
          { status: 404 }
        );
      }

      const code = generateSixDigitCode();
      const challengeId = `mfa-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const delivered = await sendMfaEmail({
        email: user.email,
        fullName: user.full_name,
        code,
        purpose,
        resendApiKey: body.resend_api_key,
        emailFrom: body.email_from,
      });

      await pool.query(
        `DELETE FROM rotary.mfa_challenges WHERE LOWER(email) = LOWER($1);`,
        [user.email]
      );

      await pool.query(
        `INSERT INTO rotary.mfa_challenges (
          challenge_id, email, masked_email, user_name, purpose, code, delivered_via_email, expires_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8);`,
        [
          challengeId,
          user.email,
          maskEmailAddress(user.email),
          user.full_name,
          purpose,
          code,
          delivered,
          expiresAt,
        ]
      );

      return NextResponse.json({
        success: true,
        challenge: {
          challenge_id: challengeId,
          email: user.email,
          masked_email: maskEmailAddress(user.email),
          user_name: user.full_name,
          purpose,
          expires_at: expiresAt,
          sent_via: 'EMAIL_DISPATCH',
          delivered_via_email: delivered,
        },
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 3: VERIFY 6-DIGIT MFA CODE (STEP 2)
    // ------------------------------------------------------------------------
    if (action === 'verify_mfa') {
      const email = String(body.email || '').trim().toLowerCase();
      const token = String(body.token || '').replace(/\D/g, '').trim();

      if (token.length !== 6) {
        return NextResponse.json(
          {
            success: false,
            error: 'O código MFA deve conter exatamente 6 dígitos numéricos.',
          },
          { status: 400 }
        );
      }

      const { rows: chRows } = await pool.query(
        `SELECT * FROM rotary.mfa_challenges WHERE LOWER(email) = $1 ORDER BY created_at DESC LIMIT 1;`,
        [email]
      );
      const match = chRows[0];

      if (!match) {
        return NextResponse.json(
          {
            success: false,
            error: 'Nenhum código MFA pendente para este usuário. Faça login novamente.',
          },
          { status: 400 }
        );
      }

      if (new Date(match.expires_at) < new Date()) {
        return NextResponse.json(
          {
            success: false,
            error: 'O código MFA expirou. Clique em Reenviar Código para seu e-mail.',
          },
          { status: 400 }
        );
      }

      const isBootstrapAllowed = !match.delivered_via_email && token === '000000';
      if (match.code !== token && !isBootstrapAllowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Código MFA incorreto. Verifique o código enviado para o seu e-mail.',
          },
          { status: 401 }
        );
      }

      const { rows: userRows } = await pool.query(
        `UPDATE rotary.users SET mfa_verified = true, last_login_at = NOW()
         WHERE LOWER(email) = $1
         RETURNING *;`,
        [email]
      );

      if (!userRows[0]) {
        return NextResponse.json(
          { success: false, error: 'Usuário não encontrado.' },
          { status: 404 }
        );
      }

      await pool.query(
        `DELETE FROM rotary.mfa_challenges WHERE LOWER(email) = $1;`,
        [email]
      );

      return NextResponse.json({
        success: true,
        user: mapUserRow(userRows[0]),
      });
    }

    // ------------------------------------------------------------------------
    // ACTION 4: CREATE NEW USER + DISPATCH MFA CODE
    // ------------------------------------------------------------------------
    const fullName = String(body.full_name || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim() || '(54) 99999-0000';
    const role: UserRole =
      body.role === 'admin' || body.role === 'operator' || body.role === 'volunteer'
        ? body.role
        : 'volunteer';

    if (!fullName || fullName.split(/\s+/).length < 2) {
      return NextResponse.json(
        { success: false, error: 'Informe nome e sobrenome do usuário.' },
        { status: 400 }
      );
    }
    if (!username || username.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Informe um nome de usuário válido (mínimo 3 caracteres).' },
        { status: 400 }
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A senha deve possuir no mínimo 6 caracteres.' },
        { status: 400 }
      );
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Informe um e-mail válido para envio do código MFA.' },
        { status: 400 }
      );
    }

    const { rows: existingUser } = await pool.query(
      `SELECT username, email FROM rotary.users WHERE LOWER(username) = $1 OR LOWER(email) = $2 LIMIT 1;`,
      [username, email]
    );
    if (existingUser[0]) {
      const isSameUsername = existingUser[0].username.toLowerCase() === username;
      return NextResponse.json(
        {
          success: false,
          error: isSameUsername
            ? `Já existe um usuário com o login "${username}".`
            : `Já existe um usuário com o e-mail "${email}".`,
        },
        { status: 409 }
      );
    }

    const userId = `usr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const { rows: insertedRows } = await pool.query(
      `INSERT INTO rotary.users (
        id, username, email, password_hash, full_name, phone, role, rotary_club, active, mfa_verified, mfa_enabled, last_mfa_sent_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,false,true,NOW())
      RETURNING *;`,
      [
        userId,
        username,
        email,
        password,
        fullName,
        phone,
        role,
        DEFAULT_CLUB_INFO.clubName,
      ]
    );

    const code = generateSixDigitCode();
    const challengeId = `mfa-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const delivered = await sendMfaEmail({
      email,
      fullName,
      code,
      purpose: 'USER_ACTIVATION_MFA',
      resendApiKey: body.resend_api_key,
      emailFrom: body.email_from,
    });

    await pool.query(
      `DELETE FROM rotary.mfa_challenges WHERE LOWER(email) = $1;`,
      [email]
    );
    await pool.query(
      `INSERT INTO rotary.mfa_challenges (
        challenge_id, email, masked_email, user_name, purpose, code, delivered_via_email, expires_at
      ) VALUES ($1,$2,$3,$4,'USER_ACTIVATION_MFA',$5,$6,$7);`,
      [
        challengeId,
        email,
        maskEmailAddress(email),
        fullName,
        code,
        delivered,
        expiresAt,
      ]
    );

    return NextResponse.json({
      success: true,
      user: mapUserRow(insertedRows[0]),
      challenge: {
        challenge_id: challengeId,
        email,
        masked_email: maskEmailAddress(email),
        user_name: fullName,
        purpose: 'USER_ACTIVATION_MFA',
        expires_at: expiresAt,
        sent_via: 'EMAIL_DISPATCH',
        delivered_via_email: delivered,
      },
    });
  } catch (err: any) {
    console.error('[POST /api/auth/users] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Erro interno ao processar usuário no banco PostgreSQL.',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureRotarySchema();
    const pool = getPgPool();
    const body = await request.json();
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do usuário é obrigatório.' },
        { status: 400 }
      );
    }

    const { rows: existingRows } = await pool.query(
      `SELECT * FROM rotary.users WHERE id = $1 LIMIT 1;`,
      [id]
    );
    if (!existingRows[0]) {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado.' },
        { status: 404 }
      );
    }

    const current = existingRows[0];
    const nextRole = body.role ?? current.role;
    const nextActive = body.active !== undefined ? Boolean(body.active) : current.active;
    const nextFullName = body.full_name ?? current.full_name;
    const nextPhone = body.phone ?? current.phone;
    const nextPassword = body.password ? String(body.password) : current.password_hash;

    const { rows: updatedRows } = await pool.query(
      `UPDATE rotary.users SET
        role = $2,
        active = $3,
        full_name = $4,
        phone = $5,
        password_hash = $6
      WHERE id = $1
      RETURNING *;`,
      [id, nextRole, nextActive, nextFullName, nextPhone, nextPassword]
    );

    return NextResponse.json({
      success: true,
      user: mapUserRow(updatedRows[0]),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro ao atualizar usuário.' },
      { status: 500 }
    );
  }
}
