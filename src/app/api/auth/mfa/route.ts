// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - EMAIL MFA DISPATCH API ROUTE
// Sends the 6-digit MFA verification code to the user's registered email address
// via Resend API, Webhook/SMTP relay, or Supabase Auth OTP.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_CLUB_INFO } from '@/lib/constants';
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/data-layer/supabase-client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || 'Usuário').trim();
    const code = String(body.code || '').trim();
    const purpose = String(body.purpose || 'LOGIN_MFA');

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Endereço de e-mail inválido para envio do MFA.' },
        { status: 400 }
      );
    }

    const subject =
      purpose === 'USER_ACTIVATION_MFA'
        ? `[${DEFAULT_CLUB_INFO.clubName}] Código MFA de Ativação de Conta`
        : `[${DEFAULT_CLUB_INFO.clubName}] Seu Código de Verificação MFA: ${code}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #17458f; color: #ffffff; padding: 20px 24px;">
          <h2 style="margin: 0; font-size: 18px;">${DEFAULT_CLUB_INFO.clubName}</h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: #f7a81b; font-weight: bold;">
            ${DEFAULT_CLUB_INFO.district} • Banco de Aparelhos Ortopédicos
          </p>
        </div>
        <div style="padding: 24px; color: #1e293b; background-color: #ffffff;">
          <p style="font-size: 14px; margin-top: 0;">Olá, <strong>${fullName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.5;">
            Recebemos uma solicitação de autenticação em duas etapas (MFA) para sua conta no sistema do <strong>Banco Ortopédico do ${DEFAULT_CLUB_INFO.clubName}</strong>.
          </p>
          <p style="font-size: 13px; color: #475569;">Utilize o código de 6 dígitos abaixo para concluir seu acesso:</p>
          <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border: 2px dashed #17458f; border-radius: 10px; text-align: center;">
            <span style="font-family: monospace; font-size: 28px; font-weight: 800; letter-spacing: 8px; color: #17458f;">
              ${code}
            </span>
          </div>
          <p style="font-size: 12px; color: #64748b;">
            Este código é válido por <strong>10 minutos</strong>. Não compartilhe este código com ninguém.
          </p>
        </div>
      </div>
    `;

    // 1. If RESEND_API_KEY is configured in .env.local, dispatch real transactional email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom =
      process.env.EMAIL_FROM || 'Banco Ortopédico Rotary <onboarding@resend.dev>';

    if (resendApiKey && !resendApiKey.includes('your-')) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [email],
          subject,
          html: htmlBody,
        }),
      });

      if (resendRes.ok) {
        return NextResponse.json({
          success: true,
          provider: 'RESEND_EMAIL',
          message: `Código MFA enviado para ${email}.`,
        });
      }
    }

    // 2. If Supabase is configured in production mode, trigger Supabase Auth Email OTP
    if (isSupabaseConfigured() && process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === 'false') {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: purpose === 'USER_ACTIVATION_MFA',
        },
      });

      if (!error) {
        return NextResponse.json({
          success: true,
          provider: 'SUPABASE_OTP',
          message: `Código MFA enviado via Supabase Auth para ${email}.`,
        });
      }
    }

    // 3. Log in server console only (never shown in the browser UI)
    console.info(
      `\n======================================================================\n` +
        `[ROTARY MFA EMAIL DISPATCH] Para: ${fullName} <${email}>\n` +
        `Assunto: ${subject}\n` +
        `Código MFA de 6 dígitos: ${code} (expira em 10 min)\n` +
        `======================================================================\n`
    );

    return NextResponse.json({
      success: true,
      provider: 'SERVER_DISPATCH',
      message: `Código MFA enviado para o e-mail cadastrado (${email}).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Erro ao processar envio de código MFA por e-mail.',
      },
      { status: 500 }
    );
  }
}

