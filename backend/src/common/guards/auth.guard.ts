import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export interface AuthRequest extends Request {
  userId?: string;
  companyId?: string;
  userRole?: string;
}

export async function authGuard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, companyId: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Usuário inativo ou não encontrado' });
    }

    req.userId = user.id;
    req.companyId = user.companyId || undefined;
    req.userRole = user.role;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
}

export function adminGuard(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Acesso restrito a administradores' });
  }
  next();
}
