import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';

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
    return res.status(500).json({ success: false, error: 'Erro ao registrar' });
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
