import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';
import { encrypt } from '../../common/utils/encryption';

const companyUpdateSchema = z.object({
  razaoSocial: z.string().min(2).optional(),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  inscricaoMunicipal: z.string().optional(),
  emailFiscal: z.string().email().optional(),
  telefone: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  codigoMunicipio: z.string().optional(),
  regimeTributario: z.string().optional(),
  codigoServico: z.string().optional(),
  aliquotaIss: z.number().optional(),
  cnae: z.string().optional(),
});

const fiscalSettingsSchema = z.object({
  prefeitura: z.string().optional(),
  ambiente: z.enum(['homologacao', 'producao']).optional(),
  urlWebservice: z.string().optional(),
  usuarioWebservice: z.string().optional(),
  senhaWebservice: z.string().optional(),
  serieRps: z.string().optional(),
  proximoNumeroRps: z.number().optional(),
  descricaoPadrao: z.string().optional(),
});

export async function getCompany(req: AuthRequest, res: Response) {
  try {
    if (!req.companyId) {
      return res.status(400).json({ success: false, error: 'Empresa não configurada' });
    }

    const company = await prisma.company.findUnique({
      where: { id: req.companyId },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: 'Empresa não encontrada' });
    }

    // Remove sensitive fields
    const { certificadoDigital, senhaCertificado, ...safeCompany } = company;

    res.json({ success: true, data: safeCompany });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar empresa' });
  }
}

export async function updateCompany(req: AuthRequest, res: Response) {
  try {
    if (!req.companyId) {
      return res.status(400).json({ success: false, error: 'Empresa não configurada' });
    }

    const data = companyUpdateSchema.parse(req.body);

    const company = await prisma.company.update({
      where: { id: req.companyId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'UPDATE_COMPANY',
        entity: 'company',
        entityId: req.companyId,
        ip: req.ip,
      },
    });

    const { certificadoDigital, senhaCertificado, ...safeCompany } = company;
    res.json({ success: true, data: safeCompany });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos', details: error.errors });
    }
    return res.status(500).json({ success: false, error: 'Erro ao atualizar empresa' });
  }
}

export async function getFiscalSettings(req: AuthRequest, res: Response) {
  try {
    if (!req.companyId) {
      return res.status(400).json({ success: false, error: 'Empresa não configurada' });
    }

    const settings = await prisma.fiscalSettings.findUnique({
      where: { companyId: req.companyId },
    });

    if (!settings) {
      return res.json({ success: true, data: null });
    }

    // Remove sensitive fields
    const { usuarioWebservice, senhaWebservice, senhaCertificado, ...safeSettings } = settings;
    res.json({ success: true, data: { ...safeSettings, hasCredentials: !!usuarioWebservice } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar configurações fiscais' });
  }
}

export async function updateFiscalSettings(req: AuthRequest, res: Response) {
  try {
    if (!req.companyId) {
      return res.status(400).json({ success: false, error: 'Empresa não configurada' });
    }

    const data = fiscalSettingsSchema.parse(req.body);

    // Encrypt sensitive fields
    const encryptedData: any = { ...data };
    if (data.usuarioWebservice) encryptedData.usuarioWebservice = encrypt(data.usuarioWebservice);
    if (data.senhaWebservice) encryptedData.senhaWebservice = encrypt(data.senhaWebservice);

    const settings = await prisma.fiscalSettings.upsert({
      where: { companyId: req.companyId },
      update: encryptedData,
      create: { ...encryptedData, companyId: req.companyId },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'UPDATE_FISCAL_SETTINGS',
        entity: 'fiscal_settings',
        entityId: settings.id,
        ip: req.ip,
      },
    });

    res.json({ success: true, message: 'Configurações fiscais atualizadas' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos', details: error.errors });
    }
    return res.status(500).json({ success: false, error: 'Erro ao atualizar configurações fiscais' });
  }
}
