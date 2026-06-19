import { Response } from 'express';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';

export async function listAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { page = '1', limit = '50', action, entity } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const where: any = { companyId: req.companyId };
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao listar logs' });
  }
}
