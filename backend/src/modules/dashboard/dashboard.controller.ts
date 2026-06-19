import { Response } from 'express';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';

export async function getDashboard(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId;

    const [
      totalEvents,
      totalOrders,
      totalInvoicesIssued,
      totalInvoicesPending,
      totalInvoicesError,
      revenueData,
      lastSync,
      recentOrders,
      recentErrors,
    ] = await Promise.all([
      prisma.event.count({ where: { companyId } }),
      prisma.order.count({ where: { companyId } }),
      prisma.invoice.count({ where: { companyId, status: 'ISSUED' } }),
      prisma.order.count({
        where: {
          companyId,
          ignored: false,
          orderStatus: 'approved',
          invoices: { none: {} },
        },
      }),
      prisma.invoice.count({ where: { companyId, status: 'ERROR' } }),
      prisma.order.aggregate({
        where: { companyId, orderStatus: 'approved' },
        _sum: { amount: true },
      }),
      prisma.symplaIntegration.findFirst({
        where: { companyId },
        orderBy: { lastSync: 'desc' },
        select: { lastSync: true },
      }),
      prisma.order.findMany({
        where: { companyId },
        orderBy: { purchaseDate: 'desc' },
        take: 5,
        include: { event: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: { companyId, status: 'ERROR' },
        orderBy: { lastAttempt: 'desc' },
        take: 5,
        include: { order: { select: { buyerName: true } } },
      }),
    ]);

    const totalRevenue = revenueData._sum.amount || 0;

    // Revenue with invoice issued
    const issuedRevenue = await prisma.invoice.aggregate({
      where: { companyId, status: 'ISSUED' },
      _sum: { valorServico: true },
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalEvents,
          totalOrders,
          totalInvoicesIssued,
          totalInvoicesPending,
          totalInvoicesError,
          totalRevenue,
          revenueWithInvoice: issuedRevenue._sum.valorServico || 0,
        },
        lastSync: lastSync?.lastSync || null,
        recentOrders,
        recentErrors,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao carregar dashboard' });
  }
}
