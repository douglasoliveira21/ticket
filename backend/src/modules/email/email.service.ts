import nodemailer from 'nodemailer';
import prisma from '../../common/utils/prisma';
import { decrypt } from '../../common/utils/encryption';

export async function sendInvoiceEmail(companyId: string, order: any, invoice: any, customMessage?: string) {
  const emailSettings = await prisma.emailSettings.findUnique({
    where: { companyId },
  });

  // Use company email settings or fallback to env
  const smtpHost = emailSettings?.smtpHost ? decrypt(emailSettings.smtpHost) : process.env.SMTP_HOST;
  const smtpPort = emailSettings?.smtpPort || parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = emailSettings?.smtpUser ? decrypt(emailSettings.smtpUser) : process.env.SMTP_USER;
  const smtpPass = emailSettings?.smtpPass ? decrypt(emailSettings.smtpPass) : process.env.SMTP_PASS;
  const smtpFrom = emailSettings?.smtpFrom || process.env.SMTP_FROM;
  const smtpFromName = emailSettings?.smtpFromName || process.env.SMTP_FROM_NAME || 'Gestão Fiscal';

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('Configurações de e-mail não definidas');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const eventName = order.event?.name || 'Evento';
  const subject = emailSettings?.templateAssunto
    ? emailSettings.templateAssunto.replace('{evento}', eventName)
    : `Nota Fiscal - ${eventName}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #8B1A1A;">Nota Fiscal de Serviço Eletrônica</h2>
      <p>Olá, <strong>${order.buyerName}</strong>!</p>
      ${customMessage ? `<p style="white-space: pre-wrap;">${customMessage}</p><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">` : ''}
      <p>Segue sua Nota Fiscal referente à compra do evento:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Evento</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${eventName}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Valor</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">R$ ${order.amount.toFixed(2)}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Número da Nota</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${invoice.numeroNota || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Data de Emissão</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleDateString('pt-BR')}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Código de Verificação</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${invoice.codigoVerificacao || '-'}</td>
        </tr>
      </table>
      ${invoice.pdfUrl ? `<p><a href="${invoice.pdfUrl}" style="background: #8B1A1A; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Baixar Nota Fiscal (PDF)</a></p>` : ''}
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Este e-mail foi gerado automaticamente. Em caso de dúvidas, entre em contato com o organizador do evento.
      </p>
    </div>
  `;

  // Preparar anexos
  const attachments: any[] = [];
  const xmlContent = invoice.xmlRetorno || invoice.xmlEnvio;
  if (xmlContent) {
    attachments.push({
      filename: `nfse-${invoice.numeroNota || 'nota'}.xml`,
      content: xmlContent,
      contentType: 'application/xml',
    });
  }

  // Gerar PDF da DANFSe e anexar
  try {
    const { generateDanfseHtml } = await import('../invoices/danfse-template');
    const { htmlToPdf } = await import('../../common/utils/pdf-generator');

    const dataEmissao = invoice.dataEmissao ? new Date(invoice.dataEmissao) : new Date();
    const dataFormatada = dataEmissao.toLocaleDateString('pt-BR');
    const dataHoraFormatada = `${dataFormatada} ${dataEmissao.toLocaleTimeString('pt-BR')}`;
    const chaveAcesso = invoice.codigoVerificacao || invoice.numeroNota || '';

    const danfseData = {
      chaveAcesso,
      numeroNfse: invoice.numeroNota || '-',
      competencia: dataFormatada,
      dataHoraEmissao: dataHoraFormatada,
      numeroDps: invoice.numeroRps || '-',
      serieDps: invoice.serieRps || '1',
      dataHoraEmissaoDps: dataHoraFormatada,
      prestadorCnpj: '-', prestadorInscricaoMunicipal: '-', prestadorTelefone: '-',
      prestadorNome: '-', prestadorEmail: '-', prestadorEndereco: '-',
      prestadorMunicipio: 'BELO HORIZONTE - MG', prestadorCep: '-',
      simplesNacional: 'Não optante', regimeApuracao: '-',
      tomadorCpfCnpj: order.buyerDocument || '-', tomadorInscricaoMunicipal: '-',
      tomadorTelefone: '-', tomadorNome: order.buyerName || '-',
      tomadorEmail: order.buyerEmail || '-', tomadorEndereco: '-',
      tomadorMunicipio: 'Belo Horizonte - MG', tomadorCep: '-',
      codigoTribNacional: invoice.codigoServico || '-', codigoTribMunicipal: invoice.codigoServico || '-',
      localPrestacao: 'BELO HORIZONTE - MG', paisPrestacao: '-',
      descricaoServico: invoice.descricaoServico || eventName,
      tributacaoIssqn: 'Operação Tributável', paisResultado: '-',
      municipioIncidencia: 'BELO HORIZONTE - MG', regimeEspecial: 'Nenhum',
      tipoImunidade: '-', suspensaoExigibilidade: 'Não',
      numeroProcessoSuspensao: '-', beneficioMunicipal: '-',
      valorServico: `R$ ${order.amount.toFixed(2)}`, descontoIncondicionado: '-',
      totalDeducoes: '-', calculoBm: '-',
      bcIssqn: `R$ ${order.amount.toFixed(2)}`,
      aliquotaAplicada: `${(invoice.aliquotaIss || 0).toFixed(2)}%`,
      retencaoIssqn: 'Não Retido',
      issqnApurado: `R$ ${(invoice.valorIss || 0).toFixed(2)}`,
      irrf: '-', contribuicaoPrevidenciaria: '-', contribuicoesSociais: '-',
      descricaoContribSociais: '-', pisDebito: '-', cofinsDebito: '-',
      valorServicoTotal: `R$ ${order.amount.toFixed(2)}`,
      descontoCondicionado: '-', descontoIncondicionadoTotal: '-',
      issqnRetido: '-', totalRetencoesFederais: '-', pisCofinsDebito: '-',
      valorLiquido: `R$ ${(order.amount - (invoice.valorIss || 0)).toFixed(2)}`,
      tributosFederais: '-', tributosEstaduais: '-', tributosMunicipais: '-',
      informacoesComplementares: `Chave de acesso: ${chaveAcesso}`,
    };

    const html = await generateDanfseHtml(danfseData);
    const pdfBuffer = await htmlToPdf(html);
    attachments.push({
      filename: `danfse-${invoice.numeroNota || 'nota'}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  } catch (pdfErr: any) {
    console.warn('Could not generate PDF for email attachment:', pdfErr.message);
  }

  const mailOptions = {
    from: `"${smtpFromName}" <${smtpFrom}>`,
    to: order.buyerEmail,
    subject,
    html: htmlBody,
    attachments,
  };

  await transporter.sendMail(mailOptions);

  // Log email
  await prisma.emailLog.create({
    data: {
      invoiceId: invoice.id,
      companyId,
      toEmail: order.buyerEmail,
      toName: order.buyerName,
      subject,
      status: 'sent',
    },
  });

  // Update invoice
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { emailSent: true, emailSentAt: new Date() },
  });
}

export async function resendInvoiceEmail(invoiceId: string, companyId: string, customMessage?: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: { order: { include: { event: true } } },
  });

  if (!invoice) throw new Error('Nota não encontrada');
  if (invoice.status !== 'ISSUED') throw new Error('Nota não emitida');

  await sendInvoiceEmail(companyId, invoice.order, invoice, customMessage);
}
