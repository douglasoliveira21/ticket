import { Response } from 'express';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';

export async function listOrders(req: AuthRequest, res: Response) {
  try {
    const {
      eventId,
      status,
      invoiceStatus,
      search,
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = req.query;

    const where: any = { companyId: req.companyId };

    if (eventId) where.eventId = eventId;
    if (status) where.orderStatus = status;
    if (search) {
      where.OR = [
        { buyerName: { contains: search as string, mode: 'insensitive' } },
        { buyerEmail: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (startDate && endDate) {
      where.purchaseDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          event: { select: { id: true, name: true } },
          invoices: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true, numeroNota: true },
          },
        },
        orderBy: { purchaseDate: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    // Filter by invoice status if provided
    let filteredOrders = orders;
    if (invoiceStatus) {
      if (invoiceStatus === 'PENDING') {
        filteredOrders = orders.filter(o => o.invoices.length === 0);
      } else {
        filteredOrders = orders.filter(o =>
          o.invoices.length > 0 && o.invoices[0].status === invoiceStatus
        );
      }
    }

    res.json({
      success: true,
      data: filteredOrders,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao listar vendas' });
  }
}

export async function getOrder(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
      include: {
        event: true,
        invoices: {
          include: { invoiceAttempts: true, emailLogs: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Venda não encontrada' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar venda' });
  }
}

export async function ignoreOrder(req: AuthRequest, res: Response) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Venda não encontrada' });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { ignored: !order.ignored },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao atualizar venda' });
  }
}
