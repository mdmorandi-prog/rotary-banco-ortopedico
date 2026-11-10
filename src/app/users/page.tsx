"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Mail,
  ShieldCheck,
  KeyRound,
  Phone,
  CheckCircle2,
  Clock,
  Ban,
  RefreshCw,
  Send,
  ExternalLink,
  Lock,
  User,
  Eye,
  EyeOff,
} from "lucide-react";
import { authService, StaffUser, MfaChallenge } from "@/lib/auth/auth-service";
import { useAuth } from "@/components/auth/auth-provider";
import { UserRole } from "@/lib/data-layer/types";
import { DEFAULT_CLUB_INFO } from "@/lib/constants";
import { formatPhone } from "@/lib/validators";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  admin: {
    label: "Administrador",
    color: "bg-rotary-blue text-white border-rotary-blue",
  },
  operator: {
    label: "Operador / Coordenador",
    color: "bg-amber-100 text-amber-900 border-amber-300",
  },
  volunteer: {
    label: "Voluntário Plantonista",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
};

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create User Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("volunteer");
  const [submitting, setSubmitting] = useState(false);

  // Active MFA Verification / Dispatch Modal State
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<MfaChallenge | null>(null);
  const [targetUser, setTargetUser] = useState<StaffUser | null>(null);
  const [mfaCodeInput, setMfaCodeInput] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await authService.getUsers();
      setUsers(list);
    } catch {
      toast.error("Erro ao carregar lista de usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    // Auto-suggest username from full name if username is still empty
    if (!username || username === fullName.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "")) {
      const suggested = val
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ".")
        .replace(/[^a-z0-9.]/g, "");
      setUsername(suggested);
    }
  };

  const handleCreateUserWithMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await authService.createUserAndSendMfa({
        full_name: fullName,
        username,
        password,
        email,
        phone,
        role,
      });

      if (!res.success || !res.user) {
        toast.error(res.error || "Não foi possível criar o usuário.");
        return;
      }

      toast.success(
        `Usuário "${res.user.username}" criado! Código MFA enviado para o e-mail ${res.user.email}.`
      );

      setCreateOpen(false);
      setFullName("");
      setUsername("");
      setPassword("");
      setEmail("");
      setPhone("");
      setRole("volunteer");

      await loadUsers();

      if (res.challenge) {
        setTargetUser(res.user);
        setActiveChallenge(res.challenge);
        setMfaCodeInput("");
        setMfaModalOpen(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMfaToExistingUser = async (u: StaffUser) => {
    const res = await authService.requestEmailMfaCode(u.email, "USER_ACTIVATION_MFA");
    if (!res.success || !res.challenge) {
      toast.error(res.error || "Falha ao enviar código MFA para o e-mail.");
      return;
    }

    toast.success(`Código MFA de 6 dígitos enviado para o e-mail ${u.email}!`);
    setTargetUser(u);
    setActiveChallenge(res.challenge);
    setMfaCodeInput("");
    setMfaModalOpen(true);
    await loadUsers();
  };

  const handleVerifyUserMfaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge) return;

    setVerifyingMfa(true);
    try {
      const res = await authService.verifyEmailMfaCode(
        activeChallenge.email,
        mfaCodeInput,
        false
      );

      if (!res.success) {
        toast.error(res.error || "Código MFA inválido.");
        return;
      }

      toast.success(
        `Código MFA validado com sucesso! O e-mail ${activeChallenge.email} está verificado.`
      );
      setMfaModalOpen(false);
      await loadUsers();
    } finally {
      setVerifyingMfa(false);
    }
  };

  const handleToggleActive = async (u: StaffUser) => {
    try {
      await authService.updateUser(u.id, { active: !u.active });
      toast.success(
        `Usuário ${u.full_name} ${!u.active ? "ativado" : "bloqueado"} com sucesso.`
      );
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar status do usuário.");
    }
  };

  const handleChangeRole = async (u: StaffUser, newRole: UserRole) => {
    try {
      await authService.updateUser(u.id, { role: newRole });
      toast.success(`Perfil de ${u.full_name} atualizado para ${ROLE_LABELS[newRole].label}.`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar perfil.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rotary-blue to-[#0c2340] rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300 text-xs font-bold border border-white/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Autenticação Usuário + Senha + Segundo Fator (MFA por E-mail)</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-rotary-gold" />
            Gestão de Usuários e Credenciais
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 max-w-2xl">
            Cadastre usuários com <strong>usuário, senha e e-mail</strong>. No login (e na criação
            da conta), o sistema valida a senha e envia o <strong>código MFA de 6 dígitos</strong>{" "}
            para o e-mail cadastrado do usuário.
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-rotary-gold text-rotary-blue hover:bg-amber-400 font-extrabold shadow-sm shrink-0 h-11 px-5"
        >
          <UserPlus className="w-4 h-4 mr-2 stroke-[2.5px]" />
          Cadastrar Novo Usuário
        </Button>
      </div>

      {/* Security Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Total de Usuários</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{users.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Equipe credenciada do clube</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-rotary-blue">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800">Verificados com MFA</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">
                {users.filter((u) => u.mfa_verified).length}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">E-mail validado por código 2FA</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-900">Sessão Atual</p>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate max-w-[200px]">
                {currentUser?.full_name || "Autenticado"}
              </p>
              <p className="text-[11px] text-amber-800 font-medium truncate max-w-[200px]">
                Usuário: {currentUser?.username} ({currentUser?.email})
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 text-amber-800">
              <Lock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table / List */}
      <Card>
        <CardHeader className="p-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
              Usuários Cadastrados no Sistema
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Gerencie credenciais, dispare códigos MFA para o e-mail cadastrado ou valide o primeiro acesso.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers} className="text-xs h-8">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar Lista
          </Button>
        </CardHeader>

        <CardContent className="p-5 pt-2">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Carregando usuários...
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {users.map((u) => {
                const roleMeta = ROLE_LABELS[u.role] || ROLE_LABELS.volunteer;
                return (
                  <div
                    key={u.id}
                    className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{u.full_name}</span>
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          @{u.username}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${roleMeta.color}`}
                        >
                          {roleMeta.label}
                        </span>
                        {u.mfa_verified ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            MFA Verificado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente Confirmação MFA
                          </Badge>
                        )}
                        {!u.active && (
                          <Badge variant="destructive" className="text-[10px]">
                            Inativo / Bloqueado
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                          <Mail className="w-3.5 h-3.5 text-rotary-blue" />
                          E-mail MFA: {u.email}
                        </span>
                        {u.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {u.phone}
                          </span>
                        )}
                        {u.last_mfa_sent_at && (
                          <span className="text-[11px] text-slate-500">
                            Último MFA enviado: {formatDateTime(u.last_mfa_sent_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Alterar cargo de ${u.full_name}`}
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        className="h-8 px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                      >
                        <option value="admin">Administrador</option>
                        <option value="operator">Operador</option>
                        <option value="volunteer">Voluntário</option>
                      </select>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendMfaToExistingUser(u)}
                        className="h-8 text-xs font-bold border-blue-200 text-rotary-blue hover:bg-blue-50"
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                        Enviar Código MFA p/ E-mail
                      </Button>

                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold"
                      >
                        <Link href={`/login?user=${encodeURIComponent(u.username)}`}>
                          Tela de Login
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(u)}
                        className={`h-8 text-xs font-semibold ${
                          u.active
                            ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                            : "text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5 mr-1" />
                        {u.active ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Create User (Username + Password + Email for MFA) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rotary-blue font-extrabold">
              <UserPlus className="w-5 h-5" />
              Cadastrar Novo Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Defina o usuário, a senha de login e o e-mail para onde o código MFA de 6 dígitos
              será enviado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUserWithMfa} className="space-y-3.5 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Completo do Usuário *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => handleFullNameChange(e.target.value)}
                placeholder="Ex: João Carlos Dall'Agnol"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Usuário de Login *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
                    }
                    placeholder="joao.carlos"
                    className="w-full pl-8 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha de Acesso *
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-8 pr-8 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                E-mail Cadastrado (Destino do Código MFA) *
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao.carlos@email.com.br"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(54) 99999-0000"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Perfil de Acesso *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                >
                  <option value="volunteer">Voluntário Plantonista</option>
                  <option value="operator">Operador / Coordenador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-rotary-blue space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                <span>Envio de Código MFA para o E-mail:</span>
              </div>
              <p className="text-[11px] text-slate-700">
                Ao criar o usuário, o código MFA de 6 dígitos será enviado diretamente para o
                e-mail informado acima.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-rotary-gold text-rotary-blue hover:bg-amber-400 font-extrabold"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                    Criando e Enviando MFA...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5" />
                    Criar Usuário e Enviar MFA
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: MFA Code Dispatched to Email */}
      <Dialog open={mfaModalOpen} onOpenChange={setMfaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 font-extrabold">
              <CheckCircle2 className="w-5 h-5" />
              Código MFA Enviado para o E-mail
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              O código de verificação de 6 dígitos foi enviado para o e-mail{" "}
              <strong className="text-slate-900">{activeChallenge?.email}</strong> do usuário{" "}
              <strong>{targetUser?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyUserMfaCode} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Código MFA Recebido no E-mail (6 dígitos)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={mfaCodeInput}
                onChange={(e) => setMfaCodeInput(e.target.value.replace(/\D/g, ""))}
                placeholder="Digite os 6 dígitos enviados ao e-mail"
                className="w-full px-3 py-2.5 text-center font-mono text-lg font-extrabold tracking-[0.3em] border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMfaModalOpen(false)}
                className="text-xs font-semibold"
              >
                Fechar
              </Button>

              <Button
                type="submit"
                disabled={verifyingMfa || mfaCodeInput.length !== 6}
                className="bg-rotary-blue hover:bg-[#0c2340] text-white font-bold text-xs"
              >
                {verifyingMfa ? "Validando..." : "Validar Código MFA"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
