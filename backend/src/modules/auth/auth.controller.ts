import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';
import { sendPasswordResetEmail } from '../email/email.service';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  companyName: z.string().min(2),
  cnpj: z.string().min(14).max(18),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function register(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'E-mail já cadastrado' });
    }

    const cnpjClean = data.cnpj.replace(/\D/g, '');
    const existingCompany = await prisma.company.findUnique({ where: { cnpj: cnpjClean } });
    if (existingCompany) {
      return res.status(400).json({ success: false, error: 'CNPJ já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const company = await prisma.company.create({
      data: {
        razaoSocial: data.companyName,
        cnpj: cnpjClean,
      },
    });

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    const token = jwt.sign(
      { userId: user.id, companyId: company.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' as any }
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: company.id,
        action: 'REGISTER',
        entity: 'user',
        entityId: user.id,
        ip: req.ip,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: { id: company.id, razaoSocial: company.razaoSocial, cnpj: company.cnpj },
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos', details: error.errors });
    }
    console.error('Register error:', error);
    return res.status(500).json({ success: false, error: 'Erro ao registrar', detail: error.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { company: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { userId: user.id, companyId: user.companyId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' as any }
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: user.companyId,
        action: 'LOGIN',
        entity: 'user',
        entityId: user.id,
        ip: req.ip,
      },
    });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: user.company ? {
          id: user.company.id,
          razaoSocial: user.company.razaoSocial,
          cnpj: user.company.cnpj,
        } : null,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }
    return res.status(500).json({ success: false, error: 'Erro ao fazer login' });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        company: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar usuário' });
  }
}

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Resposta genérica sempre igual, exista ou não o e-mail - evita
    // que alguém descubra quais e-mails têm conta testando este endpoint.
    const genericResponse = { success: true, message: 'Se o e-mail existir, enviaremos um link de redefinição de senha.' };

    if (!user || !user.isActive) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: expires },
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/redefinir-senha?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.companyId, user.email, resetLink);
    } catch (emailError) {
      console.error('Erro ao enviar e-mail de redefinição de senha:', emailError);
      // Não expõe o erro de envio ao solicitante - mesma resposta genérica.
    }

    res.json(genericResponse);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'E-mail inválido' });
    }
    return res.status(500).json({ success: false, error: 'Erro ao processar solicitação' });
  }
}

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: { resetPasswordTokenHash: tokenHash, resetPasswordExpires: { gt: new Date() } },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Link de redefinição inválido ou expirado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetPasswordTokenHash: null, resetPasswordExpires: null },
    });

    await prisma.auditLog.create({
      data: { userId: user.id, companyId: user.companyId, action: 'RESET_PASSWORD', entity: 'user', entityId: user.id, ip: req.ip },
    });

    res.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }
    return res.status(500).json({ success: false, error: 'Erro ao redefinir senha' });
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6),
    });

    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    const validPassword = await bcrypt.compare(data.currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Senha atual incorreta' });
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }
    return res.status(500).json({ success: false, error: 'Erro ao alterar senha' });
  }
}
