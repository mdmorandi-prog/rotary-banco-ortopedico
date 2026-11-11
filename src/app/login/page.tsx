"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  User,
  Lock,
  KeyRound,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  AlertCircle,
} from "lucide-react";
import { authService, MfaChallenge } from "@/lib/auth/auth-service";
import { useAuth } from "@/components/auth/auth-provider";
import { RotaryLogo } from "@/components/layout/rotary-logo";
import { toast } from "sonner";

function LoginWithMfaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const prefilledUser = searchParams.get("user") || searchParams.get("email") || "";
  const { refreshSession } = useAuth();

  const [step, setStep] = useState<"CREDENTIALS" | "MFA_CODE">(
    "CREDENTIALS"
  );
  const [identifier, setIdentifier] = useState(prefilledUser);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (prefilledUser) {
      setIdentifier(prefilledUser);
    }
  }, [prefilledUser]);

  const handleLoginStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authService.authenticateWithPasswordAndSendMfa(
        identifier,
        password
      );

      if (!res.success || !res.challenge) {
        setError(res.error || "Usuário ou senha incorretos.");
        toast.error(res.error || "Falha na autenticação.");
        return;
      }

      setChallenge(res.challenge);
      setDigits(["", "", "", "", "", ""]);
      setStep("MFA_CODE");
      toast.success(
        `Credenciais validadas! Código de acesso enviado para ${res.challenge.masked_email}.`
      );

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResendMfa = async () => {
    if (!challenge?.email) return;
    setError(null);
    setLoading(true);

    try {
      const res = await authService.requestEmailMfaCode(challenge.email, "LOGIN_MFA");
      if (!res.success || !res.challenge) {
        setError(res.error || "Não foi possível reenviar o código de acesso.");
        toast.error(res.error || "Erro ao reenviar código.");
        return;
      }

      setChallenge(res.challenge);
      setDigits(["", "", "", "", "", ""]);
      toast.success(`Novo código enviado para ${res.challenge.masked_email}!`);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      chars.forEach((c, idx) => {
        next[idx] = c;
      });
      setDigits(next);
      const focusIdx = Math.min(chars.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge?.email) return;

    setError(null);
    const fullCode = digits.join("");
    if (fullCode.length !== 6) {
      setError("Digite todos os 6 dígitos do código recebido no seu e-mail.");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.verifyEmailMfaCode(
        challenge.email,
        fullCode,
        true
      );
      if (!res.success || !res.user) {
        setError(res.error || "Código de acesso inválido ou expirado.");
        toast.error(res.error || "Código inválido.");
        return;
      }

      await refreshSession();
      toast.success(`Bem-vindo(a), ${res.user.full_name}!`);
      router.replace(redirectPath);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info(
      "Para redefinir sua senha, solicite à Coordenação do Banco Ortopédico do Rotary Club de Farroupilha."
    );
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-8 px-4 bg-[radial-gradient(ellipse_at_top,_rgba(23,69,143,0.06),_rgba(247,168,27,0.03),_transparent_70%)]">
      {/* Único Card Central Elegante */}
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Barra fina de destaque no topo */}
        <div className="h-1.5 bg-gradient-to-r from-[#17458f] via-[#f7a81b] to-[#17458f]" />

        {/* Cabeçalho Institucional Limpo (Fundo Claro Branco) */}
        <div className="pt-8 px-8 pb-4 text-center bg-white">
          <div className="flex justify-center">
            <RotaryLogo variant="full" size={64} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-slate-700 uppercase mt-3">
            Banco de Aparelhos Ortopédicos
          </p>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Distrito 4700 • Farroupilha/RS
          </p>
          <div className="border-b border-slate-100 my-4" />
        </div>

        {/* Corpo de Autenticação */}
        <div className="px-8 pb-7">
          {step === "CREDENTIALS" && (
            <>
              <h1 className="text-xl font-bold text-slate-900">
                Acesso ao Sistema
              </h1>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Entre com suas credenciais para receber o código de acesso.
              </p>
            </>
          )}

          {step === "MFA_CODE" && (
            <>
              <h1 className="text-xl font-bold text-slate-900">
                Código de Acesso
              </h1>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Insira o código de 6 dígitos enviado para{" "}
                <span className="font-semibold text-slate-700">
                  {challenge?.masked_email}
                </span>
                .
              </p>
            </>
          )}

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {step === "CREDENTIALS" && (
            <form onSubmit={handleLoginStep1} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Usuário ou E-mail
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Digite seu usuário ou e-mail"
                    className="w-full h-11 pl-10 pr-4 text-sm text-slate-900 rounded-lg border border-slate-200 bg-slate-50/50 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17458f]/20 focus:border-[#17458f]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                  >
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-[#17458f] hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full h-11 pl-10 pr-10 text-sm text-slate-900 rounded-lg border border-slate-200 bg-slate-50/50 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17458f]/20 focus:border-[#17458f]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 rounded-lg font-semibold text-white bg-[#17458f] hover:bg-[#123670] shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2 w-full mt-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validando credenciais...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>
          )}

          {step === "MFA_CODE" && (
            <form onSubmit={handleVerifyMfa} className="space-y-5">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-[#17458f] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">
                    Verifique sua caixa de entrada
                  </p>
                  <p className="mt-0.5 leading-relaxed">
                    Enviamos um código temporário de 6 dígitos para o seu e-mail cadastrado.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 text-center">
                  Código de 6 Dígitos
                </label>
                <div className="flex items-center justify-center gap-2">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-bold font-mono rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#17458f]/20 focus:border-[#17458f]"
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || digits.join("").length !== 6}
                className="h-11 rounded-lg font-semibold text-white bg-[#17458f] hover:bg-[#123670] shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2 w-full mt-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando código...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar e Acessar</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("CREDENTIALS");
                    setError(null);
                  }}
                  className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  type="button"
                  onClick={handleResendMfa}
                  disabled={loading}
                  className="text-[#17458f] hover:underline font-medium flex items-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Reenviar código</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé Discreto de Segurança */}
        <div className="bg-slate-50/80 px-8 py-3.5 border-t border-slate-100 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#17458f] shrink-0" />
          <span className="text-xs text-slate-500">
            Ambiente seguro com verificação em duas etapas
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center text-sm text-slate-500">
          Carregando acesso ao sistema...
        </div>
      }
    >
      <LoginWithMfaContent />
    </Suspense>
  );
}
