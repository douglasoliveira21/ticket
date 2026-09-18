import { Response } from 'express';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';
import { NfseNacionalService, NfseData } from './nfse-nacional.service';
import { sendInvoiceEmail } from '../email/email.service';

export async function listInvoices(req: AuthRequest, res: Response) {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const where: any = { companyId: req.companyId };
    if (status) where.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          order: {
            select: { buyerName: true, buyerEmail: true, event: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao listar notas fiscais' });
  }
}

export async function getInvoice(req: AuthRequest, res: Response) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
      include: {
        order: { include: { event: true } },
        invoiceAttempts: { orderBy: { createdAt: 'desc' } },
        emailLogs: { orderBy: { sentAt: 'desc' } },
      },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Nota não encontrada' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar nota fiscal' });
  }
}

export async function downloadInvoiceXml(req: AuthRequest, res: Response) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
      select: { numeroNota: true, xmlEnvio: true, xmlRetorno: true, status: true },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Nota não encontrada' });
    }

    if (invoice.status !== 'ISSUED') {
      return res.status(400).json({ success: false, error: 'Nota ainda não foi emitida' });
    }

    const xml = invoice.xmlRetorno || invoice.xmlEnvio || '';
    if (!xml) {
      return res.status(404).json({ success: false, error: 'XML da nota não disponível' });
    }

    const filename = `nfse-${invoice.numeroNota || 'rascunho'}.xml`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao baixar XML' });
  }
}

export async function downloadInvoicePdf(req: AuthRequest, res: Response) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
      include: {
        order: { select: { buyerName: true, buyerEmail: true, buyerDocument: true, buyerPhone: true, event: { select: { name: true } } } },
        company: { select: { razaoSocial: true, cnpj: true, inscricaoMunicipal: true, emailFiscal: true, telefone: true, logradouro: true, numero: true, complemento: true, bairro: true, cidade: true, uf: true, cep: true, codigoServico: true, regimeTributario: true } },
      },
    });

    if (!invoice) return res.status(404).json({ success: false, error: 'Nota não encontrada' });
    if (invoice.status !== 'ISSUED') return res.status(400).json({ success: false, error: 'Nota ainda não foi emitida' });

    const { generateDanfseHtml } = await import('./danfse-template');

    const company = invoice.company;
    const order = invoice.order;
    const dataEmissao = invoice.dataEmissao ? new Date(invoice.dataEmissao) : new Date();
    const dataFormatada = dataEmissao.toLocaleDateString('pt-BR');
    const dataHoraFormatada = `${dataFormatada} ${dataEmissao.toLocaleTimeString('pt-BR')}`;
    const enderecoCompleto = [company?.logradouro, company?.numero, company?.complemento, company?.bairro].filter(Boolean).join(', ');

    const chaveAcesso = invoice.codigoVerificacao || `${company?.cnpj?.replace(/\D/g, '')}${invoice.numeroNota || ''}`;

    const danfseData = {
      chaveAcesso,
      numeroNfse: invoice.numeroNota || '-',
      competencia: dataFormatada,
      dataHoraEmissao: dataHoraFormatada,
      numeroDps: invoice.numeroRps || '-',
      serieDps: invoice.serieRps || '1',
      dataHoraEmissaoDps: dataHoraFormatada,

      prestadorCnpj: company?.cnpj || '-',
      prestadorInscricaoMunicipal: company?.inscricaoMunicipal || '-',
      prestadorTelefone: company?.telefone || '-',
      prestadorNome: company?.razaoSocial || '-',
      prestadorEmail: company?.emailFiscal || '-',
      prestadorEndereco: enderecoCompleto || '-',
      prestadorMunicipio: `${company?.cidade || 'BELO HORIZONTE'} - ${company?.uf || 'MG'}`,
      prestadorCep: company?.cep || '-',
      simplesNacional: 'Não optante',
      regimeApuracao: '-',

      tomadorCpfCnpj: order?.buyerDocument || '-',
      tomadorInscricaoMunicipal: '-',
      tomadorTelefone: order?.buyerPhone || '-',
      tomadorNome: order?.buyerName || '-',
      tomadorEmail: order?.buyerEmail || '-',
      tomadorEndereco: '-',
      tomadorMunicipio: 'Belo Horizonte - MG',
      tomadorCep: '-',

      codigoTribNacional: invoice.codigoServico || '-',
      codigoTribMunicipal: invoice.codigoServico || '-',
      localPrestacao: `${company?.cidade || 'BELO HORIZONTE'} - ${company?.uf || 'MG'}`,
      paisPrestacao: '-',
      descricaoServico: invoice.descricaoServico || '-',

      tributacaoIssqn: 'Operação Tributável',
      paisResultado: '-',
      municipioIncidencia: `${company?.cidade || 'BELO HORIZONTE'} - ${company?.uf || 'MG'}`,
      regimeEspecial: 'Nenhum',
      tipoImunidade: '-',
      suspensaoExigibilidade: 'Não',
      numeroProcessoSuspensao: '-',
      beneficioMunicipal: '-',
      valorServico: `R$ ${invoice.valorServico?.toFixed(2) || '0,00'}`,
      descontoIncondicionado: '-',
      totalDeducoes: '-',
      calculoBm: '-',
      bcIssqn: `R$ ${invoice.valorServico?.toFixed(2) || '0,00'}`,
      aliquotaAplicada: `${invoice.aliquotaIss?.toFixed(2) || '0,00'}%`,
      retencaoIssqn: 'Não Retido',
      issqnApurado: `R$ ${invoice.valorIss?.toFixed(2) || '0,00'}`,

      irrf: '-',
      contribuicaoPrevidenciaria: '-',
      contribuicoesSociais: '-',
      descricaoContribSociais: '-',
      pisDebito: '-',
      cofinsDebito: '-',

      valorServicoTotal: `R$ ${invoice.valorServico?.toFixed(2) || '0,00'}`,
      descontoCondicionado: '-',
      descontoIncondicionadoTotal: '-',
      issqnRetido: '-',
      totalRetencoesFederais: '-',
      pisCofinsDebito: '-',
      valorLiquido: `R$ ${((invoice.valorServico || 0) - (invoice.valorIss || 0)).toFixed(2)}`,

      tributosFederais: '-',
      tributosEstaduais: '-',
      tributosMunicipais: '-',

      informacoesComplementares: `Chave de acesso: ${chaveAcesso}. Nota emitida via sistema de gestão fiscal.`,
    };

    const html = await generateDanfseHtml(danfseData);

    // Gerar PDF a partir do HTML
    let pdfBuffer: Buffer | null = null;
    try {
      const { htmlToPdf } = await import('../../common/utils/pdf-generator');
      pdfBuffer = await htmlToPdf(html);
    } catch (err: any) {
      console.warn('PDF generation failed, falling back to HTML:', err.message);
    }

    if (pdfBuffer) {
      const filename = `danfse-${invoice.numeroNota || 'nota'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } else {
      // Fallback: retornar HTML se PDF falhar
      const filename = `danfse-${invoice.numeroNota || 'nota'}.html`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(html);
    }
  } catch (error: any) {
    console.error('Download PDF error:', error);
    return res.status(500).json({ success: false, error: 'Erro ao gerar nota fiscal' });
  }
}

async function processInvoiceEmission(orderId: string, companyId: string, userId?: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: { event: true },
  });

  if (!order) throw new Error('Venda não encontrada');

  // Check if invoice already exists
  const existingInvoice = await prisma.invoice.findFirst({
    where: { orderId: order.id, status: { in: ['ISSUED', 'PROCESSING'] } },
  });

  if (existingInvoice) throw new Error('Nota já emitida ou em processamento para esta venda');

  // Get company and fiscal settings
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const fiscalSettings = await prisma.fiscalSettings.findUnique({ where: { companyId } });

  if (!company) throw new Error('Empresa não encontrada');
  if (!company.cnpj || !company.inscricaoMunicipal) {
    throw new Error('Dados fiscais da empresa incompletos. Configure CNPJ e Inscrição Municipal.');
  }

  const codigoServico = order.event?.codigoServico || company.codigoServico;
  const aliquotaIss = order.event?.aliquotaIss ?? company.aliquotaIss;
  const descricaoServico = order.event?.descricaoServico ||
    fiscalSettings?.descricaoPadrao ||
    `Serviço de evento - ${order.event?.name || 'Ingresso'}`;

  if (!codigoServico || aliquotaIss === null || aliquotaIss === undefined) {
    throw new Error('Código de serviço e alíquota ISS devem estar configurados');
  }

  // Get next RPS number. Avança sempre, mesmo se a emissão falhar - o
  // idDps da DPS é formado a partir desse número, e o SEFIN Nacional trata
  // a DPS como idempotente por Id: reenviar o mesmo número gera o mesmo
  // idDps, e uma tentativa anterior (com dados diferentes) pode fazer o
  // SEFIN devolver o erro já registrado daquela vez, sem reprocessar os
  // dados novos da tentativa atual.
  const currentRps = fiscalSettings?.proximoNumeroRps || 1;
  if (fiscalSettings) {
    await prisma.fiscalSettings.update({
      where: { id: fiscalSettings.id },
      data: { proximoNumeroRps: currentRps + 1 },
    });
  }

  // Create invoice record
  const invoice = await prisma.invoice.create({
    data: {
      companyId,
      orderId: order.id,
      status: 'PROCESSING',
      valorServico: order.amount,
      aliquotaIss,
      valorIss: order.amount * (aliquotaIss / 100),
      codigoServico,
      descricaoServico,
      numeroRps: String(currentRps),
      serieRps: fiscalSettings?.serieRps || '1',
    },
  });

  // Prepare NFS-e data
  const nfseData: NfseData = {
    cnpjPrestador: company.cnpj,
    inscricaoMunicipal: company.inscricaoMunicipal,
    cpfCnpjTomador: order.buyerDocument?.replace(/\D/g, '') || '00000000000',
    nomeTomador: order.buyerName,
    emailTomador: order.buyerEmail,
    valorServico: order.amount,
    aliquotaIss,
    codigoServico,
    descricaoServico,
    codigoMunicipio: company.codigoMunicipio || '3106200', // BH default
    numeroRps: currentRps,
    serieRps: fiscalSettings?.serieRps || '1',
    dataEmissao: new Date(),
    // Obrigatorio pelo SEFIN Nacional para servicos do item 12 (diversoes/
    // eventos). Usa o endereco cadastrado da empresa como local do evento,
    // já que ainda não temos um endereço de local por evento na base.
    evento: {
      nome: order.event?.name || descricaoServico,
      dataInicio: order.event?.startDate || new Date(),
      dataFim: order.event?.endDate || order.event?.startDate || new Date(),
      endereco: {
        cep: company.cep || '',
        logradouro: company.logradouro || '',
        numero: company.numero || '',
        complemento: company.complemento || undefined,
        bairro: company.bairro || '',
      },
    },
  };

  // Call NFS-e service (Sistema Nacional NFS-e - obrigatorio para BH desde 01/01/2026)
  const nfseService = new NfseNacionalService({
    ambiente: fiscalSettings?.ambiente || 'homologacao',
    companyId,
    razaoSocialPrestador: company.razaoSocial,
    regimeTributario: company.regimeTributario,
    cTribNac: company.cTribNac,
    cTribMun: company.cTribMun,
  });

  const result = await nfseService.emitirNfse(nfseData);

  let requestXml: string | null = null;
  try {
    requestXml = nfseService.buildDps(nfseData).xml;
  } catch {
    // Falha ao montar a DPS (ex: dados de evento ausentes) já está refletida
    // em result.errorMessage - não deve impedir o registro da tentativa.
  }

  // Record attempt
  await prisma.invoiceAttempt.create({
    data: {
      invoiceId: invoice.id,
      status: result.success ? 'success' : 'error',
      requestXml,
      responseXml: result.xmlRetorno || null,
      errorMessage: result.errorMessage || null,
    },
  });

  if (result.success) {
    // Update invoice with success data. Quando o SEFIN Nacional retorna a
    // alíquota/ISS realmente aplicados (parametrizados pelo município), eles
    // substituem a estimativa configurada em Empresa/Evento - o que fica
    // gravado passa a ser o valor real da nota, não a estimativa prévia.
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'ISSUED',
        numeroNota: result.numeroNota,
        codigoVerificacao: result.codigoVerificacao,
        chaveAcesso: result.chaveAcesso,
        idDps: result.idDps,
        protocolo: result.protocolo,
        xmlRetorno: result.xmlRetorno,
        pdfUrl: result.pdfUrl,
        dataEmissao: new Date(),
        attempts: { increment: 1 },
        lastAttempt: new Date(),
        ...(result.aliquotaAplicada !== undefined ? { aliquotaIss: result.aliquotaAplicada } : {}),
        ...(result.valorIssReal !== undefined ? { valorIss: result.valorIssReal } : {}),
      },
    });

    // Send email
    try {
      await sendInvoiceEmail(companyId, order, invoice);
    } catch (emailError) {
      console.error('Error sending invoice email:', emailError);
    }

    // Audit
    await prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: 'ISSUE_NFSE',
        entity: 'invoice',
        entityId: invoice.id,
        details: { numeroNota: result.numeroNota, orderId: order.id },
      },
    });

    return { ...invoice, status: 'ISSUED', numeroNota: result.numeroNota };
  } else {
    // Update invoice with error
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'ERROR',
        errorMessage: result.errorMessage,
        attempts: { increment: 1 },
        lastAttempt: new Date(),
      },
    });

    throw new Error(result.errorMessage || 'Erro ao emitir NFS-e');
  }
}

export async function consultarParametroMunicipal(req: AuthRequest, res: Response) {
  try {
    const { cTribNac } = req.params;
    const company = await prisma.company.findUnique({ where: { id: req.companyId } });
    const fiscalSettings = await prisma.fiscalSettings.findUnique({ where: { companyId: req.companyId } });

    if (!company?.codigoMunicipio) {
      return res.status(400).json({ success: false, error: 'Código do município não configurado na empresa' });
    }

    const nfseService = new NfseNacionalService({
      ambiente: 'producao',
      companyId: req.companyId,
      razaoSocialPrestador: company.razaoSocial,
      regimeTributario: company.regimeTributario,
      cTribNac: company.cTribNac,
      cTribMun: company.cTribMun,
    });

    const result = await nfseService.consultarParametroMunicipal(company.codigoMunicipio, cTribNac);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.errorMessage });
    }
    res.json({ success: true, data: result.data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Erro ao consultar parâmetros municipais' });
  }
}

export async function issueInvoice(req: AuthRequest, res: Response) {
  try {
    const result = await processInvoiceEmission(req.params.orderId, req.companyId!, req.userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

export async function issueBatch(req: AuthRequest, res: Response) {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma venda selecionada' });
    }

    const results = {
      success: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const orderId of orderIds) {
      try {
        await processInvoiceEmission(orderId, req.companyId!, req.userId);
        results.success++;
        results.details.push({ orderId, status: 'success' });
      } catch (error: any) {
        results.errors++;
        results.details.push({ orderId, status: 'error', message: error.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erro ao processar lote' });
  }
}

export async function retryInvoice(req: AuthRequest, res: Response) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, companyId: req.companyId, status: 'ERROR' },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Nota não encontrada ou não está em erro' });
    }

    // Delete the error invoice and retry
    await prisma.invoiceAttempt.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.delete({ where: { id: invoice.id } });

    const result = await processInvoiceEmission(invoice.orderId, req.companyId!, req.userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

async function processInvoiceCancellation(invoiceId: string, companyId: string, userId: string | undefined, codigoCancelamento: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
  });

  if (!invoice) {
    throw new Error('Nota não encontrada');
  }

  if (invoice.status !== 'ISSUED') {
    throw new Error('Somente notas emitidas podem ser canceladas');
  }

  if (!invoice.chaveAcesso) {
    throw new Error('Nota sem chave de acesso - não pode ser cancelada no Sistema Nacional NFS-e');
  }

  // Buscar dados da empresa e configurações fiscais
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const fiscalSettings = await prisma.fiscalSettings.findUnique({ where: { companyId } });

  if (!company || !company.cnpj || !company.inscricaoMunicipal) {
    throw new Error('Dados fiscais da empresa incompletos');
  }

  // Chamar o Sistema Nacional NFS-e para cancelar
  const nfseService = new NfseNacionalService({
    ambiente: fiscalSettings?.ambiente || 'homologacao',
    companyId,
    razaoSocialPrestador: company.razaoSocial,
    regimeTributario: company.regimeTributario,
    cTribNac: company.cTribNac,
    cTribMun: company.cTribMun,
  });

  const result = await nfseService.cancelarNfse(
    invoice.chaveAcesso,
    company.cnpj,
    codigoCancelamento
  );

  if (result.success) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELLED' },
    });

    await prisma.invoiceAttempt.create({
      data: {
        invoiceId: invoice.id,
        status: 'success',
        requestXml: `CancelarNfse - Nota: ${invoice.numeroNota}`,
        responseXml: result.xmlRetorno || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: 'CANCEL_NFSE',
        entity: 'invoice',
        entityId: invoice.id,
        details: { numeroNota: invoice.numeroNota, codigoCancelamento },
      },
    });

    return { numeroNota: invoice.numeroNota };
  } else {
    await prisma.invoiceAttempt.create({
      data: {
        invoiceId: invoice.id,
        status: 'error',
        requestXml: `CancelarNfse - Nota: ${invoice.numeroNota}`,
        responseXml: result.xmlRetorno || null,
        errorMessage: result.errorMessage,
      },
    });

    throw new Error(result.errorMessage || 'Erro ao cancelar na prefeitura');
  }
}

export async function cancelInvoice(req: AuthRequest, res: Response) {
  try {
    const codigoCancelamento = req.body?.codigoCancelamento || '2';
    await processInvoiceCancellation(req.params.id, req.companyId!, req.userId, codigoCancelamento);
    res.json({ success: true, message: 'Nota cancelada com sucesso na prefeitura' });
  } catch (error: any) {
    console.error('Cancel invoice error:', error);
    return res.status(400).json({ success: false, error: error.message || 'Erro ao cancelar nota' });
  }
}

export async function cancelBatch(req: AuthRequest, res: Response) {
  try {
    const { invoiceIds, codigoCancelamento } = req.body;

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhuma nota selecionada' });
    }

    const results = {
      success: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const invoiceId of invoiceIds) {
      try {
        await processInvoiceCancellation(invoiceId, req.companyId!, req.userId, codigoCancelamento || '2');
        results.success++;
        results.details.push({ invoiceId, status: 'success' });
      } catch (error: any) {
        results.errors++;
        results.details.push({ invoiceId, status: 'error', message: error.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erro ao processar cancelamento em lote' });
  }
}
