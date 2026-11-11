// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - EMAIL MFA DISPATCH API ROUTE
// Sends the 6-digit MFA verification code to the user's registered email address
// via configured SMTP (Nodemailer), Resend API, or Supabase Auth OTP.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { DEFAULT_CLUB_INFO } from '@/lib/constants';
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/data-layer/supabase-client';

export const dynamic = 'force-dynamic';

let runtimeEmailConfig: {
  resendApiKey?: string;
  emailFrom?: string;
} = {};

export async function GET() {
  const hasSmtp = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  const hasEnvResend = Boolean(
    process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('your-')
  );
  const hasRuntimeResend = Boolean(runtimeEmailConfig.resendApiKey);
  const hasSupabaseProd =
    isSupabaseConfigured() && process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === 'false';

  return NextResponse.json({
    configured: hasSmtp || hasEnvResend || hasRuntimeResend || hasSupabaseProd,
    provider: hasSmtp
      ? 'SMTP'
      : hasEnvResend || hasRuntimeResend
      ? 'RESEND'
      : hasSupabaseProd
      ? 'SUPABASE_AUTH'
      : 'BOOTSTRAP',
    emailFrom:
      runtimeEmailConfig.emailFrom ||
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      'Rotary Club de Farroupilha <onboarding@resend.dev>',
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const resendApiKey = String(body.resend_api_key || '').trim();
    const emailFrom = String(
      body.email_from || 'Rotary Club de Farroupilha <onboarding@resend.dev>'
    ).trim();

    if (!resendApiKey || !resendApiKey.startsWith('re_')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Informe uma chave válida do Resend (iniciada por "re_").',
        },
        { status: 400 }
      );
    }

    runtimeEmailConfig = {
      resendApiKey,
      emailFrom,
    };

    return NextResponse.json({
      success: true,
      message: 'Configuração de envio de e-mail (Resend) salva e ativada!',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Erro ao salvar configuração.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || 'Usuário').trim();
    const code = String(body.code || '').trim();
    const purpose = String(body.purpose || 'LOGIN_MFA');
    const clientResendKey = String(body.resend_api_key || '').trim();
    const clientEmailFrom = String(body.email_from || '').trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Endereço de e-mail inválido para envio do MFA.' },
        { status: 400 }
      );
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

    // 1. Check SMTP configuration (Nodemailer — automatically synced from Vercel projects)
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

        return NextResponse.json({
          success: true,
          provider: 'SMTP_EMAIL',
          delivered: true,
          message: `Código de 6 dígitos enviado por e-mail para ${email}.`,
        });
      } catch (smtpErr: any) {
        console.error('Erro ao enviar via SMTP:', smtpErr?.message);
      }
    }

    // 2. Check Resend API key (from env, runtime config, or client-configured key)
    const resendApiKey =
      clientResendKey ||
      runtimeEmailConfig.resendApiKey ||
      process.env.RESEND_API_KEY;
    const emailFrom =
      clientEmailFrom ||
      runtimeEmailConfig.emailFrom ||
      process.env.EMAIL_FROM ||
      'Banco Ortopédico Rotary <onboarding@resend.dev>';

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
          delivered: true,
          message: `Código de 6 dígitos enviado por e-mail para ${email}.`,
        });
      }
    }

    // 3. If Supabase is configured in production mode, trigger Supabase Auth Email OTP
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
          delivered: true,
          message: `Código de 6 dígitos enviado via Supabase Auth para ${email}.`,
        });
      }
    }

    // 4. Fallback console log
    console.info(
      `\n======================================================================\n` +
        `[ROTARY MFA EMAIL DISPATCH] Para: ${fullName} <${email}>\n` +
        `Assunto: ${subject}\n` +
        `Código MFA de 6 dígitos: ${code} (ou código mestre 000000 no 1º acesso sem SMTP)\n` +
        `======================================================================\n`
    );

    return NextResponse.json({
      success: true,
      provider: 'BOOTSTRAP_NO_SMTP',
      delivered: false,
      message: `Modo Bootstrap (sem chave Resend/SMTP ativa): use o código de primeiro acesso 000000 para entrar e configurar o Resend.`,
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
