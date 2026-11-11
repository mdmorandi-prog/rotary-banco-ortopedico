// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - CONSTANTS & METADATA
// ==============================================================================

export const ROTARY_BRAND = {
  name: "Rotary Club - Banco Ortopédico",
  blue: "#17458f",
  gold: "#f7a81b",
  navy: "#0c2340",
  sky: "#00a2e8",
  charcoal: "#1e293b",
  light: "#f8f9fa",
  contrastNotice: "Texto sobre fundo ouro deve ser azul royal ou grafite escuro (WCAG AA)",
};

export const DEFAULT_CLUB_INFO = {
  clubName: process.env.NEXT_PUBLIC_ROTARY_CLUB_NAME || "Rotary Club de Farroupilha",
  district: process.env.NEXT_PUBLIC_ROTARY_DISTRICT || "Distrito 4700",
  address: process.env.NEXT_PUBLIC_ROTARY_ADDRESS || "Rua Nataly Valentini, 75",
  cep: process.env.NEXT_PUBLIC_ROTARY_CEP || "95180-000",
  city: process.env.NEXT_PUBLIC_ROTARY_CITY || "Farroupilha - RS",
  contactPhone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "(54) 99932-6259",
  president: process.env.NEXT_PUBLIC_ROTARY_PRESIDENT || "Comissão do Banco de Aparelhos Ortopédicos",
  headquartersCoordinates: {
    lat: -29.2241,
    lng: -51.3435,
  },
};

export const CATEGORY_LABELS: Record<string, string> = {
  CADEIRA_RODAS: "Cadeira de Rodas",
  CADEIRA_BANHO: "Cadeira de Banho",
  MULETA: "Muleta",
  MULETA_AXILAR: "Muleta Axilar",
  MULETA_CANADENSE: "Muleta Canadense",
  ANDADOR: "Andador",
  CAMA_HOSPITALAR: "Cama Hospitalar",
  COLCHAO_PNEUMATICO: "Colchão Pneumático",
  SUPORTE_SORO: "Suporte de Soro",
  OUTROS: "Outros",
};

export const STATUS_LABELS: Record<string, string> = {
  DISPONIVEL: "Disponível",
  EMPRESTADO: "Emprestado",
  ATRASADO: "Atrasado",
  HIGIENIZACAO: "Higienização",
  MANUTENCAO: "Manutenção",
  BAIXADO: "Baixado",
};

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DISPONIVEL: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  EMPRESTADO: { bg: "bg-blue-50", text: "text-rotary-blue", border: "border-blue-200" },
  ATRASADO: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  HIGIENIZACAO: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  MANUTENCAO: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  BAIXADO: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" },
};

export const CONDITION_LABELS: Record<string, string> = {
  NOVO: "Novo",
  BOM: "Bom",
  REGULAR: "Regular",
  PRECISA_REPARO: "Precisa de Reparo",
  SUCATA: "Sucata",
  SUCATEADO: "Sucateado",
};

export const LOAN_STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  RENOVADO: "Renovado",
  ATRASADO: "Atrasado",
  DEVOLVIDO: "Devolvido",
  CANCELADO: "Cancelado",
  PERDIDO_EXTRAVIADO: "Extraviado",
};

export const CLOSE_REASON_LABELS: Record<string, string> = {
  RECUPERACAO_ALTA: "Recuperação / Alta Médica",
  OBITO_PACIENTE: "Óbito do Paciente",
  COMPRA_PROPRIA: "Compra de Equipamento Próprio",
  TROCA_EQUIPAMENTO: "Troca por Outro Equipamento",
  DESISTENCIA: "Desistência de Uso",
  OUTROS: "Outros Motivos",
};
