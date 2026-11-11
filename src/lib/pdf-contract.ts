// ==============================================================================
// ROTARY BANCO ORTOPÉDICO - LEGAL PDF GENERATOR (COMODATO & QUITAÇÃO)
// Generates legally sound Brazilian Civil Code (Arts. 579-585 & Art. 320 CCB)
// contracts and discharge receipts with embedded digital signatures & QR Codes.
// ==============================================================================

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Loan } from './data-layer/types';
import {
  DEFAULT_CLUB_INFO,
  CATEGORY_LABELS,
  CONDITION_LABELS,
  CLOSE_REASON_LABELS,
} from './constants';
import { formatCurrency, formatDate, formatDateTime } from './utils';

/**
 * Helper to resolve full origin URL for QR Codes embedded in PDF documents.
 */
function getBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://rotary-banco-ortopedico.vercel.app';
}

/**
 * Builds the jsPDF document instance for the Comodato Contract (Arts. 579–585 CCB).
 */
async function buildComodatoDoc(loan: Loan): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // --------------------------------------------------------------------------
  // HEADER BANNER - ROTARY ROYAL BLUE & GOLD
  // --------------------------------------------------------------------------
  doc.setFillColor(23, 69, 143); // #17458f Rotary Royal Blue
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setFillColor(247, 168, 27); // #f7a81b Rotary Gold Accent Strip
  doc.rect(0, 26, pageWidth, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(DEFAULT_CLUB_INFO.clubName.toUpperCase(), margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${DEFAULT_CLUB_INFO.district} • Banco de Aparelhos Ortopédicos • WhatsApp: ${DEFAULT_CLUB_INFO.contactPhone}`,
    margin,
    17
  );
  doc.text(`Protocolo Oficial: ${loan.loan_code}`, pageWidth - margin, 11, {
    align: 'right',
  });
  doc.text(`Emissão: ${formatDate(loan.loan_date)}`, pageWidth - margin, 17, {
    align: 'right',
  });

  y = 35;

  // --------------------------------------------------------------------------
  // CONTRACT TITLE & LEGAL BASIS
  // --------------------------------------------------------------------------
  doc.setTextColor(12, 35, 64); // #0c2340 Deep Navy
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    'CONTRATO DE EMPRÉSTIMO GRATUITO (COMODATO) DE EQUIPAMENTO ORTOPÉDICO',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Regido pelos Artigos 579 a 585 do Código Civil Brasileiro (Lei Federal nº 10.406/2002) e LGPD (Lei nº 13.709/2018)',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 6;

  // Helper for section headers
  const drawSectionHeader = (title: string) => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(23, 69, 143);
    doc.text(title, margin + 2.5, y + 4.5);
    y += 10;
  };

  // --------------------------------------------------------------------------
  // 1. IDENTIFICAÇÃO DO COMODANTE
  // --------------------------------------------------------------------------
  drawSectionHeader('1. IDENTIFICAÇÃO DO COMODANTE (PROPRIETÁRIO / ENTIDADE BENEFICENTE)');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const comodanteText = `${DEFAULT_CLUB_INFO.clubName} (${DEFAULT_CLUB_INFO.district}), representado por sua ${DEFAULT_CLUB_INFO.president}, com sede na ${DEFAULT_CLUB_INFO.address}, CEP ${DEFAULT_CLUB_INFO.cep}, ${DEFAULT_CLUB_INFO.city}, telefone de contato ${DEFAULT_CLUB_INFO.contactPhone}.`;
  const comodanteLines = doc.splitTextToSize(comodanteText, contentWidth);
  doc.text(comodanteLines, margin, y);
  y += comodanteLines.length * 4.2 + 2.5;

  // --------------------------------------------------------------------------
  // 2. IDENTIFICAÇÃO DO COMODATÁRIO E PACIENTE
  // --------------------------------------------------------------------------
  const ben = loan.beneficiary;
  const fullAddress = ben
    ? `${ben.address_street}, nº ${ben.address_number}${ben.address_complement ? ' (' + ben.address_complement + ')' : ''} - ${ben.address_neighborhood}, ${ben.address_city}/${ben.address_state} - CEP: ${ben.address_zipcode || ben.address_cep || ''}`
    : 'Endereço registrado no cadastro digital';

  drawSectionHeader('2. IDENTIFICAÇÃO DO COMODATÁRIO (RESPONSÁVEL LEGAL) E PACIENTE BENEFICIADO');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Responsável Legal (Comodatário): ${ben?.full_name || 'N/A'}`, margin, y);
  doc.text(`CPF: ${ben?.cpf || 'N/A'}   |   RG: ${ben?.rg || 'N/A'}`, margin + 108, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.text(`Telefone / WhatsApp Principal: ${ben?.phone || 'N/A'}`, margin, y);
  const patientLabel =
    ben?.is_patient_same_as_responsible === false && ben?.patient_name
      ? `${ben.patient_name} (${ben.patient_relationship || 'Familiar'})`
      : `${ben?.full_name || 'O próprio responsável'}`;
  doc.text(`Paciente Usuário: ${patientLabel}`, margin + 85, y);
  y += 4.5;

  const addrLines = doc.splitTextToSize(`Endereço Residencial: ${fullAddress}`, contentWidth);
  doc.text(addrLines, margin, y);
  y += addrLines.length * 4.2 + 2.5;

  // --------------------------------------------------------------------------
  // 3. CONTATO SECUNDÁRIO E CORRESPONSÁVEL SOLIDÁRIO (Art. 585 CCB)
  // --------------------------------------------------------------------------
  drawSectionHeader('3. CONTATO SECUNDÁRIO OBRIGATÓRIO E CORRESPONSÁVEL SOLIDÁRIO (ART. 585 DO CÓDIGO CIVIL)');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const secName = ben?.secondary_name || ben?.secondary_contact_name || 'Não informado';
  const secRel = ben?.secondary_relationship || ben?.secondary_contact_relationship || 'Familiar';
  const secPhone = ben?.secondary_phone || ben?.secondary_contact_phone || 'Não informado';

  doc.text(`Nome Completo: ${secName}`, margin, y);
  doc.text(`Vínculo / Parentesco: ${secRel}`, margin + 95, y);
  doc.text(`WhatsApp: ${secPhone}`, margin + 145, y);
  y += 6.5;

  // --------------------------------------------------------------------------
  // 4. OBJETO DO COMODATO E VALOR DE REPOSIÇÃO (Art. 582 CCB)
  // --------------------------------------------------------------------------
  drawSectionHeader('4. OBJETO DO COMODATO, ESTADO DE CONSERVAÇÃO E VALOR DECLARADO (ART. 582 CCB)');
  const eq = loan.equipment;
  const categoryName = eq ? CATEGORY_LABELS[eq.category] || eq.category : 'Equipamento Ortopédico';
  const conditionName = eq ? CONDITION_LABELS[eq.condition] || eq.condition : 'Bom';
  const replacementVal = formatCurrency(loan.replacement_value || eq?.replacement_value || 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(23, 69, 143);
  doc.text(
    `Patrimônio: ${eq?.patrimony_code || 'N/A'}  —  ${eq?.name || categoryName}`,
    margin,
    y
  );
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Categoria: ${categoryName}   |   Estado na Retirada: ${conditionName}   |   Valor Declarado para Reposição: ${replacementVal}`,
    margin,
    y
  );
  y += 4.5;
  doc.text(
    `Data da Retirada: ${formatDate(loan.loan_date)}   |   Prazo Inicial Previsto de Devolução: ${formatDate(loan.expected_return_date)}`,
    margin,
    y
  );
  y += 6.5;

  // --------------------------------------------------------------------------
  // 5. CLÁUSULAS JURÍDICAS OBRIGATÓRIAS
  // --------------------------------------------------------------------------
  drawSectionHeader('5. CLÁUSULAS E CONDIÇÕES JURÍDICAS DO EMPRÉSTIMO GRATUITO (ARTS. 579 A 585 DO CCB)');

  const clauses = [
    `CLÁUSULA 1ª (Natureza Gratuita - Art. 579 CCB): O presente contrato refere-se ao empréstimo inteiramente gratuito (Comodato) do equipamento ortopédico acima descrito, destinado exclusivamente à recuperação de saúde e mobilidade do paciente qualificado.`,
    `CLÁUSULA 2ª (Guarda, Conservação e Mora - Art. 582 CCB): O COMODATÁRIO obriga-se a conservar o equipamento como se seu próprio fosse, não podendo usá-lo senão de acordo com sua natureza. Em caso de dano, mau uso, extravio ou recusa de devolução, responderá pelo Valor Declarado de Reposição (${replacementVal}), além dos encargos de mora.`,
    `CLÁUSULA 3ª (Prazo Determinado e Renovação): O empréstimo vigorará até ${formatDate(loan.expected_return_date)}. Caso o paciente ainda necessite do equipamento após esta data, o COMODATÁRIO compromete-se a solicitar a prorrogação pelo link oficial de renovação via WhatsApp ou presencialmente antes do vencimento.`,
    `CLÁUSULA 4ª (Proibição Estrita de Repasse a Terceiros): É TERMINANTEMENTE PROIBIDO doar, emprestar, ceder ou repassar diretamente este equipamento a vizinhos, parentes ou terceiros. Cessada a necessidade de uso, o item deve retornar obrigatoriamente ao Banco Ortopédico do Rotary para desinfecção hospitalar (normas ANVISA) e destinação ao próximo paciente da fila.`,
    `CLÁUSULA 5ª (Comunicação de Alta Médica ou Óbito e Solidariedade Passiva - Art. 585 CCB): Em caso de alta médica, recuperação, internação definitiva ou falecimento do paciente, o COMODATÁRIO e o CONTATO SECUNDÁRIO solidarizam-se na obrigação de comunicar o Rotary e restituir o equipamento em até 5 (cinco) dias úteis.`,
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  for (const clause of clauses) {
    const lines = doc.splitTextToSize(clause, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 3.8 + 2.2;
  }

  y += 2;

  // --------------------------------------------------------------------------
  // 6. ASSINATURA DIGITAL E AUTENTICAÇÃO COM QR CODE
  // --------------------------------------------------------------------------
  drawSectionHeader('6. ASSINATURA DIGITAL DO COMODATÁRIO E AUTENTICAÇÃO ELETRÔNICA');

  const sigBoxWidth = 115;
  const sigBoxHeight = 32;
  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');

  const sigUrl = loan.signature_url || loan.signature_image_url;
  if (sigUrl && (sigUrl.startsWith('data:image/png') || sigUrl.startsWith('data:image/jpeg'))) {
    try {
      const format = sigUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(sigUrl, format, margin + 8, y + 2, sigBoxWidth - 16, sigBoxHeight - 10);
    } catch {
      // Fallback text if image decoding fails
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text('[Assinatura Eletrônica Registrada Digitalmente]', margin + 15, y + 15);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(23, 69, 143);
    doc.text('Assinado Digitalmente em Tela pelo Responsável', margin + 18, y + 14);
  }

  doc.setDrawColor(100, 116, 139);
  doc.line(margin + 6, y + sigBoxHeight - 7, margin + sigBoxWidth - 6, y + sigBoxHeight - 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${ben?.full_name || 'Comodatário'} — CPF: ${ben?.cpf || ''}`,
    margin + sigBoxWidth / 2,
    y + sigBoxHeight - 2.5,
    { align: 'center' }
  );

  // Generate QR Code for equipment tracking / instant lookup
  try {
    const qrTargetUrl = `${getBaseUrl()}/item/${eq?.qr_token || eq?.patrimony_code || loan.loan_code}`;
    const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#0c2340', light: '#ffffff' },
    });

    const qrX = pageWidth - margin - 32;
    doc.addImage(qrDataUrl, 'PNG', qrX, y, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Escaneie p/ Histórico', qrX + 15, y + 32, { align: 'center' });
  } catch {
    // Ignore QR generation error in restricted environments
  }

  // Verification metadata between signature and QR code
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Protocolo: ${loan.loan_code}`, margin + sigBoxWidth + 4, y + 8);
  doc.text(`Data/Hora: ${formatDateTime(loan.loan_date)}`, margin + sigBoxWidth + 4, y + 13);
  doc.text(`Token: ${loan.magic_token.slice(0, 18)}...`, margin + sigBoxWidth + 4, y + 18);
  doc.text('Validade Jurídica: MP 2.200-2/2001', margin + sigBoxWidth + 4, y + 23);

  return doc;
}

/**
 * Generates and triggers download of the Comodato Contract PDF (`Termo-Comodato-{loan_code}.pdf`).
 */
export async function generateComodatoContractPDF(loan: Loan): Promise<void> {
  const doc = await buildComodatoDoc(loan);
  doc.save(`Termo-Comodato-${loan.loan_code}.pdf`);
}

/**
 * Generates and returns the Comodato Contract PDF as a base64 Data URL string.
 */
export async function getComodatoContractDataUrl(loan: Loan): Promise<string> {
  const doc = await buildComodatoDoc(loan);
  return doc.output('datauristring');
}

/**
 * Generates and triggers download of the Official Return & Discharge Receipt PDF
 * ("TERMO DE QUITAÇÃO E DEVOLUÇÃO DE EQUIPAMENTO ORTOPÉDICO" - Art. 320 do Código Civil).
 */
export async function generateDischargeReceiptPDF(loan: Loan): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // Header Banner
  doc.setFillColor(23, 69, 143);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(16, 185, 129); // Emerald Green Quittance Accent
  doc.rect(0, 28, pageWidth, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(DEFAULT_CLUB_INFO.clubName.toUpperCase(), margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${DEFAULT_CLUB_INFO.district} • Certificado Oficial de Devolução e Quitação de Comodato`,
    margin,
    19
  );
  doc.text(`Protocolo: ${loan.loan_code}`, pageWidth - margin, 12, { align: 'right' });

  y = 42;

  // Title
  doc.setTextColor(12, 35, 64);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(
    'TERMO DE QUITAÇÃO E DEVOLUÇÃO DE EQUIPAMENTO ORTOPÉDICO',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 6;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Emitido nos termos do Artigo 320 do Código Civil Brasileiro (Lei nº 10.406/2002)',
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 12;

  const ben = loan.beneficiary;
  const eq = loan.equipment;
  const returnDateFormatted = loan.actual_return_date
    ? formatDateTime(loan.actual_return_date)
    : formatDateTime(new Date().toISOString());
  const returnCondFormatted = loan.return_condition
    ? CONDITION_LABELS[loan.return_condition] || loan.return_condition
    : 'Bom estado';
  const closeReasonFormatted = loan.close_reason
    ? CLOSE_REASON_LABELS[loan.close_reason] || loan.close_reason
    : 'Devolução regular';

  // Declaration Body Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 65, 3, 3, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);

  const declaration = `Declaramos para os devidos fins de direito e efeitos do Art. 320 do Código Civil Brasileiro que o(a) Sr.(a) ${ben?.full_name || 'Beneficiário'}, inscrito(a) no CPF sob o nº ${ben?.cpf || 'N/A'}, bem como seu contato corresponsável solidário (${ben?.secondary_name || 'N/A'}), realizaram a restituição integral do equipamento ortopédico abaixo discriminado ao Banco Ortopédico do ${DEFAULT_CLUB_INFO.clubName}, extinguindo-se plenamente a responsabilidade civil e patrimonial referente ao Contrato de Comodato nº ${loan.loan_code}.`;

  const declLines = doc.splitTextToSize(declaration, contentWidth - 12);
  doc.text(declLines, margin + 6, y + 10);

  y += 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(23, 69, 143);
  doc.text(`• Equipamento Restituído: ${eq?.name || 'Aparelho Ortopédico'} (Patrimônio: ${eq?.patrimony_code || 'N/A'})`, margin + 6, y);
  y += 6;
  doc.text(`• Data e Hora Efetiva da Devolução: ${returnDateFormatted}`, margin + 6, y);
  y += 6;
  doc.text(`• Estado Físico na Vistoria de Retorno: ${returnCondFormatted}   |   Motivo: ${closeReasonFormatted}`, margin + 6, y);
  y += 22;

  if (loan.return_notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Observações da Triagem: ${loan.return_notes}`, margin, y);
    y += 12;
  }

  // Official Stamp / Signature Area
  doc.setDrawColor(16, 185, 129);
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70);
  doc.text('QUITAÇÃO PLENA CONCEDIDA — OBRIGAÇÃO EXTINTA', pageWidth / 2, y + 11, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(4, 120, 87);
  doc.text(
    `${DEFAULT_CLUB_INFO.clubName} • ${DEFAULT_CLUB_INFO.president}`,
    pageWidth / 2,
    y + 19,
    { align: 'center' }
  );
  doc.text(
    `Documento autenticado eletronicamente em ${returnDateFormatted}`,
    pageWidth / 2,
    y + 26,
    { align: 'center' }
  );

  doc.save(`Recibo-Quitacao-${loan.loan_code}.pdf`);
}
