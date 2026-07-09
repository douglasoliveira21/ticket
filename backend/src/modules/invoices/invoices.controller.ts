import { Response } from 'express';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';
import { NfseBHService, NfseData } from './nfse-bh.service';
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
  const aliquotaIss = order.event?.aliquotaIss || company.aliquotaIss;
  const descricaoServico = order.event?.descricaoServico ||
    fiscalSettings?.descricaoPadrao ||
    `Serviço de evento - ${order.event?.name || 'Ingresso'}`;

  if (!codigoServico || !aliquotaIss) {
    throw new Error('Código de serviço e alíquota ISS devem estar configurados');
  }

  // Get next RPS number
  const currentRps = fiscalSettings?.proximoNumeroRps || 1;

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
  };

  // Call NFS-e service
  const nfseService = new NfseBHService({
    ambiente: fiscalSettings?.ambiente || 'homologacao',
    urlWebservice: fiscalSettings?.urlWebservice || undefined,
    usuario: fiscalSettings?.usuarioWebservice || undefined,
    senha: fiscalSettings?.senhaWebservice || undefined,
    companyId,
  });

  const result = await nfseService.emitirNfse(nfseData);

  // Record attempt
  await prisma.invoiceAttempt.create({
    data: {
      invoiceId: invoice.id,
      status: result.success ? 'success' : 'error',
      requestXml: nfseService.generateRpsXml(nfseData),
      responseXml: result.xmlRetorno || null,
      errorMessage: result.errorMessage || null,
    },
  });

  if (result.success) {
    // Update invoice with success data
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'ISSUED',
        numeroNota: result.numeroNota,
        codigoVerificacao: result.codigoVerificacao,
        protocolo: result.protocolo,
        xmlRetorno: result.xmlRetorno,
        pdfUrl: result.pdfUrl,
        dataEmissao: new Date(),
        attempts: { increment: 1 },
        lastAttempt: new Date(),
      },
    });

    // Increment RPS number
    if (fiscalSettings) {
      await prisma.fiscalSettings.update({
        where: { id: fiscalSettings.id },
        data: { proximoNumeroRps: currentRps + 1 },
      });
    }

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

export async function cancelInvoice(req: AuthRequest, res: Response) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Nota não encontrada' });
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELLED' },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'CANCEL_NFSE',
        entity: 'invoice',
        entityId: invoice.id,
      },
    });

    res.json({ success: true, message: 'Nota cancelada' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao cancelar nota' });
  }
}
