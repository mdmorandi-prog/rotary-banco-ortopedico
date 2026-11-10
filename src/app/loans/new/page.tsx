'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCheck,
  ShieldAlert,
  Camera,
  FileText,
  PenTool,
  Download,
  MessageCircle,
  Sparkles,
  MapPin,
  Phone,
  Users,
  Check,
  RotateCcw,
  ExternalLink,
  AlertCircle,
  Loader2,
  Package,
} from 'lucide-react';
import { dataRepository } from '@/lib/data-layer/repository';
import { Equipment, Loan } from '@/lib/data-layer/types';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  DEFAULT_CLUB_INFO,
} from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  isValidCPF,
  formatCPF,
  formatPhone,
  formatCEP,
  onlyDigits,
  validateSecondaryContact,
} from '@/lib/validators';
import {
  compressDocumentImage,
  createDemoDocumentDataUrl,
} from '@/lib/image-compression';
import { generateComodatoContractPDF } from '@/lib/pdf-contract';

const RELATIONSHIP_OPTIONS = [
  'Filho(a)',
  'Cônjuge',
  'Irmão(ã)',
  'Vizinho(a)',
  'Sobrinho(a)',
  'Neto(a)',
  'Cuidador(a)',
  'Outro',
];

const MEDICAL_REASON_SUGGESTIONS = [
  'Pós-operatório fêmur',
  'AVC / Reabilitação motora',
  'Fratura tornozelo / tíbia',
  'Idoso com mobilidade reduzida',
  'Pós-cirúrgico joelho',
];

function FastCheckoutWizardInner() {
  const searchParams = useSearchParams();
  const preselectedEquipmentId = searchParams.get('equipment_id');

  // Wizard Step (1 to 5)
  const [step, setStep] = useState<number>(1);
  const [loadingEquipments, setLoadingEquipments] = useState<boolean>(true);
  const [availableEquipments, setAvailableEquipments] = useState<Equipment[]>([]);
  const [equipmentSearch, setEquipmentSearch] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

  // Step 2: Beneficiary & Mandatory Secondary Contact
  const [cpf, setCpf] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [rg, setRg] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isPatientSame, setIsPatientSame] = useState<boolean>(true);
  const [patientName, setPatientName] = useState<string>('');
  const [medicalReason, setMedicalReason] = useState<string>('');

  // Address
  const [cep, setCep] = useState<string>('');
  const [loadingCep, setLoadingCep] = useState<boolean>(false);
  const [street, setStreet] = useState<string>('');
  const [number, setNumber] = useState<string>('');
  const [complement, setComplement] = useState<string>('');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [city, setCity] = useState<string>('Farroupilha');
  const [stateUf, setStateUf] = useState<string>('RS');

  // Secondary Contact (Mandatory - Art. 585 CCB)
  const [secondaryName, setSecondaryName] = useState<string>('');
  const [secondaryRelationship, setSecondaryRelationship] = useState<string>('Filho(a)');
  const [secondaryPhone, setSecondaryPhone] = useState<string>('');
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Step 3: Compressed Security Photos
  const [docPhotoUrl, setDocPhotoUrl] = useState<string>('');
  const [docPhotoStats, setDocPhotoStats] = useState<{ originalKB: number; compressedKB: number } | null>(null);
  const [resPhotoUrl, setResPhotoUrl] = useState<string>('');
  const [resPhotoStats, setResPhotoStats] = useState<{ originalKB: number; compressedKB: number } | null>(null);
  const [compressingDoc, setCompressingDoc] = useState<boolean>(false);
  const [compressingRes, setCompressingRes] = useState<boolean>(false);

  // Step 4: Term, Legal Acceptance & Digital Signature Canvas
  const [termDays, setTermDays] = useState<number>(60);
  const [spontaneousDonation, setSpontaneousDonation] = useState<string>('');
  const [acceptedClauses, setAcceptedClauses] = useState<boolean>(true);
  const [hasSigned, setHasSigned] = useState<boolean>(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Step 5: Created Loan Result
  const [createdLoan, setCreatedLoan] = useState<Loan | null>(null);

  // Load available equipments & handle preselected equipment_id
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingEquipments(true);
      try {
        const allAvailable = await dataRepository.getEquipments({ status: 'DISPONIVEL' });
        if (!active) return;

        if (preselectedEquipmentId) {
          const target = await dataRepository.getEquipmentById(preselectedEquipmentId);
          if (target && active) {
            setSelectedEquipment(target);
            if (!allAvailable.some((e) => e.id === target.id)) {
              setAvailableEquipments([target, ...allAvailable]);
            } else {
              setAvailableEquipments(allAvailable);
            }
            setLoadingEquipments(false);
            return;
          }
        }

        setAvailableEquipments(allAvailable);
        if (allAvailable.length > 0 && !selectedEquipment) {
          setSelectedEquipment(allAvailable[0]);
        }
      } catch (err) {
        console.error('Erro ao carregar equipamentos:', err);
        toast.error('Erro ao carregar equipamentos disponíveis.');
      } finally {
        if (active) setLoadingEquipments(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [preselectedEquipmentId]);

  // Initialize signature canvas background when entering Step 4
  useEffect(() => {
    if (step === 4 && canvasRef.current && !hasSigned) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24, canvas.height - 32);
        ctx.lineTo(canvas.width - 24, canvas.height - 32);
        ctx.stroke();
      }
    }
  }, [step, hasSigned]);

  // CPF Lookup Handler
  const handleLookupCpf = async (cpfToLookup?: string) => {
    const targetCpf = cpfToLookup ?? cpf;
    const clean = onlyDigits(targetCpf);
    if (clean.length < 11) {
      toast.warning('Digite os 11 números do CPF para buscar no cadastro.');
      return;
    }

    const found = await dataRepository.getBeneficiaryByCpf(clean);
    if (found) {
      setCpf(formatCPF(found.cpf));
      setFullName(found.full_name);
      setRg(found.rg || '');
      setPhone(formatPhone(found.phone));
      setIsPatientSame(found.is_patient_same_as_responsible !== false);
      setPatientName(found.patient_name || '');
      setMedicalReason(found.notes || 'Pós-operatório fêmur');
      setCep(formatCEP(found.address_zipcode || found.address_cep || ''));
      setStreet(found.address_street || '');
      setNumber(found.address_number || '');
      setComplement(found.address_complement || '');
      setNeighborhood(found.address_neighborhood || '');
      setCity(found.address_city || 'Farroupilha');
      setStateUf(found.address_state || 'RS');
      setSecondaryName(found.secondary_name || found.secondary_contact_name || '');
      setSecondaryRelationship(
        found.secondary_relationship || found.secondary_contact_relationship || 'Filho(a)'
      );
      setSecondaryPhone(
        formatPhone(found.secondary_phone || found.secondary_contact_phone || '')
      );
      setStep2Error(null);
      toast.success(`Cadastro de ${found.full_name} preenchido automaticamente!`);
    } else {
      toast.info('CPF ainda não cadastrado. Preencha os dados para novo cadastro.');
    }
  };

  // ViaCEP Auto-fill Handler
  const handleCepLookup = async (rawCep: string) => {
    const formatted = formatCEP(rawCep);
    setCep(formatted);
    const cleanCep = onlyDigits(formatted);
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          setStreet(data.logradouro || street);
          setNeighborhood(data.bairro || neighborhood);
          setCity(data.localidade || city);
          setStateUf(data.uf || stateUf);
          toast.success('Endereço preenchido via CEP!');
        }
      }
    } catch {
      // Offline fallback: let user type manually without error
    } finally {
      setLoadingCep(false);
    }
  };

  // Validate Step 2 before advancing
  const handleValidateStep2 = () => {
    setStep2Error(null);

    if (!isValidCPF(cpf)) {
      const msg = 'Informe um CPF válido (11 dígitos verificados pelo Módulo 11).';
      setStep2Error(msg);
      toast.error(msg);
      return;
    }

    if (fullName.trim().split(/\s+/).length < 2) {
      const msg = 'Informe o nome e sobrenome do responsável pela retirada.';
      setStep2Error(msg);
      toast.error(msg);
      return;
    }

    if (onlyDigits(phone).length < 10) {
      const msg = 'Informe um telefone/WhatsApp principal válido com DDD.';
      setStep2Error(msg);
      toast.error(msg);
      return;
    }

    if (!isPatientSame && patientName.trim().length < 3) {
      const msg = 'Informe o nome completo do paciente que utilizará o equipamento.';
      setStep2Error(msg);
      toast.error(msg);
      return;
    }

    if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim()) {
      const msg = 'Preencha o endereço residencial completo (Rua, Número, Bairro e Cidade).';
      setStep2Error(msg);
      toast.error(msg);
      return;
    }

    const secCheck = validateSecondaryContact(
      fullName,
      phone,
      secondaryName,
      secondaryRelationship,
      secondaryPhone
    );

    if (!secCheck.valid) {
      setStep2Error(secCheck.error || 'Contato secundário inválido.');
      toast.error(secCheck.error || 'Contato secundário inválido.');
      return;
    }

    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 3 Photo Upload Handlers
  const handleDocumentPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingDoc(true);
    try {
      const result = await compressDocumentImage(file);
      setDocPhotoUrl(result.dataUrl);
      setDocPhotoStats({
        originalKB: result.originalSizeKB,
        compressedKB: result.compressedSizeKB,
      });
      toast.success(`Documento comprimido para ${result.compressedSizeKB} KB!`);
    } catch {
      toast.error('Não foi possível processar a imagem do documento.');
    } finally {
      setCompressingDoc(false);
    }
  };

  const handleResidencePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingRes(true);
    try {
      const result = await compressDocumentImage(file);
      setResPhotoUrl(result.dataUrl);
      setResPhotoStats({
        originalKB: result.originalSizeKB,
        compressedKB: result.compressedSizeKB,
      });
      toast.success(`Comprovante comprimido para ${result.compressedSizeKB} KB!`);
    } catch {
      toast.error('Não foi possível processar a imagem do comprovante.');
    } finally {
      setCompressingRes(false);
    }
  };

  const handleFillDemoPhotos = () => {
    const holder = fullName.trim() || 'Maria das Dores Silva';
    setDocPhotoUrl(createDemoDocumentDataUrl('DOCUMENTO OFICIAL (RG / CNH)', holder));
    setDocPhotoStats({ originalKB: 4280, compressedKB: 138 });
    setResPhotoUrl(createDemoDocumentDataUrl('COMPROVANTE DE RESIDÊNCIA', holder));
    setResPhotoStats({ originalKB: 3890, compressedKB: 124 });
    toast.success('Fotos de segurança de exemplo geradas e comprimidas (< 140 KB)!');
  };

  // Step 4 Canvas Pointer Events
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const { x, y } = getCanvasPoint(e);
    ctx.strokeStyle = '#0c2340';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
      setHasSigned(true);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, canvas.height - 32);
    ctx.lineTo(canvas.width - 24, canvas.height - 32);
    ctx.stroke();
    setHasSigned(false);
    setSignatureDataUrl('');
  };

  const applyQuickDigitalSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Baseline
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, canvas.height - 32);
    ctx.lineTo(canvas.width - 24, canvas.height - 32);
    ctx.stroke();

    // Stylized cursive signature stroke + signer name
    ctx.strokeStyle = '#17458f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(75, 110);
    ctx.bezierCurveTo(120, 45, 175, 135, 235, 70);
    ctx.bezierCurveTo(280, 35, 330, 120, 420, 82);
    ctx.stroke();

    ctx.fillStyle = '#0c2340';
    ctx.font = 'italic bold 22px Georgia, serif';
    ctx.fillText(fullName || 'Assinatura Digital Verificada', 85, 102);

    const pngUrl = canvas.toDataURL('image/png');
    setSignatureDataUrl(pngUrl);
    setHasSigned(true);
    toast.success('Assinatura digital aplicada no termo!');
  };

  // Finalize Checkout -> Step 5
  const handleFinalizeCheckout = async () => {
    if (!selectedEquipment) {
      toast.error('Selecione um equipamento antes de concluir.');
      return;
    }
    if (!acceptedClauses) {
      toast.error('Confirme a leitura das cláusulas do Contrato de Comodato.');
      return;
    }
    if (!hasSigned || !signatureDataUrl) {
      toast.error('Por favor, colete a assinatura digital na tela antes de finalizar.');
      return;
    }

    setSubmitting(true);
    try {
      const donationNote =
        spontaneousDonation && Number(spontaneousDonation) > 0
          ? ` | Doação espontânea fundo de manutenção: ${formatCurrency(Number(spontaneousDonation))}`
          : '';

      const loan = await dataRepository.createLoan({
        equipment_id: selectedEquipment.id,
        term_days: termDays,
        signature_data_url: signatureDataUrl,
        document_urls: [docPhotoUrl, resPhotoUrl].filter(Boolean),
        notes: `${medicalReason || 'Empréstimo ortopédico assistencial'}${donationNote}`,
        beneficiary: {
          full_name: fullName.trim(),
          cpf: formatCPF(cpf),
          rg: rg.trim(),
          phone: formatPhone(phone),
          address_street: street.trim(),
          address_number: number.trim(),
          address_complement: complement.trim(),
          address_neighborhood: neighborhood.trim(),
          address_city: city.trim(),
          address_state: stateUf.trim(),
          address_zipcode: formatCEP(cep),
          address_cep: formatCEP(cep),
          is_patient_same_as_responsible: isPatientSame,
          patient_name: isPatientSame ? fullName.trim() : patientName.trim(),
          secondary_name: secondaryName.trim(),
          secondary_relationship: secondaryRelationship,
          secondary_phone: formatPhone(secondaryPhone),
          secondary_contact_name: secondaryName.trim(),
          secondary_contact_relationship: secondaryRelationship,
          secondary_contact_phone: formatPhone(secondaryPhone),
          document_photo_url: docPhotoUrl,
          proof_of_residence_url: resPhotoUrl,
          notes: medicalReason.trim(),
        },
      });

      setCreatedLoan(loan);
      setStep(5);
      toast.success(`Comodato ${loan.loan_code} registrado com sucesso!`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar empréstimo.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered available equipments in Step 1
  const filteredEquipments = availableEquipments.filter((eq) => {
    if (!equipmentSearch.trim()) return true;
    const q = equipmentSearch.toLowerCase().trim();
    return (
      eq.name.toLowerCase().includes(q) ||
      eq.patrimony_code.toLowerCase().includes(q) ||
      (eq.brand_model && eq.brand_model.toLowerCase().includes(q)) ||
      (CATEGORY_LABELS[eq.category] || '').toLowerCase().includes(q)
    );
  });

  // Build WhatsApp Contract & Magic Renewal Link URL for Step 5
  const getWhatsAppShareUrl = (loan: Loan): string => {
    const cleanPhone = onlyDigits(loan.beneficiary?.phone || phone);
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://rotary-banco-ortopedico.vercel.app';
    const magicLink = `${origin}/renovar/${loan.magic_token}`;

    const message = [
      `Olá *${loan.beneficiary?.full_name || fullName}*!`,
      `Segue o comprovante oficial do seu Empréstimo Gratuito (Comodato) junto ao *${DEFAULT_CLUB_INFO.clubName}*:`,
      ``,
      `• *Protocolo:* ${loan.loan_code}`,
      `• *Equipamento:* ${loan.equipment?.name || selectedEquipment?.name} (${loan.equipment?.patrimony_code || selectedEquipment?.patrimony_code})`,
      `• *Devolução Prevista:* ${formatDate(loan.expected_return_date)}`,
      `• *Valor Declarado p/ Conservação:* ${formatCurrency(loan.replacement_value)}`,
      ``,
      `🔗 *Precisa de mais tempo?* Renove seu prazo em 1 clique pelo link oficial (sem precisar de senha):`,
      magicLink,
      ``,
      `_Lembrete: É proibido repassar este equipamento a terceiros. Ao encerrar o uso, devolva-o ao Rotary para higienização._`,
    ].join('\n');

    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Progress Stepper */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-rotary-blue border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-rotary-gold" />
              Checkout Rápido em 90 Segundos • Arts. 579 a 585 CCB
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1.5">
              Novo Empréstimo (Comodato Digital)
            </h1>
          </div>
          <Link
            href="/equipments"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-rotary-blue transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao Acervo
          </Link>
        </div>

        {/* 5-Step Progress Indicator */}
        <div className="grid grid-cols-5 gap-2 pt-4">
          {[
            { num: 1, label: '1. Item' },
            { num: 2, label: '2. Cadastro' },
            { num: 3, label: '3. Fotos' },
            { num: 4, label: '4. Assinatura' },
            { num: 5, label: '5. Recibo' },
          ].map((item) => {
            const isActive = step === item.num;
            const isDone = step > item.num;
            return (
              <div
                key={item.num}
                className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                  isActive
                    ? 'bg-rotary-blue text-white border-rotary-blue shadow-sm'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <span className="text-xs font-bold flex items-center gap-1">
                  {isDone && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          STEP 1: EQUIPMENT SELECTION
         ===================================================================== */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-rotary-blue" />
                Passo 1: Confirme o Equipamento Ortopédico
              </h2>
              <p className="text-sm text-slate-600">
                Selecione um equipamento higienizado e disponível no estoque para iniciar o comodato.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                placeholder="Buscar código ROT ou nome..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>
          </div>

          {loadingEquipments ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-rotary-blue" />
              <span className="text-sm">Carregando equipamentos disponíveis...</span>
            </div>
          ) : filteredEquipments.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-slate-700 font-medium">
                Nenhum equipamento disponível encontrado para este filtro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredEquipments.map((eq) => {
                const isSelected = selectedEquipment?.id === eq.id;
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => setSelectedEquipment(eq)}
                    className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-rotary-blue bg-blue-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1.5 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rotary-navy text-white">
                          {eq.patrimony_code}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {CONDITION_LABELS[eq.condition] || eq.condition}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">{eq.name}</h3>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {eq.brand_model || CATEGORY_LABELS[eq.category]} •{' '}
                        {eq.model_description || 'Pronto para entrega'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 w-full text-xs">
                      <span className="text-slate-600">
                        Valor de Reposição (Art. 582):{' '}
                        <strong className="text-slate-900">
                          {formatCurrency(eq.replacement_value)}
                        </strong>
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 font-bold text-rotary-blue">
                          <CheckCircle2 className="w-4 h-4" /> Selecionado
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={!selectedEquipment}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-rotary-blue hover:bg-blue-800 disabled:opacity-50 transition-all shadow-sm"
            >
              Continuar para Dados do Beneficiário
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: BENEFICIARY & MANDATORY SECONDARY CONTACT
         ===================================================================== */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-rotary-blue" />
                Passo 2: Qualificação do Beneficiário e Contato Solidário
              </h2>
              <p className="text-sm text-slate-600">
                Busque pelo CPF para autopreencher ou cadastre os dados e o contato secundário obrigatório.
              </p>
            </div>
            {/* Quick Demo Fill Pill for instant testing */}
            <button
              type="button"
              onClick={() => handleLookupCpf('123.456.789-00')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-slate-900 hover:bg-amber-200 border border-amber-300 transition-colors self-start"
            >
              <Sparkles className="w-3.5 h-3.5 text-rotary-blue" />
              Autopreencher CPF Demo (Maria das Dores)
            </button>
          </div>

          {step2Error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verifique os campos obrigatórios:</p>
                <p>{step2Error}</p>
              </div>
            </div>
          )}

          {/* CPF Search Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              CPF do Responsável Legal (Comodatário) *
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="flex-1 px-3.5 py-2.5 text-base font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
              <button
                type="button"
                onClick={() => handleLookupCpf()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-rotary-blue hover:bg-blue-800 transition-colors"
              >
                <Search className="w-4 h-4" />
                Buscar por CPF
              </button>
            </div>
          </div>

          {/* Primary Responsible Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Nome Completo do Responsável pela Retirada *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Maria das Dores Silva"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                RG / Documento de Identidade
              </label>
              <input
                type="text"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                placeholder="Ex: 12.345.678-9"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                WhatsApp Principal do Responsável *
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(13) 99999-9999"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>

            <div className="sm:col-span-2 pt-1">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPatientSame}
                  onChange={(e) => setIsPatientSame(e.target.checked)}
                  className="w-4 h-4 rounded text-rotary-blue focus:ring-rotary-blue"
                />
                <span className="text-sm font-medium text-slate-800">
                  O próprio paciente é o responsável pela retirada
                </span>
              </label>
            </div>

            {!isPatientSame && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Nome Completo do Paciente Beneficiado *
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nome do paciente que usará o equipamento"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Motivo Médico / Condição Clínica
              </label>
              <input
                type="text"
                value={medicalReason}
                onChange={(e) => setMedicalReason(e.target.value)}
                placeholder="Ex: Pós-operatório de fêmur, AVC, Fratura tornozelo..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {MEDICAL_REASON_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setMedicalReason(suggestion)}
                    className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-rotary-blue text-slate-700 transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Address Block with ViaCEP */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rotary-blue" />
              Endereço Residencial do Equipamento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CEP (Autopreenchimento)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cep}
                    onChange={(e) => handleCepLookup(e.target.value)}
                    placeholder="00000-000"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                  {loadingCep && (
                    <Loader2 className="w-4 h-4 animate-spin text-rotary-blue absolute right-3 top-2.5" />
                  )}
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logradouro / Rua / Avenida *
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Rua das Flores"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número *
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="120"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Apto, Bloco, Casa..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bairro *
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Gonzaga"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cidade / UF *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Farroupilha"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                  <input
                    type="text"
                    maxLength={2}
                    value={stateUf}
                    onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                    placeholder="RS"
                    className="w-16 px-2.5 py-2 text-sm text-center border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MANDATORY SECONDARY CONTACT BLOCK (Art. 585 CCB) */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border-2 border-rotary-gold space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rotary-gold text-rotary-navy shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Contato Secundário Obrigatório / Co-responsável Solidário (Art. 585 CCB)
                </h3>
                <p className="text-xs text-slate-700 mt-0.5">
                  Fundamental para recuperação do equipamento em caso de troca de telefone,
                  internação ou falecimento do paciente. O telefone deve ser diferente do principal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nome e Sobrenome do Contato *
                </label>
                <input
                  type="text"
                  value={secondaryName}
                  onChange={(e) => setSecondaryName(e.target.value)}
                  placeholder="Ex: Carlos Alberto Silva"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Grau de Parentesco / Vínculo *
                </label>
                <select
                  value={secondaryRelationship}
                  onChange={(e) => setSecondaryRelationship(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                >
                  {RELATIONSHIP_OPTIONS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  WhatsApp do Contato Secundário *
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(formatPhone(e.target.value))}
                  placeholder="(13) 98888-7777"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              type="button"
              onClick={handleValidateStep2}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-rotary-blue hover:bg-blue-800 transition-all shadow-sm"
            >
              Avançar para Fotos de Segurança
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: SECURITY PHOTOS (CLIENT-SIDE IMAGE COMPRESSION)
         ===================================================================== */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-rotary-blue" />
                Passo 3: Fotos de Segurança (Compressão Automática &lt; 800KB)
              </h2>
              <p className="text-sm text-slate-600">
                Capture uma foto do documento oficial (RG/CNH) e do comprovante de residência.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillDemoPhotos}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-100 text-slate-900 hover:bg-amber-200 border border-amber-300 transition-colors self-start"
            >
              <Sparkles className="w-4 h-4 text-rotary-blue" />
              Preencher Fotos de Exemplo (Modo Teste)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Official ID Photo */}
            <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    1. Documento Oficial (RG ou CNH)
                  </span>
                  {docPhotoStats && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      Comprimido: {docPhotoStats.compressedKB} KB
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  Foto legível da frente do RG ou CNH do responsável pela retirada.
                </p>
              </div>

              {docPhotoUrl ? (
                <div className="space-y-2">
                  <img
                    src={docPhotoUrl}
                    alt="Preview Documento Oficial"
                    className="w-full h-44 object-cover rounded-xl border border-slate-300 bg-white"
                  />
                  {docPhotoStats && (
                    <p className="text-xs text-emerald-700 font-medium">
                      Reduzido de {docPhotoStats.originalKB} KB para {docPhotoStats.compressedKB} KB (Max 1280px)
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-44 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Camera className="w-9 h-9 text-slate-300" />
                  <span className="text-xs">Nenhuma foto capturada ainda</span>
                </div>
              )}

              <label className="cursor-pointer inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition-colors">
                {compressingDoc ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-rotary-blue" />
                    Comprimindo imagem...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-rotary-blue" />
                    {docPhotoUrl ? 'Trocar Foto do Documento' : 'Tirar Foto / Enviar Documento'}
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleDocumentPhotoChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Card 2: Proof of Residence Photo */}
            <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    2. Comprovante de Residência
                  </span>
                  {resPhotoStats && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      Comprimido: {resPhotoStats.compressedKB} KB
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  Conta de luz, água, telefone ou envelope com endereço atualizado.
                </p>
              </div>

              {resPhotoUrl ? (
                <div className="space-y-2">
                  <img
                    src={resPhotoUrl}
                    alt="Preview Comprovante de Residência"
                    className="w-full h-44 object-cover rounded-xl border border-slate-300 bg-white"
                  />
                  {resPhotoStats && (
                    <p className="text-xs text-emerald-700 font-medium">
                      Reduzido de {resPhotoStats.originalKB} KB para {resPhotoStats.compressedKB} KB (Max 1280px)
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-44 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <FileText className="w-9 h-9 text-slate-300" />
                  <span className="text-xs">Nenhuma foto capturada ainda</span>
                </div>
              )}

              <label className="cursor-pointer inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition-colors">
                {compressingRes ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-rotary-blue" />
                    Comprimindo imagem...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-rotary-blue" />
                    {resPhotoUrl ? 'Trocar Comprovante' : 'Tirar Foto / Enviar Comprovante'}
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleResidencePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!docPhotoUrl || !resPhotoUrl) {
                  handleFillDemoPhotos();
                }
                setStep(4);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-rotary-blue hover:bg-blue-800 transition-all shadow-sm"
            >
              Ir para Termo e Assinatura Digital
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 4: TERM SELECTION, LEGAL CONTRACT SUMMARY & SIGNATURE CANVAS
         ===================================================================== */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PenTool className="w-5 h-5 text-rotary-blue" />
              Passo 4: Prazo de Empréstimo, Cláusulas Jurídicas e Assinatura em Tela
            </h2>
            <p className="text-sm text-slate-600">
              Escolha o prazo inicial e colha a assinatura do responsável na tela sensível ao toque.
            </p>
          </div>

          {/* Term Selector Pills & Optional Donation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Prazo Inicial do Empréstimo (Renovável pelo WhatsApp)
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[30, 60, 90].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setTermDays(days)}
                    className={`py-2.5 px-3 rounded-xl font-bold text-sm border transition-all ${
                      termDays === days
                        ? 'bg-rotary-blue text-white border-rotary-blue shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-rotary-blue'
                    }`}
                  >
                    {days} dias {days === 60 && '(Padrão)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Doação Espontânea / Fundo de Manutenção (Opcional - R$)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={spontaneousDonation}
                onChange={(e) => setSpontaneousDonation(e.target.value)}
                placeholder="Ex: 30,00 (Opcional - Comodato é 100% gratuito)"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rotary-blue"
              />
            </div>
          </div>

          {/* Legal Summary Box (Arts. 579-585 CCB) */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rotary-blue text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Resumo do Contrato de Comodato (Artigos 579 a 585 do Código Civil)
              </span>
              <span className="font-bold text-slate-900">
                Valor Declarado (Art. 582):{' '}
                {formatCurrency(selectedEquipment?.replacement_value || 0)}
              </span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>
                <strong>Gratuidade e Finalidade (Art. 579):</strong> Empréstimo 100% gratuito para uso
                exclusivo do paciente qualificado.
              </li>
              <li>
                <strong>Dever de Guarda e Reposição (Art. 582):</strong> O comodatário compromete-se a
                zelar pelo item ({selectedEquipment?.name} - {selectedEquipment?.patrimony_code}),
                respondendo pelo valor declarado de{' '}
                <strong>{formatCurrency(selectedEquipment?.replacement_value || 0)}</strong> em caso
                de perda ou dano.
              </li>
              <li>
                <strong>Proibição Estrita de Repasse a Terceiros:</strong> É terminantemente proibido
                emprestar ou doar este aparelho a vizinhos ou terceiros. Ao término do uso, deve ser
                restituído ao Rotary para higienização segundo normas da ANVISA.
              </li>
              <li>
                <strong>Solidariedade (Art. 585):</strong> O contato secundário ({secondaryName || 'Familiar'})
                atua como corresponsável pela devolução em caso de alta médica ou óbito.
              </li>
            </ul>
            <label className="inline-flex items-center gap-2 pt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedClauses}
                onChange={(e) => setAcceptedClauses(e.target.checked)}
                className="w-4 h-4 rounded text-rotary-blue focus:ring-rotary-blue"
              />
              <span className="font-bold text-slate-900 text-xs">
                O responsável leu e concorda integralmente com os termos acima.
              </span>
            </label>
          </div>

          {/* Interactive HTML5 Signature Canvas */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-900">
                Assinatura Digital do Responsável ({fullName || 'Comodatário'}) *
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyQuickDigitalSignature}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-slate-900 hover:bg-amber-200 border border-amber-300 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-rotary-blue" />
                  Assinar Digitalmente (Teste Rápido)
                </button>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar Assinatura
                </button>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-slate-300 overflow-hidden bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                width={640}
                height={180}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={endDrawing}
                onPointerCancel={endDrawing}
                className="w-full h-44 touch-none cursor-crosshair block"
              />
            </div>
            <p className="text-xs text-slate-500 text-center">
              Assine com o dedo (celular/tablet) ou mouse acima da linha guia.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalizeCheckout}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-slate-950 bg-rotary-gold hover:bg-amber-400 disabled:opacity-50 transition-all shadow-md"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registrando Comodato...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Finalizar Empréstimo e Gerar Contrato
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 5: CELEBRATORY CONFIRMATION, PDF DOWNLOAD & WHATSAPP DISPATCH
         ===================================================================== */}
      {step === 5 && createdLoan && (
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              COMODATO REGISTRADO E EQUIPAMENTO VINCULADO
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Protocolo {createdLoan.loan_code}
            </h2>
            <p className="text-sm text-slate-600 max-w-xl">
              O equipamento{' '}
              <strong>
                {createdLoan.equipment?.name} ({createdLoan.equipment?.patrimony_code})
              </strong>{' '}
              foi marcado como <strong>EMPRESTADO</strong> para{' '}
              <strong>{createdLoan.beneficiary?.full_name}</strong> até{' '}
              <strong>{formatDate(createdLoan.expected_return_date)}</strong>.
            </p>
          </div>

          {/* Summary & Magic Renewal Link Box */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-xs text-slate-500 block">Beneficiário Responsável</span>
                <strong className="text-slate-900">{createdLoan.beneficiary?.full_name}</strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Contato Solidário (Art. 585)</span>
                <strong className="text-slate-900">
                  {createdLoan.beneficiary?.secondary_name} (
                  {createdLoan.beneficiary?.secondary_relationship})
                </strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Devolução Prevista</span>
                <strong className="text-rotary-blue">
                  {formatDate(createdLoan.expected_return_date)} ({termDays} dias)
                </strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">Link Mágico de Renovação Self-Service: </span>
                <code className="px-2 py-0.5 rounded bg-white border border-slate-200 text-rotary-blue">
                  /renovar/{createdLoan.magic_token}
                </code>
              </div>
              <Link
                href={`/renovar/${createdLoan.magic_token}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-rotary-blue hover:underline"
              >
                Testar Portal de Renovação
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Primary Action Buttons: PDF Download & WhatsApp Share */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => generateComodatoContractPDF(createdLoan)}
              className="flex items-center justify-center gap-2.5 py-4 px-5 rounded-xl font-bold text-white bg-rotary-blue hover:bg-blue-800 transition-all shadow-sm"
            >
              <Download className="w-5 h-5" />
              Baixar Termo de Comodato (PDF)
            </button>

            <a
              href={getWhatsAppShareUrl(createdLoan)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 py-4 px-5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm"
            >
              <MessageCircle className="w-5 h-5" />
              Enviar Termo e Recibo no WhatsApp do Beneficiário
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <Link
              href={`/loans/${createdLoan.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-rotary-blue hover:underline"
            >
              Ver Detalhes do Empréstimo ({createdLoan.loan_code})
              <ChevronRight className="w-4 h-4" />
            </Link>

            <Link
              href="/loans"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
            >
              Ir para Lista de Empréstimos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewLoanWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-600">
          <Loader2 className="w-8 h-8 animate-spin text-rotary-blue" />
          <p className="text-sm font-medium">Carregando assistente de empréstimo rápido...</p>
        </div>
      }
    >
      <FastCheckoutWizardInner />
    </Suspense>
  );
}
