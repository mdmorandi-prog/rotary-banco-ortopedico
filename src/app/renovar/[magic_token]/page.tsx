'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Phone,
  RefreshCw,
  Truck,
  ShieldCheck,
  AlertTriangle,
  MessageCircle,
  Camera,
  Clock,
  HeartHandshake,
  Info,
  ArrowLeft,
  FileText,
  Building2,
} from 'lucide-react';
import { dataRepository } from '@/lib/data-layer/repository';
import { Loan } from '@/lib/data-layer/types';
import {
  DEFAULT_CLUB_INFO,
  LOAN_STATUS_LABELS,
  CATEGORY_LABELS,
} from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { cleanPhoneForWhatsApp, createWaMeUrl } from '@/lib/whatsapp';
import { generateComodatoContractPDF } from '@/lib/pdf-contract';

export default function PublicMagicRenewalPage() {
  const params = useParams<{ magic_token: string }>();
  const magicToken = Array.isArray(params?.magic_token)
    ? params.magic_token[0]
    : params?.magic_token || '';

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [renewing, setRenewing] = useState<boolean>(false);
  const [requestingPickup, setRequestingPickup] = useState<boolean>(false);
  const [notifyingSede, setNotifyingSede] = useState<boolean>(false);

  // Elder-friendly form states
  const [addressConfirmed, setAddressConfirmed] = useState<boolean>(false);
  const [observation, setObservation] = useState<string>('');
  const [photoPreviewName, setPhotoPreviewName] = useState<string>('');
  const [renewalSuccessMessage, setRenewalSuccessMessage] = useState<string | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [pickupRequested, setPickupRequested] = useState<boolean>(false);
  const [sedeDeliveredSuccess, setSedeDeliveredSuccess] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function fetchLoan() {
      if (!magicToken) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const found = await dataRepository.getLoanByMagicToken(magicToken);
        if (mounted) {
          setLoan(found);
        }
      } catch (err) {
        console.error('Erro ao carregar empréstimo por magic_token:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchLoan();
    return () => {
      mounted = false;
    };
  }, [magicToken]);

  // Automated background GPS audit on renewal portal load
  useEffect(() => {
    if (!loan || !magicToken) return;
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          dataRepository
            .updateLoanGps(magicToken, latitude, longitude, accuracy)
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [loan?.id, magicToken]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoPreviewName(file.name);
    }
  };

  const handleRenewLoan = async () => {
    if (!loan) return;
    setRenewalError(null);

    if (!addressConfirmed) {
      setRenewalError(
        'Por favor, marque a caixa confirmando que o equipamento permanece no mesmo endereço e telefone antes de renovar.'
      );
      return;
    }

    try {
      setRenewing(true);
      const result = await dataRepository.renewLoan(magicToken);

      if (!result.success || !result.loan) {
        setRenewalError(
          result.message ||
            'Não foi possível concluir a renovação automática. Fale com nossa equipe pelo WhatsApp abaixo.'
        );
        return;
      }

      // If beneficiary left an observation or photo note, record an audit event
      if (observation.trim() || photoPreviewName) {
        await dataRepository.addLoanEvent({
          loan_id: loan.id,
          event_type: 'RENEWED',
          new_status: 'ATIVO',
          notes: `Confirmação de endereço no Portal Público.${
            observation.trim() ? ` Observação do beneficiário: "${observation.trim()}".` : ''
          }${photoPreviewName ? ` Foto anexada: ${photoPreviewName}.` : ''}`,
        });
      }

      setLoan(result.loan);

      // Audit renewal location via device GPS
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            dataRepository
              .updateLoanGps(magicToken, latitude, longitude, accuracy)
              .catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }

      setRenewalSuccessMessage(
        result.message ||
          `Pronto! Empréstimo renovado por +30 dias até ${formatDate(
            result.loan.expected_return_date
          )}.`
      );

      // Celebratory confetti
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignore confetti errors on restricted devices
      }
    } catch (err) {
      console.error('Erro ao renovar empréstimo:', err);
      setRenewalError('Ocorreu um erro ao processar sua renovação. Tente novamente.');
    } finally {
      setRenewing(false);
    }
  };

  const handleNotifySedeDelivery = async () => {
    if (!loan) return;
    try {
      setNotifyingSede(true);
      const ben = loan.beneficiary;
      const res = await dataRepository.notifyReturnIntent(magicToken, 'SEDE', observation.trim());
      if (res.loan) {
        setLoan(res.loan);
      }
      setSedeDeliveredSuccess(true);
      setPickupRequested(false);

      // Automated Evolution WhatsApp notification to Rotary
      fetch('/api/whatsapp/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          phone: cleanPhoneForWhatsApp(DEFAULT_CLUB_INFO.contactPhone),
          message:
            `🔔 *Aviso do Portal — Devolução na Sede do Rotary*\n\n` +
            `O beneficiário *${ben?.full_name || 'Beneficiário'}* informou pelo portal que levará o equipamento à sede do Rotary.\n\n` +
            `• *Equipamento:* ${loan.equipment?.name || 'Equipamento'} (#${loan.equipment?.patrimony_code || '—'})\n` +
            `• *Contrato:* ${loan.loan_code}\n` +
            `• *Telefone:* ${ben?.phone || '—'}\n` +
            `${observation.trim() ? `• *Observação do Usuário:* "${observation.trim()}"\n` : ''}` +
            `\n_Ao receber o equipamento na sede, realize a vistoria e emita o Termo de Quitação no sistema._`,
        }),
      }).catch(() => {});
    } catch (err) {
      console.error('Erro ao registrar aviso de devolução na sede:', err);
    } finally {
      setNotifyingSede(false);
    }
  };

  const handleRequestHomePickup = async () => {
    if (!loan) return;
    try {
      setRequestingPickup(true);
      const ben = loan.beneficiary;
      const fullAddress = ben
        ? `${ben.address_street}, ${ben.address_number}${
            ben.address_complement ? ` (${ben.address_complement})` : ''
          } - ${ben.address_neighborhood}, ${ben.address_city}/${ben.address_state}`
        : 'Endereço do cadastro';

      const res = await dataRepository.notifyReturnIntent(magicToken, 'COLETA', observation.trim());
      if (res.loan) {
        setLoan(res.loan);
      }

      setPickupRequested(true);
      setSedeDeliveredSuccess(false);

      // Automated Evolution WhatsApp notification to Rotary
      fetch('/api/whatsapp/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          phone: cleanPhoneForWhatsApp(DEFAULT_CLUB_INFO.contactPhone),
          message:
            `🔔 *Solicitação de Coleta em Domicílio — Banco Ortopédico*\n\n` +
            `O beneficiário *${ben?.full_name || 'Beneficiário'}* solicitou busca em casa pelo portal.\n\n` +
            `• *Equipamento:* ${loan.equipment?.name || 'Equipamento'} (#${loan.equipment?.patrimony_code || '—'})\n` +
            `• *Contrato:* ${loan.loan_code}\n` +
            `• *Telefone:* ${ben?.phone || '—'}\n` +
            `• *Endereço para Retirada:* ${fullAddress}\n` +
            `${observation.trim() ? `• *Observação:* "${observation.trim()}"\n` : ''}` +
            `\n_Favor entrar em contato para agendar o recolhimento com os voluntários._`,
        }),
      }).catch(() => {});

      const coordinatorPhone = cleanPhoneForWhatsApp(DEFAULT_CLUB_INFO.contactPhone);
      const msg =
        `Olá! Aqui é *${ben?.full_name || 'Beneficiário'}*.\n\n` +
        `Já concluímos o uso do equipamento *${loan.equipment?.name || 'Ortopédico'}* (*#${
          loan.equipment?.patrimony_code || loan.equipment_id
        }* - Contrato ${loan.loan_code}), mas *precisamos de ajuda para buscar em casa* (item grande / dificuldade de transporte).\n\n` +
        `📍 *Endereço para retirada:* ${fullAddress}\n` +
        `📞 *Telefone de contato:* ${ben?.phone || ''}\n` +
        `${observation.trim() ? `📝 *Observação:* ${observation.trim()}\n` : ''}` +
        `\nPodemos combinar o melhor dia e horário para a retirada? Muito obrigado ao Rotary!`;

      const waUrl = createWaMeUrl(coordinatorPhone, msg);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Erro ao solicitar coleta domiciliar:', err);
    } finally {
      setRequestingPickup(false);
    }
  };

  const buildVolunteerSupportWhatsAppUrl = () => {
    const coordinatorPhone = cleanPhoneForWhatsApp(DEFAULT_CLUB_INFO.contactPhone);
    const benName = loan?.beneficiary?.full_name || 'Beneficiário';
    const itemName = loan?.equipment?.name || 'Equipamento';
    const patrimony = loan?.equipment?.patrimony_code || '';
    const msg =
      `Olá! Meu nome é *${benName}*.\n` +
      `Estou com o equipamento *${itemName}* (*#${patrimony}*, contrato ${
        loan?.loan_code || ''
      }) do Banco Ortopédico do ${DEFAULT_CLUB_INFO.clubName}.\n\n` +
      `Atingi o limite de renovações automáticas pelo link e gostaria de conversar com um voluntário para solicitar prorrogação especial.`;
    return createWaMeUrl(coordinatorPhone, msg);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-[#17458f] border-t-[#f7a81b] rounded-full animate-spin mb-6" />
        <h1 className="text-2xl font-bold text-slate-900">
          Carregando informações do seu empréstimo...
        </h1>
        <p className="text-lg text-slate-600 mt-2">
          Aguarde um instante, estamos consultando o Banco Ortopédico do Rotary.
        </p>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-9 h-9" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3">
            Link de Renovação Não Encontrado
          </h1>
          <p className="text-lg text-slate-700 leading-relaxed mb-6">
            Não localizamos um empréstimo ativo vinculado ao código{' '}
            <code className="bg-slate-100 px-2 py-1 rounded font-mono text-base text-slate-800">
              {magicToken}
            </code>
            . Verifique se o link foi copiado completo do WhatsApp ou fale diretamente com nossa
            equipe.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={createWaMeUrl(
                DEFAULT_CLUB_INFO.contactPhone,
                'Olá! Preciso de ajuda para renovar ou devolver um equipamento do Banco Ortopédico do Rotary.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-lg px-6 py-4 rounded-xl shadow transition"
            >
              <MessageCircle className="w-6 h-6" />
              Falar no WhatsApp do Rotary
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-lg px-6 py-4 rounded-xl transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar ao Início
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const beneficiary = loan.beneficiary;
  const equipment = loan.equipment;
  const maxRenewalsReached = loan.renewal_count >= loan.max_renewals;
  const isReturned = loan.status === 'DEVOLVIDO' || loan.status === 'CANCELADO';
  const formattedAddress = beneficiary
    ? `${beneficiary.address_street}, Nº ${beneficiary.address_number}${
        beneficiary.address_complement ? ` (${beneficiary.address_complement})` : ''
      }, Bairro ${beneficiary.address_neighborhood}, ${beneficiary.address_city}/${
        beneficiary.address_state
      }`
    : 'Endereço cadastrado no termo';
  const formattedPhone = beneficiary?.phone || DEFAULT_CLUB_INFO.contactPhone;

  const getStatusBadgeClasses = (status: string) => {
    if (status === 'ATRASADO') {
      return 'bg-red-100 text-red-900 border-2 border-red-400';
    }
    if (status === 'DEVOLVIDO') {
      return 'bg-slate-200 text-slate-800 border-2 border-slate-400';
    }
    return 'bg-emerald-100 text-emerald-900 border-2 border-emerald-400';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16">
      {/* Elder-Friendly High-Contrast Rotary Header */}
      <header className="bg-[#0c2340] text-white border-b-4 border-[#f7a81b] py-6 px-4 shadow-md">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Accessible Rotary Gear Emblem */}
            <div
              className="w-14 h-14 rounded-full bg-[#f7a81b] text-[#0c2340] flex items-center justify-center font-black text-2xl shadow-inner shrink-0"
              aria-hidden="true"
            >
              ⚙
            </div>
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#f7a81b] bg-white/10 px-2.5 py-0.5 rounded mb-1">
                Portal Público de Autoatendimento (Sem Senha)
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">
                {DEFAULT_CLUB_INFO.clubName}
              </h1>
              <p className="text-sm sm:text-base text-slate-200">
                Banco de Aparelhos Ortopédicos • {DEFAULT_CLUB_INFO.district}
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right bg-white/10 px-4 py-2 rounded-xl border border-white/15">
            <div className="text-xs uppercase tracking-wider text-slate-300">Contrato</div>
            <div className="text-lg font-mono font-bold text-[#f7a81b]">{loan.loan_code}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-8">
        {/* Celebratory Banner on Renewal Success */}
        {renewalSuccessMessage && (
          <div
            role="status"
            aria-live="polite"
            className="bg-emerald-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border-4 border-[#f7a81b] animate-in fade-in duration-300"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#f7a81b] text-[#0c2340] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <span className="inline-block bg-[#f7a81b] text-[#0c2340] font-black text-sm uppercase px-3 py-1 rounded-full">
                  Renovação Confirmada com Sucesso!
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold">
                  Nova Data de Devolução: {formatDate(loan.expected_return_date)}
                </h2>
                <p className="text-lg text-emerald-100 leading-relaxed">
                  {renewalSuccessMessage} Você não precisa ir até a sede do Rotary agora. Continue
                  cuidando bem do equipamento!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Summary Card (High Contrast & Large Typography) */}
        <section
          aria-label="Dados do Empréstimo"
          className="bg-white rounded-2xl shadow-md border-2 border-slate-300 overflow-hidden"
        >
          <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-[#f7a81b]" />
              <h2 className="text-lg sm:text-xl font-bold">Resumo do Seu Empréstimo</h2>
            </div>
            <span
              className={`px-4 py-1.5 rounded-full text-base font-extrabold uppercase tracking-wide ${getStatusBadgeClasses(
                loan.status
              )}`}
            >
              Status: {LOAN_STATUS_LABELS[loan.status] || loan.status}
            </span>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Beneficiary & Equipment Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-5 rounded-xl border-2 border-slate-200">
                <div className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Beneficiário(a) / Responsável
                </div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {beneficiary?.full_name || 'Beneficiário Rotary'}
                </div>
                {beneficiary?.is_patient_same_as_responsible === false &&
                  beneficiary?.patient_name && (
                    <div className="text-base font-semibold text-slate-700 mt-1">
                      Paciente atendido: {beneficiary.patient_name}
                    </div>
                  )}
              </div>

              <div className="bg-blue-50/70 p-5 rounded-xl border-2 border-blue-200">
                <div className="text-sm font-bold uppercase tracking-wider text-[#17458f] mb-1">
                  Equipamento Emprestado
                </div>
                <div className="text-2xl font-extrabold text-slate-900">
                  {equipment?.name || 'Aparelho Ortopédico'}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-block bg-[#17458f] text-white font-mono font-bold text-base px-3 py-1 rounded-lg">
                    #{equipment?.patrimony_code || loan.equipment_id}
                  </span>
                  {equipment?.category && (
                    <span className="text-base font-semibold text-slate-700">
                      • {CATEGORY_LABELS[equipment.category] || equipment.category}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Expected Return Date & Renewals Counter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className={`p-5 rounded-xl border-2 flex items-center gap-4 ${
                  loan.status === 'ATRASADO'
                    ? 'bg-red-50 border-red-300'
                    : 'bg-amber-50/70 border-amber-300'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                    loan.status === 'ATRASADO'
                      ? 'bg-red-700 text-white'
                      : 'bg-[#0c2340] text-[#f7a81b]'
                  }`}
                >
                  <Calendar className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Data Prevista de Retorno / Renovação
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900">
                    {formatDate(loan.expected_return_date)}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#17458f] text-white flex items-center justify-center shrink-0">
                  <RefreshCw className="w-7 h-7" />
                </div>
                <div className="w-full">
                  <div className="text-sm font-bold uppercase tracking-wider text-slate-700">
                    Contador de Renovações
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {loan.renewal_count} de {loan.max_renewals} renovações utilizadas
                  </div>
                  <div className="w-full bg-slate-200 h-3 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-[#17458f] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (loan.renewal_count / Math.max(1, loan.max_renewals)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Download Signed Comodato Contract PDF Button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => generateComodatoContractPDF(loan)}
                  className="w-full flex items-center justify-center gap-3 bg-[#0c2340] hover:bg-[#17458f] text-white font-extrabold text-base sm:text-lg px-6 py-4 rounded-xl shadow-md transition cursor-pointer"
                >
                  <FileText className="w-6 h-6 text-[#f7a81b]" />
                  <span>Visualizar / Baixar 2ª Via do Contrato Assinado (PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {isReturned ? (
          <section className="bg-white rounded-2xl shadow-md border-2 border-emerald-400 p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-700 mx-auto" />
            <h2 className="text-2xl font-extrabold text-slate-900">
              Este equipamento já consta como devolvido!
            </h2>
            <p className="text-lg text-slate-700">
              Agradecemos imensamente sua parceria com o Banco Ortopédico do Rotary.
            </p>
            <Link
              href={`/loans/${loan.id}/receipt`}
              className="inline-flex items-center justify-center gap-2 bg-[#17458f] hover:bg-[#0c2340] text-white font-bold text-lg px-6 py-4 rounded-xl shadow transition"
            >
              Ver Termo de Quitação (Art. 320 CCB)
            </Link>
          </section>
        ) : (
          <>
            {/* Instructions Callout */}
            <div className="bg-[#0c2340] text-white rounded-2xl p-5 sm:p-6 flex items-center gap-4 shadow">
              <Info className="w-8 h-8 text-[#f7a81b] shrink-0" />
              <p className="text-lg sm:text-xl font-semibold leading-snug">
                Escolha abaixo uma das <span className="text-[#f7a81b] underline">2 opções</span>:
                renovar por mais 30 dias se ainda estiver usando, ou devolver se não precisar mais.
              </p>
            </div>

            {/* ACTION CARD 1: AINDA PRECISO DO EQUIPAMENTO (RENOVAR POR +30 DIAS) */}
            <section
              aria-labelledby="card-renew-heading"
              className="bg-white rounded-2xl shadow-lg border-4 border-emerald-600 overflow-hidden"
            >
              <div className="bg-emerald-800 text-white px-6 py-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white text-emerald-900 font-black text-xl flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h2 id="card-renew-heading" className="text-xl sm:text-2xl font-extrabold">
                    Ainda preciso do equipamento (Renovar por +30 dias)
                  </h2>
                  <p className="text-emerald-100 text-base">
                    Prorrogação rápida, gratuita e sem burocracia
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {maxRenewalsReached ? (
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-8 h-8 text-amber-800 shrink-0 mt-1" />
                      <div className="space-y-2">
                        <h3 className="text-xl font-extrabold text-amber-950">
                          Limite de renovações automáticas atingido ({loan.renewal_count} de{' '}
                          {loan.max_renewals})
                        </h3>
                        <p className="text-lg text-amber-900 leading-relaxed">
                          Você já utilizou todas as {loan.max_renewals} renovações automáticas pelo
                          site. Mas não se preocupe! Se o paciente ainda precisa do aparelho, basta
                          clicar no botão abaixo para falar com um voluntário do Rotary no WhatsApp
                          e liberar um novo prazo.
                        </p>
                      </div>
                    </div>

                    <a
                      href={buildVolunteerSupportWhatsAppUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-3 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xl px-6 py-5 rounded-xl shadow-lg transition"
                    >
                      <MessageCircle className="w-7 h-7" />
                      Falar com Voluntário no WhatsApp para Renovar
                    </a>
                  </div>
                ) : (
                  <>
                    {/* Address & Phone Confirmation Checkbox */}
                    <label
                      htmlFor="confirm-address-checkbox"
                      className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition select-none ${
                        addressConfirmed
                          ? 'bg-emerald-50 border-emerald-600'
                          : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <input
                        id="confirm-address-checkbox"
                        type="checkbox"
                        checked={addressConfirmed}
                        onChange={(e) => {
                          setAddressConfirmed(e.target.checked);
                          if (e.target.checked) setRenewalError(null);
                        }}
                        className="w-7 h-7 mt-1 rounded border-2 border-slate-400 text-emerald-700 focus:ring-emerald-600 shrink-0 cursor-pointer"
                      />
                      <span className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                        Confirmo que o equipamento permanece no mesmo endereço:{' '}
                        <span className="underline decoration-emerald-600">{formattedAddress}</span>{' '}
                        e telefone <span className="underline decoration-emerald-600">{formattedPhone}</span>.
                      </span>
                    </label>

                    {/* Optional Observation & Optional Photo Upload */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="renewal-observation"
                          className="block text-base font-bold text-slate-800 mb-2"
                        >
                          Observação ou atualização de estado (Opcional):
                        </label>
                        <input
                          id="renewal-observation"
                          type="text"
                          value={observation}
                          onChange={(e) => setObservation(e.target.value)}
                          placeholder="Ex: Equipamento em ótimo estado, paciente em fisioterapia..."
                          className="w-full px-4 py-3.5 text-lg rounded-xl border-2 border-slate-300 focus:border-[#17458f] focus:outline-none text-slate-900"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="renewal-photo"
                          className="block text-base font-bold text-slate-800 mb-2"
                        >
                          Foto atual do equipamento (Opcional):
                        </label>
                        <label
                          htmlFor="renewal-photo"
                          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-lg font-semibold rounded-xl border-2 border-dashed border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-800 cursor-pointer transition"
                        >
                          <Camera className="w-6 h-6 text-[#17458f]" />
                          <span className="truncate">
                            {photoPreviewName || 'Enviar foto do aparelho (opcional)'}
                          </span>
                          <input
                            id="renewal-photo"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoSelect}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </div>

                    {renewalError && (
                      <div
                        role="alert"
                        className="bg-red-50 border-2 border-red-400 text-red-900 p-4 rounded-xl font-bold text-lg flex items-center gap-3"
                      >
                        <AlertTriangle className="w-6 h-6 text-red-700 shrink-0" />
                        <span>{renewalError}</span>
                      </div>
                    )}

                    {/* High Contrast Large Action Button */}
                    <button
                      type="button"
                      onClick={handleRenewLoan}
                      disabled={renewing}
                      className="w-full flex items-center justify-center gap-3 bg-[#f7a81b] hover:bg-[#e59400] text-[#0c2340] font-black text-xl sm:text-2xl px-8 py-6 rounded-2xl shadow-lg border-2 border-[#0c2340] transition disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw className={`w-8 h-8 ${renewing ? 'animate-spin' : ''}`} />
                      {renewing
                        ? 'Renovando seu empréstimo...'
                        : 'RENOVAR AGORA POR +30 DIAS GRATUITAMENTE'}
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* ACTION CARD 2: NÃO PRECISO MAIS / QUERO DEVOLVER */}
            <section
              aria-labelledby="card-return-heading"
              className="bg-white rounded-2xl shadow-lg border-4 border-[#17458f] overflow-hidden"
            >
              <div className="bg-[#17458f] text-white px-6 py-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f7a81b] text-[#0c2340] font-black text-xl flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h2 id="card-return-heading" className="text-xl sm:text-2xl font-extrabold">
                    Não preciso mais / Quero devolver
                  </h2>
                  <p className="text-blue-100 text-base">
                    Sua devolução ajuda imediatamente outra família na fila de espera!
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {/* Rotary Bank Return Address & Hours */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-xl border-2 border-slate-200">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-7 h-7 text-[#17458f] shrink-0 mt-1" />
                    <div>
                      <div className="text-sm font-bold uppercase text-slate-600">
                        Local de Devolução
                      </div>
                      <div className="text-lg font-extrabold text-slate-900">
                        Sede do {DEFAULT_CLUB_INFO.clubName}
                      </div>
                      <div className="text-base font-semibold text-slate-800">
                        {DEFAULT_CLUB_INFO.address}
                      </div>
                      <div className="text-sm text-slate-600">
                        CEP: {DEFAULT_CLUB_INFO.cep} • {DEFAULT_CLUB_INFO.city}
                      </div>
                      <a
                        href="https://maps.google.com/?q=Rua+Nataly+Valentini,+75,+Farroupilha+-+RS"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#17458f] hover:underline mt-1.5"
                      >
                        📍 Abrir rota no Google Maps
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-7 h-7 text-[#17458f] shrink-0 mt-1" />
                    <div>
                      <div className="text-sm font-bold uppercase text-slate-600">
                        Horário de Atendimento
                      </div>
                      <div className="text-lg font-extrabold text-slate-900">
                        Seg a Sex: 09h às 17h
                      </div>
                      <div className="text-base text-slate-700">Plantão Rotary</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-7 h-7 text-[#17458f] shrink-0 mt-1" />
                    <div>
                      <div className="text-sm font-bold uppercase text-slate-600">
                        Telefone / WhatsApp
                      </div>
                      <div className="text-lg font-extrabold text-slate-900">
                        {DEFAULT_CLUB_INFO.contactPhone}
                      </div>
                      <div className="text-base text-slate-700">Plantão do Banco</div>
                    </div>
                  </div>
                </div>

                {/* Notifications of recorded intents */}
                {sedeDeliveredSuccess && (
                  <div
                    role="status"
                    className="bg-emerald-50 border-2 border-emerald-600 text-emerald-950 p-5 rounded-xl flex items-start gap-3 animate-in fade-in duration-300"
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-lg font-medium leading-relaxed">
                      ✅ <strong className="font-bold text-emerald-900">Aviso registrado no sistema do Rotary!</strong> Notificamos os voluntários de que você entregará o equipamento na sede. Ao chegar com o aparelho, emitiremos o seu Termo Oficial de Quitação. Muito obrigado pela sua colaboração!
                    </div>
                  </div>
                )}

                {pickupRequested && (
                  <div
                    role="status"
                    className="bg-blue-50 border-2 border-[#17458f] text-slate-900 p-5 rounded-xl flex items-start gap-3 animate-in fade-in duration-300"
                  >
                    <CheckCircle2 className="w-8 h-8 text-[#17458f] shrink-0 mt-0.5" />
                    <div className="text-lg font-medium leading-relaxed">
                      ✅ <strong className="font-bold text-[#17458f]">Solicitação de coleta registrada no sistema!</strong> Nossos voluntários do Rotary receberam o pedido com o seu endereço e entrarão em contato para combinar a retirada.
                    </div>
                  </div>
                )}

                {/* Two Distinct Return Options */}
                <div className="space-y-3 pt-1">
                  <p className="text-lg text-slate-800 font-bold">
                    Como você prefere devolver o equipamento?
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Opção A: Levar na Sede do Rotary */}
                    <div className="p-5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-900 bg-emerald-200/80 px-2.5 py-1 rounded-md">
                          <Building2 className="w-4 h-4 text-emerald-800" />
                          Opção 1 • Entrega Direta
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900">
                          Vou levar e entregar no Rotary
                        </h3>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          Recomendado se você ou algum familiar puder levar o aparelho até a sede do Rotary em Farroupilha.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleNotifySedeDelivery}
                        disabled={notifyingSede}
                        className="w-full flex items-center justify-center gap-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-base px-5 py-4 rounded-xl shadow-md transition cursor-pointer disabled:opacity-60"
                      >
                        <Building2 className="w-5 h-5" />
                        <span>{notifyingSede ? 'Registrando aviso...' : 'Avisar que vou levar na sede'}</span>
                      </button>
                    </div>

                    {/* Opção B: Pedir Coleta Domiciliar */}
                    <div className="p-5 rounded-2xl border-2 border-blue-300 bg-blue-50/60 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-blue-900 bg-blue-200/80 px-2.5 py-1 rounded-md">
                          <Truck className="w-4 h-4 text-[#17458f]" />
                          Opção 2 • Coleta em Casa
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900">
                          Preciso que busquem em casa
                        </h3>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          Para itens grandes/pesados (como cama hospitalar ou cadeira de rodas) ou impossibilidade de transporte.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequestHomePickup}
                        disabled={requestingPickup}
                        className="w-full flex items-center justify-center gap-2.5 bg-[#17458f] hover:bg-[#0c2340] text-white font-extrabold text-base px-5 py-4 rounded-xl shadow-md transition cursor-pointer disabled:opacity-60"
                      >
                        <Truck className="w-5 h-5 text-[#f7a81b]" />
                        <span>{requestingPickup ? 'Registrando pedido...' : 'Solicitar retirada em casa'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Solidarity Footer */}
        <footer className="text-center pt-4 pb-8 text-slate-600 space-y-2">
          <div className="inline-flex items-center gap-2 text-[#17458f] font-bold text-base">
            <HeartHandshake className="w-5 h-5" />
            <span>Dar de Si Antes de Pensar em Si • Rotary International</span>
          </div>
          <p className="text-sm">
            Ao devolver o equipamento ao término do tratamento, você recebe seu Termo Oficial de
            Quitação (Art. 320 do Código Civil).
          </p>
        </footer>
      </main>
    </div>
  );
}
