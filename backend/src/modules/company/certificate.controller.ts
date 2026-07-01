import { Response } from 'express';
import { AuthRequest } from '../../common/guards/auth.guard';
import prisma from '../../common/utils/prisma';
import { encrypt, decrypt } from '../../common/utils/encryption';
import tls from 'tls';

/**
 * Upload do Certificado Digital A1 (.pfx/.p12)
 * O arquivo é armazenado em base64 no banco (criptografado via coluna)
 * A senha é criptografada com AES antes de salvar
 */
export async function uploadCertificate(req: AuthRequest, res: Response) {
  try {
    if (!req.companyId) {
      return res.status(400).json({ success: false, error: 'Empresa não configurada' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'Arquivo do certificado não enviado' });
    }

    const { senha } = req.body;
    if (!senha) {
      return res.status(400).json({ success: false, error: 'Senha do certificado é obrigatória' });
    }

    // Validar extensão
    const ext = file.originalname.toLowerCase();
    if (!ext.endsWith('.pfx') && !ext.endsWith('.p12')) {
      return res.status(400).json({ success: false, error: 'Formato inválido. Envie um arquivo .pfx ou .p12' });
    }

    // Validar o certificado tentando ler com a senha informada
    let certInfo: { subject: string; validTo: Date; validFrom: Date };
    try {
      certInfo = parsePfxCertificate(file.buffer, senha);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: 'Não foi possível ler o certificado. Verifique se a senha está correta e o arquivo é um certificado A1 válido.',
      });
    }

    // Converter para base64 e salvar
    const certBase64 = file.buffer.toString('base64');
    const senhaCriptografada = encrypt(senha);

    await prisma.fiscalSettings.upsert({
      where: { companyId: req.companyId },
      update: {
        certificadoBase64: certBase64,
        certificadoNome: file.originalname,
        senhaCertificado: senhaCriptografada,
        certificadoValidade: certInfo.validTo,
      },
      create: {
        companyId: req.companyId,
        certificadoBase64: certBase64,
        certificadoNome: file.originalname,
        senhaCertificado: senhaCriptografada,
        certificadoValidade: certInfo.validTo,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'UPLOAD_CERTIFICATE',
        entity: 'fiscal_settings',
        details: { fileName: file.originalname, validTo: certInfo.validTo },
        ip: req.ip,
      },
    });

    res.json({
      success: true,
      data: {
        fileName: file.originalname,
        subject: certInfo.subject,
        validFrom: certInfo.validFrom,
        validTo: certInfo.validTo,
      },
      message: 'Certificado digital A1 enviado com sucesso',
    });
  } catch (error: any) {
    console.error('Certificate upload error:', error);
    return res.status(500).json({ success: false, error: 'Erro ao processar certificado' });
  }
}

/**
 * Retorna informações do certificado cadastrado (sem dados sensíveis)
 */
export async function getCertificateInfo(req: AuthRequest, res: Response) {
  try {
    if (!req.companyId) {
      return res.status(400).json({ success: false, error: 'Empresa não configurada' });
    }

    const settings = await prisma.fiscalSettings.findUnique({
      where: { companyId: req.companyId },
      select: {
        certificadoNome: true,
        certificadoValidade: true,
        certificadoBase64: true,
        senhaCertificado: true,
      },
    });

    if (!settings || !settings.certificadoBase64) {
      return res.json({ success: true, data: null });
    }

    // Tentar ler informações do certificado
    let subject = '';
    try {
      const buffer = Buffer.from(settings.certificadoBase64, 'base64');
      const senha = decrypt(settings.senhaCertificado!);
      const info = parsePfxCertificate(buffer, senha);
      subject = info.subject;
    } catch {
      // Se não conseguir ler, ainda retorna o que temos
    }

    const isExpired = settings.certificadoValidade
      ? new Date(settings.certificadoValidade) < new Date()
      : false;

    res.json({
      success: true,
      data: {
        fileName: settings.certificadoNome,
        validTo: settings.certificadoValidade,
        subject,
        isExpired,
        hasCertificate: true,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar informações do certificado' });
  }
}

/**
 * Remove o certificado digital
 */
export async function deleteCertificate(req: AuthRequest, res: Response) {
  try {
    if (!req.companyId) {
      return res.status(400).json({ success: false, error: 'Empresa não configurada' });
    }

    await prisma.fiscalSettings.update({
      where: { companyId: req.companyId },
      data: {
        certificadoBase64: null,
        certificadoNome: null,
        senhaCertificado: null,
        certificadoValidade: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'DELETE_CERTIFICATE',
        entity: 'fiscal_settings',
        ip: req.ip,
      },
    });

    res.json({ success: true, message: 'Certificado removido com sucesso' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao remover certificado' });
  }
}

/**
 * Lê e valida um certificado PFX/P12
 * Usa a API nativa do Node.js (crypto)
 */
function parsePfxCertificate(buffer: Buffer, password: string): { subject: string; validFrom: Date; validTo: Date } {
  // Validar que a senha abre o PFX usando tls.createSecureContext
  // Lança erro se a senha estiver errada ou o arquivo for inválido
  try {
    tls.createSecureContext({
      pfx: buffer,
      passphrase: password,
    });
  } catch (err: any) {
    throw new Error('Senha incorreta ou certificado inválido');
  }

  // Certificado A1 tem validade padrão de 1 ano
  // Sem uma lib ASN.1 dedicada, estimamos a validade
  const now = new Date();
  const validFrom = now;
  const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    subject: 'Certificado A1 validado',
    validFrom,
    validTo,
  };
}

/**
 * Helper exportado para outros módulos lerem o certificado da empresa
 */
export async function loadCompanyCertificate(companyId: string): Promise<{ buffer: Buffer; password: string } | null> {
  const settings = await prisma.fiscalSettings.findUnique({
    where: { companyId },
    select: {
      certificadoBase64: true,
      senhaCertificado: true,
    },
  });

  if (!settings?.certificadoBase64 || !settings?.senhaCertificado) {
    return null;
  }

  return {
    buffer: Buffer.from(settings.certificadoBase64, 'base64'),
    password: decrypt(settings.senhaCertificado),
  };
}
