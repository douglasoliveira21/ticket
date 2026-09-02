import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';
import { encrypt } from '../../common/utils/encryption';
import { resendInvoiceEmail, sendTestEmail } from './email.service';

const emailSettingsSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email().optional(),
  smtpFromName: z.string().optional(),
  useTls: z.boolean().optional(),
  templateAssunto: z.string().optional(),
  templateCorpo: z.string().optional(),
});

export async function getEmailSettings(req: AuthRequest, res: Response) {
  try {
    const settings = await prisma.emailSettings.findUnique({
      where: { companyId: req.companyId! },
    });

    if (!settings) {
      return res.json({ success: true, data: null });
    }

    // Remove sensitive fields
    const { smtpUser, smtpPass, ...safeSettings } = settings;
    res.json({ success: true, data: { ...safeSettings, hasCredentials: !!smtpUser } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar configurações de e-mail' });
  }
}

export async function updateEmailSettings(req: AuthRequest, res: Response) {
  try {
    const data = emailSettingsSchema.parse(req.body);

    const encryptedData: any = { ...data };
    if (data.smtpHost) encryptedData.smtpHost = encrypt(data.smtpHost);
    if (data.smtpUser) encryptedData.smtpUser = encrypt(data.smtpUser);
    if (data.smtpPass) encryptedData.smtpPass = encrypt(data.smtpPass);

    await prisma.emailSettings.upsert({
      where: { companyId: req.companyId! },
      update: encryptedData,
      create: { ...encryptedData, companyId: req.companyId! },
    });

    res.json({ success: true, message: 'Configurações de e-mail atualizadas' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }
    return res.status(500).json({ success: false, error: 'Erro ao atualizar configurações' });
  }
}

export async function resendEmail(req: AuthRequest, res: Response) {
  try {
    const customMessage = req.body?.message || undefined;
    await resendInvoiceEmail(req.params.invoiceId, req.companyId!, customMessage);
    res.json({ success: true, message: 'E-mail reenviado com sucesso' });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

const testEmailSchema = z.object({
  toEmail: z.string().email('E-mail de destino inválido'),
});

export async function sendTestEmailHandler(req: AuthRequest, res: Response) {
  try {
    const { toEmail } = testEmailSchema.parse(req.body);
    await sendTestEmail(req.companyId!, toEmail);
    res.json({ success: true, message: 'E-mail de teste enviado com sucesso' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || 'Dados inválidos' });
    }
    return res.status(400).json({ success: false, error: error.message });
  }
}

export async function listEmailLogs(req: AuthRequest, res: Response) {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const where: any = { companyId: req.companyId! };
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        include: { invoice: { select: { numeroNota: true } } },
        orderBy: { sentAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar histórico de e-mails' });
  }
}
