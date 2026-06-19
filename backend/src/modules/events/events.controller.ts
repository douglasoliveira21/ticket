import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';

export async function listEvents(req: AuthRequest, res: Response) {
  try {
    const events = await prisma.event.findMany({
      where: { companyId: req.companyId },
      include: {
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add invoice stats for each event
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const invoiceStats = await prisma.invoice.groupBy({
          by: ['status'],
          where: {
            order: { eventId: event.id },
            companyId: req.companyId,
          },
          _count: true,
        });

        const totalInvoices = invoiceStats.reduce((sum, s) => sum + s._count, 0);
        const issuedInvoices = invoiceStats.find(s => s.status === 'ISSUED')?._count || 0;
        const pendingInvoices = event._count.orders - totalInvoices;

        return {
          ...event,
          totalOrders: event._count.orders,
          totalInvoices,
          issuedInvoices,
          pendingInvoices: pendingInvoices > 0 ? pendingInvoices : 0,
        };
      })
    );

    res.json({ success: true, data: eventsWithStats });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao listar eventos' });
  }
}

export async function getEvent(req: AuthRequest, res: Response) {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
      include: {
        _count: { select: { orders: true } },
        orders: {
          take: 10,
          orderBy: { purchaseDate: 'desc' },
          include: {
            invoices: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ success: false, error: 'Evento não encontrado' });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao buscar evento' });
  }
}

export async function updateEventSettings(req: AuthRequest, res: Response) {
  try {
    const schema = z.object({
      autoEmitNfse: z.boolean().optional(),
      codigoServico: z.string().optional(),
      aliquotaIss: z.number().optional(),
      descricaoServico: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const event = await prisma.event.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });

    if (!event) {
      return res.status(404).json({ success: false, error: 'Evento não encontrado' });
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }
    return res.status(500).json({ success: false, error: 'Erro ao atualizar evento' });
  }
}
