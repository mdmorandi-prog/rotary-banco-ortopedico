// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - USER CREATION & EMAIL MFA DISPATCH API ROUTE
// Creates user with username, password, and registered email in Supabase Auth
// (auth.users) + public.profiles and dispatches a 6-digit MFA code to the email.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/data-layer/supabase-client';
import { DEFAULT_CLUB_INFO } from '@/lib/constants';
import { UserRole } from '@/lib/data-layer/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fullName = String(body.full_name || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
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

    const supabase = createServerSupabaseClient();

    // 1. Create user in Supabase Auth with password
    let userId: string | null = null;
    const { data: createdAuth, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
        phone,
        role,
        rotary_club: DEFAULT_CLUB_INFO.clubName,
      },
    });

    if (createdAuth?.user) {
      userId = createdAuth.user.id;
    } else if (createAuthError && !createAuthError.message.toLowerCase().includes('already')) {
      // Fallback to standard signUp with password if service_role key is not used
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
            phone,
            role,
            rotary_club: DEFAULT_CLUB_INFO.clubName,
          },
        },
      });

      if (signUpErr) {
        return NextResponse.json(
          {
            success: false,
            error: `Erro ao criar usuário no Supabase Auth: ${signUpErr.message}`,
          },
          { status: 500 }
        );
      }

      userId = signUpData.user?.id || null;
    }

    // 2. Upsert into public.profiles if we have userId
    const nowIso = new Date().toISOString();
    if (userId) {
      await supabase.from('profiles').upsert(
        {
          id: userId,
          email,
          full_name: fullName,
          phone: phone || null,
          role,
          rotary_club: DEFAULT_CLUB_INFO.clubName,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );
    }

    // 3. Dispatch the 6-digit MFA code to the newly created user's email
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    return NextResponse.json({
      success: true,
      user: {
        id: userId || `usr-${Date.now()}`,
        username,
        email,
        full_name: fullName,
        phone,
        role,
        rotary_club: DEFAULT_CLUB_INFO.clubName,
        active: true,
        mfa_verified: false,
        mfa_enabled: true,
        last_mfa_sent_at: nowIso,
        created_at: nowIso,
      },
      challenge: {
        challenge_id: `mfa-${Date.now()}`,
        email,
        masked_email: maskEmailAddress(email),
        user_name: fullName,
        purpose: 'USER_ACTIVATION_MFA',
        expires_at: expiresAt,
        sent_via: 'SUPABASE_EMAIL_OTP',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Erro interno ao criar usuário e disparar código MFA.',
      },
      { status: 500 }
    );
  }
}

function maskEmailAddress(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}
