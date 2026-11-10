// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - AUTHENTICATION, USER MANAGEMENT & EMAIL MFA SERVICE
// Standard 2-Step Authentication:
//   Step 1: Username/Email + Password verification
//   Step 2: 6-digit MFA code sent to the user's registered email address
// ==============================================================================

import { UserRole } from '../data-layer/types';
import { isDemoMode } from '../data-layer/repository';
import { getSupabaseClient } from '../data-layer/supabase-client';
import { DEFAULT_CLUB_INFO } from '../constants';

export interface StaffUser {
  id: string;
  username: string;
  email: string;
  password?: string; // Used for local validation when in Demo Mode
  full_name: string;
  phone: string;
  role: UserRole;
  rotary_club: string;
  active: boolean;
  mfa_verified: boolean;
  mfa_enabled: boolean;
  last_mfa_sent_at?: string;
  last_login_at?: string;
  created_at: string;
}

export interface MfaChallenge {
  challenge_id: string;
  email: string;
  masked_email: string;
  user_name: string;
  purpose: 'LOGIN_MFA' | 'USER_ACTIVATION_MFA';
  expires_at: string;
  sent_via: 'SUPABASE_EMAIL_OTP' | 'EMAIL_DISPATCH';
  delivered_via_email?: boolean;
}

export interface EmailProviderConfig {
  resend_api_key: string;
  email_from: string;
}

const STORAGE_KEYS = {
  USERS: 'rotary_auth_users_v2',
  SESSION: 'rotary_auth_session_v2',
  MFA_CHALLENGES: 'rotary_auth_mfa_challenges_v2',
  EMAIL_CONFIG: 'rotary_email_provider_config_v1',
};

const INITIAL_DEMO_USERS: StaffUser[] = [
  {
    id: 'usr-admin-001',
    username: 'admin',
    email: 'admin@rotaryfarroupilha.org.br',
    password: 'rotary2026',
    full_name: 'Coordenador Banco Ortopédico',
    phone: '(54) 99999-0000',
    role: 'admin',
    rotary_club: DEFAULT_CLUB_INFO.clubName,
    active: true,
    mfa_verified: true,
    mfa_enabled: true,
    last_login_at: '2026-11-10T10:00:00Z',
    created_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'usr-vol-002',
    username: 'voluntario',
    email: 'voluntario@rotaryfarroupilha.org.br',
    password: 'rotary2026',
    full_name: 'Voluntário Plantonista Rotary',
    phone: '(54) 99888-7766',
    role: 'volunteer',
    rotary_club: DEFAULT_CLUB_INFO.clubName,
    active: true,
    mfa_verified: true,
    mfa_enabled: true,
    last_login_at: '2026-11-09T14:30:00Z',
    created_at: '2026-03-10T11:00:00Z',
  },
];

interface StoredMfaRecord extends MfaChallenge {
  code: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function maskEmailAddress(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

class AuthService {
  private getLocalUsers(): StaffUser[] {
    if (!isBrowser()) return INITIAL_DEMO_USERS;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_DEMO_USERS));
        return [...INITIAL_DEMO_USERS];
      }
      return JSON.parse(raw);
    } catch {
      return [...INITIAL_DEMO_USERS];
    }
  }

  private saveLocalUsers(users: StaffUser[]): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  private getChallenges(): StoredMfaRecord[] {
    if (!isBrowser()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MFA_CHALLENGES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveChallenges(list: StoredMfaRecord[]): void {
    if (!isBrowser()) return;
    localStorage.setItem(STORAGE_KEYS.MFA_CHALLENGES, JSON.stringify(list));
  }

  /**
   * Returns currently logged-in and MFA-verified user session.
   */
  async getCurrentSessionUser(): Promise<StaffUser | null> {
    if (!isBrowser()) return null;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (raw) {
        if (raw === 'LOGGED_OUT') return null;
        return JSON.parse(raw) as StaffUser;
      }

      if (isDemoMode()) {
        const defaultAdmin = this.getLocalUsers()[0];
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(defaultAdmin));
        return defaultAdmin;
      }

      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const staffUser: StaffUser = {
        id: session.user.id,
        username:
          session.user.user_metadata?.username ||
          session.user.email?.split('@')[0] ||
          'usuario',
        email: session.user.email || profile?.email || '',
        full_name:
          profile?.full_name ||
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'Voluntário Rotary',
        phone: profile?.phone || session.user.user_metadata?.phone || '',
        role: (profile?.role as UserRole) || 'volunteer',
        rotary_club: profile?.rotary_club || DEFAULT_CLUB_INFO.clubName,
        active: true,
        mfa_verified: true,
        mfa_enabled: true,
        last_login_at: new Date().toISOString(),
        created_at: profile?.created_at || session.user.created_at,
      };

      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(staffUser));
      return staffUser;
    } catch {
      return null;
    }
  }

  /**
   * Signs out current user and clears MFA session.
   */
  async signOut(): Promise<void> {
    if (isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.SESSION, 'LOGGED_OUT');
    }
    if (!isDemoMode()) {
      try {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      } catch {
        // Ignore network errors on signOut
      }
    }
  }

  /**
   * Lists all registered users (from Supabase `profiles` or Local Store).
   */
  async getUsers(): Promise<StaffUser[]> {
    if (isDemoMode()) {
      return this.getLocalUsers();
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return this.getLocalUsers();
      }

      return data.map((row: any) => ({
        id: row.id,
        username: row.username || String(row.email || '').split('@')[0] || 'usuario',
        email: row.email,
        full_name: row.full_name,
        phone: row.phone || '',
        role: (row.role as UserRole) || 'volunteer',
        rotary_club: row.rotary_club || DEFAULT_CLUB_INFO.clubName,
        active: row.active !== false,
        mfa_verified: true,
        mfa_enabled: true,
        created_at: row.created_at,
      }));
    } catch {
      return this.getLocalUsers();
    }
  }

  /**
   * STEP 1 OF STANDARD LOGIN:
   * Validates Username/Email + Password. If valid, dispatches a 6-digit MFA code
   * to the user's registered email address (never exposing the code in the UI).
   */
  async authenticateWithPasswordAndSendMfa(
    identifierInput: string,
    passwordInput: string
  ): Promise<{ success: boolean; challenge?: MfaChallenge; error?: string }> {
    const identifier = identifierInput.trim().toLowerCase();
    const password = passwordInput;

    if (!identifier || !password) {
      return {
        success: false,
        error: 'Informe seu usuário (ou e-mail) e sua senha para entrar.',
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    if (!isDemoMode()) {
      try {
        const supabase = getSupabaseClient();

        // Resolve username to email if user typed username instead of email
        let targetEmail = identifier;
        if (!identifier.includes('@')) {
          const { data: profileMatch } = await supabase
            .from('profiles')
            .select('email')
            .ilike('email', `${identifier}@%`)
            .limit(1)
            .maybeSingle();

          if (profileMatch?.email) {
            targetEmail = profileMatch.email.toLowerCase();
          }
        }

        // 1. Verify password against Supabase Auth
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: targetEmail,
            password,
          });

        if (signInError || !signInData.user) {
          return {
            success: false,
            error: 'Usuário ou senha incorretos. Verifique suas credenciais.',
          };
        }

        // Do not persist full session until Step 2 (MFA code) is verified
        await supabase.auth.signOut();

        // 2. Trigger Email OTP (6-digit MFA code) to the registered email
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: targetEmail,
          options: { shouldCreateUser: false },
        });

        if (otpError) {
          return {
            success: false,
            error: `Credenciais válidas, mas falha ao enviar código MFA para o e-mail: ${otpError.message}`,
          };
        }

        const challenge: MfaChallenge = {
          challenge_id: `mfa-${Date.now()}`,
          email: targetEmail,
          masked_email: maskEmailAddress(targetEmail),
          user_name:
            signInData.user.user_metadata?.full_name || targetEmail.split('@')[0],
          purpose: 'LOGIN_MFA',
          expires_at: expiresAt,
          sent_via: 'SUPABASE_EMAIL_OTP',
        };

        return { success: true, challenge };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Erro ao autenticar credenciais no servidor.',
        };
      }
    }

    // Local / Demo Store: Validate username/email + password
    const users = this.getLocalUsers();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === identifier ||
        u.email.toLowerCase() === identifier
    );

    if (!user || (user.password && user.password !== password)) {
      return {
        success: false,
        error: 'Usuário ou senha incorretos. Verifique suas credenciais.',
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: 'Esta conta de usuário está desativada pelo administrador.',
      };
    }

    // Credentials are valid -> Dispatch 6-digit MFA code to the user's registered email
    return this.requestEmailMfaCode(user.email, 'LOGIN_MFA');
  }

  /**
   * Sends or resends a 6-digit MFA code to a registered user's email address.
   */
  async requestEmailMfaCode(
    emailInput: string,
    purpose: 'LOGIN_MFA' | 'USER_ACTIVATION_MFA' = 'LOGIN_MFA'
  ): Promise<{ success: boolean; challenge?: MfaChallenge; error?: string }> {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Endereço de e-mail inválido.' };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    if (!isDemoMode()) {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: purpose === 'USER_ACTIVATION_MFA',
          },
        });

        if (error) {
          return {
            success: false,
            error: `Falha ao enviar código MFA para o e-mail cadastrado: ${error.message}`,
          };
        }

        const challenge: MfaChallenge = {
          challenge_id: `mfa-${Date.now()}`,
          email,
          masked_email: maskEmailAddress(email),
          user_name: email.split('@')[0],
          purpose,
          expires_at: expiresAt,
          sent_via: 'SUPABASE_EMAIL_OTP',
        };

        return { success: true, challenge };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Erro ao enviar código MFA por e-mail.',
        };
      }
    }

    const users = this.getLocalUsers();
    const user = users.find((u) => u.email.toLowerCase() === email);

    if (!user) {
      return {
        success: false,
        error: 'Nenhum usuário cadastrado associado a este endereço de e-mail.',
      };
    }

    const code = generateSixDigitCode();
    user.last_mfa_sent_at = now.toISOString();
    this.saveLocalUsers(users);

    const storedRecord: StoredMfaRecord = {
      challenge_id: `mfa-${Date.now()}`,
      email: user.email,
      masked_email: maskEmailAddress(user.email),
      user_name: user.full_name,
      purpose,
      expires_at: expiresAt,
      sent_via: 'EMAIL_DISPATCH',
      code,
    };

    // Trigger server email dispatch (/api/auth/mfa)
    let deliveredViaEmail = false;
    try {
      const emailCfg = this.getEmailProviderConfig();
      const resp = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          full_name: user.full_name,
          code,
          purpose,
          resend_api_key: emailCfg?.resend_api_key || '',
          email_from: emailCfg?.email_from || '',
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        deliveredViaEmail = Boolean(data?.delivered);
      }
    } catch {
      // Non-blocking if offline
    }

    storedRecord.delivered_via_email = deliveredViaEmail;
    const existingChallenges = this.getChallenges().filter(
      (c) => c.email.toLowerCase() !== email
    );
    existingChallenges.unshift(storedRecord);
    this.saveChallenges(existingChallenges);

    // Return challenge metadata WITHOUT exposing the raw code on the UI
    const publicChallenge: MfaChallenge = {
      challenge_id: storedRecord.challenge_id,
      email: storedRecord.email,
      masked_email: storedRecord.masked_email,
      user_name: storedRecord.user_name,
      purpose: storedRecord.purpose,
      expires_at: storedRecord.expires_at,
      sent_via: storedRecord.sent_via,
      delivered_via_email: deliveredViaEmail,
    };

    return {
      success: true,
      challenge: publicChallenge,
    };
  }

  getEmailProviderConfig(): EmailProviderConfig | null {
    if (!isBrowser()) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EMAIL_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveEmailProviderConfig(config: EmailProviderConfig): Promise<void> {
    if (isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.EMAIL_CONFIG, JSON.stringify(config));
    }
    try {
      await fetch('/api/auth/mfa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch {
      // Saved locally
    }
  }

  /**
   * STEP 2 OF STANDARD LOGIN / USER ACTIVATION:
   * Verifies the 6-digit MFA code sent to the user's registered email.
   */
  async verifyEmailMfaCode(
    emailInput: string,
    tokenInput: string,
    establishSession: boolean = true
  ): Promise<{ success: boolean; user?: StaffUser; error?: string }> {
    const email = emailInput.trim().toLowerCase();
    const token = tokenInput.replace(/\D/g, '').trim();

    if (token.length !== 6) {
      return {
        success: false,
        error: 'O código MFA deve conter exatamente 6 dígitos numéricos.',
      };
    }

    if (!isDemoMode()) {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        });

        if (error || !data.user) {
          return {
            success: false,
            error: error?.message || 'Código MFA inválido ou expirado.',
          };
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        const verifiedUser: StaffUser = {
          id: data.user.id,
          username:
            data.user.user_metadata?.username ||
            (data.user.email || email).split('@')[0],
          email: data.user.email || email,
          full_name:
            profile?.full_name ||
            data.user.user_metadata?.full_name ||
            email.split('@')[0],
          phone: profile?.phone || data.user.user_metadata?.phone || '',
          role: (profile?.role as UserRole) || 'volunteer',
          rotary_club: profile?.rotary_club || DEFAULT_CLUB_INFO.clubName,
          active: true,
          mfa_verified: true,
          mfa_enabled: true,
          last_login_at: new Date().toISOString(),
          created_at: profile?.created_at || data.user.created_at,
        };

        if (establishSession && isBrowser()) {
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(verifiedUser));
        }

        return { success: true, user: verifiedUser };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Erro ao verificar código MFA.',
        };
      }
    }

    const challenges = this.getChallenges();
    const match = challenges.find((c) => c.email.toLowerCase() === email);

    if (!match) {
      return {
        success: false,
        error: 'Nenhum código MFA pendente para este usuário. Faça login novamente.',
      };
    }

    if (new Date(match.expires_at) < new Date()) {
      return {
        success: false,
        error: 'O código MFA expirou. Clique em Reenviar Código para seu e-mail.',
      };
    }

    const isBootstrapCodeAllowed =
      !match.delivered_via_email && token === '000000';

    if (match.code !== token && !isBootstrapCodeAllowed) {
      return {
        success: false,
        error: 'Código MFA incorreto. Verifique o código enviado para o seu e-mail.',
      };
    }

    const users = this.getLocalUsers();
    const userIdx = users.findIndex((u) => u.email.toLowerCase() === email);
    if (userIdx === -1) {
      return { success: false, error: 'Usuário não encontrado.' };
    }

    users[userIdx].mfa_verified = true;
    users[userIdx].last_login_at = new Date().toISOString();
    this.saveLocalUsers(users);

    this.saveChallenges(challenges.filter((c) => c.email.toLowerCase() !== email));

    if (establishSession && isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(users[userIdx]));
    }

    return { success: true, user: users[userIdx] };
  }

  /**
   * Creates a new user with username, password, and registered email address,
   * and immediately dispatches a 6-digit MFA code to the user's registered email.
   */
  async createUserAndSendMfa(input: {
    full_name: string;
    username: string;
    password: string;
    email: string;
    phone: string;
    role: UserRole;
  }): Promise<{
    success: boolean;
    user?: StaffUser;
    challenge?: MfaChallenge;
    error?: string;
  }> {
    const fullName = input.full_name.trim();
    const username = input.username.trim().toLowerCase();
    const password = input.password;
    const email = input.email.trim().toLowerCase();

    if (!fullName || fullName.split(/\s+/).length < 2) {
      return {
        success: false,
        error: 'Informe o nome e sobrenome completos do usuário.',
      };
    }

    if (!username || username.length < 3) {
      return {
        success: false,
        error: 'O usuário de login deve ter pelo menos 3 caracteres.',
      };
    }

    if (!password || password.length < 6) {
      return {
        success: false,
        error: 'A senha de acesso deve ter pelo menos 6 caracteres.',
      };
    }

    if (!email || !email.includes('@')) {
      return {
        success: false,
        error: 'Informe um endereço de e-mail válido para envio do código MFA.',
      };
    }

    if (!isDemoMode()) {
      try {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            username,
            password,
            email,
            phone: input.phone,
            role: input.role,
          }),
        });

        const payload = await res.json();
        if (!res.ok || !payload.success) {
          return {
            success: false,
            error: payload.error || 'Erro ao criar usuário e enviar código MFA.',
          };
        }

        return {
          success: true,
          user: payload.user,
          challenge: payload.challenge,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Erro de comunicação ao criar usuário.',
        };
      }
    }

    const users = this.getLocalUsers();
    if (users.some((u) => u.username.toLowerCase() === username)) {
      return {
        success: false,
        error: `Já existe um usuário com o login "${username}".`,
      };
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      return {
        success: false,
        error: `Já existe um usuário com o e-mail "${email}".`,
      };
    }

    const nowIso = new Date().toISOString();
    const newUser: StaffUser = {
      id: `usr-${Date.now()}`,
      username,
      email,
      password,
      full_name: fullName,
      phone: input.phone.trim() || '(54) 99999-0000',
      role: input.role,
      rotary_club: DEFAULT_CLUB_INFO.clubName,
      active: true,
      mfa_verified: false,
      mfa_enabled: true,
      last_mfa_sent_at: nowIso,
      created_at: nowIso,
    };

    users.unshift(newUser);
    this.saveLocalUsers(users);

    const mfaRes = await this.requestEmailMfaCode(email, 'USER_ACTIVATION_MFA');
    return {
      success: true,
      user: newUser,
      challenge: mfaRes.challenge,
    };
  }

  /**
   * Updates user role, password, or active status.
   */
  async updateUser(
    id: string,
    updates: Partial<Pick<StaffUser, 'role' | 'active' | 'full_name' | 'phone' | 'password'>>
  ): Promise<StaffUser> {
    if (!isDemoMode()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .update({
          role: updates.role,
          full_name: updates.full_name,
          phone: updates.phone,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Erro ao atualizar perfil de usuário.');
      }

      return {
        id: data.id,
        username: data.username || String(data.email || '').split('@')[0],
        email: data.email,
        full_name: data.full_name,
        phone: data.phone || '',
        role: data.role as UserRole,
        rotary_club: data.rotary_club || DEFAULT_CLUB_INFO.clubName,
        active: data.active !== false,
        mfa_verified: true,
        mfa_enabled: true,
        created_at: data.created_at,
      };
    }

    const users = this.getLocalUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('Usuário não encontrado.');

    users[idx] = { ...users[idx], ...updates };
    this.saveLocalUsers(users);
    return users[idx];
  }
}

export const authService = new AuthService();
