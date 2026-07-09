import { Response } from 'express';
import { z } from 'zod';
import prisma from '../../common/utils/prisma';
import { AuthRequest } from '../../common/guards/auth.guard';
import { encrypt } from '../../common/utils/encryption';
import { SymplaService } from './sympla.service';

const integrationSchema = z.object({
  name: z.string().min(2),
  token: z.string().min(10),
  syncAutoEnabled: z.boolean().optional(),
});

export async function listIntegrations(req: AuthRequest, res: Response) {
  try {
    const integrations = await prisma.symplaIntegration.findMany({
      where: { companyId: req.companyId },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastSync: true,
        syncAutoEnabled: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: integrations });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao listar integrações' });
  }
}

export async function createIntegration(req: AuthRequest, res: Response) {
  try {
    const data = integrationSchema.parse(req.body);

    const encryptedToken = encrypt(data.token);

    const integration = await prisma.symplaIntegration.create({
      data: {
        name: data.name,
        token: encryptedToken,
        companyId: req.companyId!,
        syncAutoEnabled: data.syncAutoEnabled || false,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'CREATE_SYMPLA_INTEGRATION',
        entity: 'sympla_integration',
        entityId: integration.id,
        ip: req.ip,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: integration.id,
        name: integration.name,
        isActive: integration.isActive,
        syncAutoEnabled: integration.syncAutoEnabled,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Dados inválidos', details: error.errors });
    }
    return res.status(500).json({ success: false, error: 'Erro ao criar integração' });
  }
}

export async function testConnection(req: AuthRequest, res: Response) {
  try {
    const integration = await prisma.symplaIntegration.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integração não encontrada' });
    }

    const service = new SymplaService(integration.token);
    const connected = await service.testConnection();

    res.json({ success: true, data: { connected } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao testar conexão' });
  }
}

export async function importEvents(req: AuthRequest, res: Response) {
  try {
    const integration = await prisma.symplaIntegration.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integração não encontrada' });
    }

    const service = new SymplaService(integration.token);
    let page = 1;
    let imported = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await service.getEvents(page);
      const events = response.data || [];

      for (const symplaEvent of events) {
        const eventId = String(symplaEvent.id);
        const existing = await prisma.event.findUnique({
          where: { symplaId: eventId },
        });

        if (!existing) {
          await prisma.event.create({
            data: {
              companyId: req.companyId!,
              symplaIntegrationId: integration.id,
              symplaId: eventId,
              name: symplaEvent.name || 'Sem nome',
              description: symplaEvent.detail || null,
              startDate: symplaEvent.start_date ? new Date(symplaEvent.start_date) : null,
              endDate: symplaEvent.end_date ? new Date(symplaEvent.end_date) : null,
              location: symplaEvent.address?.name || null,
              status: symplaEvent.published ? 'active' : 'draft',
              url: symplaEvent.url || null,
              organizer: symplaEvent.host?.name || null,
              origin: 'SYMPLA',
              rawPayload: symplaEvent,
              lastSync: new Date(),
            },
          });
          imported++;
        } else {
          await prisma.event.update({
            where: { id: existing.id },
            data: {
              name: symplaEvent.name || existing.name,
              description: symplaEvent.detail || existing.description,
              startDate: symplaEvent.start_date ? new Date(symplaEvent.start_date) : existing.startDate,
              endDate: symplaEvent.end_date ? new Date(symplaEvent.end_date) : existing.endDate,
              location: symplaEvent.address?.name || existing.location,
              status: symplaEvent.published ? 'active' : 'draft',
              url: symplaEvent.url || existing.url,
              rawPayload: symplaEvent,
              lastSync: new Date(),
            },
          });
        }
      }

      hasMore = events.length > 0 && response.pagination?.has_next;
      page++;
    }

    await prisma.symplaIntegration.update({
      where: { id: integration.id },
      data: { lastSync: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'IMPORT_SYMPLA_EVENTS',
        entity: 'event',
        details: { imported },
        ip: req.ip,
      },
    });

    res.json({ success: true, data: { imported } });
  } catch (error: any) {
    console.error('Import events error:', error.message);
    console.error('Import events detail:', error.response?.status, error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : '');
    console.error('Import events stack:', error.stack);
    return res.status(500).json({ success: false, error: 'Erro ao importar eventos', detail: error.message });
  }
}

export async function syncOrders(req: AuthRequest, res: Response) {
  try {
    const integration = await prisma.symplaIntegration.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integração não encontrada' });
    }

    const events = await prisma.event.findMany({
      where: { symplaIntegrationId: integration.id, companyId: req.companyId },
    });

    const service = new SymplaService(integration.token);
    let totalImported = 0;

    for (const event of events) {
      if (!event.symplaId) continue;

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await service.getEventOrders(event.symplaId, page);
          const orders = response.data || [];

          for (const order of orders) {
            const existingOrder = await prisma.order.findUnique({
              where: { symplaOrderId: String(order.id) },
            });

            if (!existingOrder) {
              const buyerName = `${order.buyer_first_name || ''} ${order.buyer_last_name || ''}`.trim();
              const invoiceInfo = order.invoice_info || {};
              const document = invoiceInfo.doc_number || null;

              await prisma.order.create({
                data: {
                  companyId: req.companyId!,
                  eventId: event.id,
                  symplaOrderId: String(order.id),
                  symplaParticipantId: null,
                  buyerName: invoiceInfo.client_name || buyerName,
                  buyerEmail: order.buyer_email || '',
                  buyerDocument: document,
                  buyerPhone: null,
                  amount: order.order_total_sale_price || 0,
                  fees: (order.order_total_sale_price || 0) - (order.order_total_net_value || 0),
                  netAmount: order.order_total_net_value || 0,
                  purchaseDate: order.order_date ? new Date(order.order_date) : new Date(),
                  orderStatus: order.order_status === 'APPROVED' ? 'approved' : (order.order_status?.toLowerCase() || 'pending'),
                  ticketType: order.transaction_type || null,
                  ticketNumber: null,
                  origin: 'SYMPLA',
                  rawPayload: order,
                },
              });
              totalImported++;
            }
          }

          hasMore = orders.length > 0 && response.pagination?.has_next;
          page++;
        } catch (err: any) {
          console.error('Sync orders event error:', event.symplaId, err.message);
          hasMore = false;
        }
      }
    }

    await prisma.symplaIntegration.update({
      where: { id: integration.id },
      data: { lastSync: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'SYNC_SYMPLA_ORDERS',
        entity: 'order',
        details: { totalImported },
        ip: req.ip,
      },
    });

    res.json({ success: true, data: { imported: totalImported } });
  } catch (error: any) {
    console.error('Sync orders error:', error.message);
    return res.status(500).json({ success: false, error: 'Erro ao sincronizar vendas' });
  }
}

export async function syncOrdersByEvent(req: AuthRequest, res: Response) {
  try {
    const { id, eventId } = req.params;

    const integration = await prisma.symplaIntegration.findFirst({
      where: { id, companyId: req.companyId },
    });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integração não encontrada' });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, companyId: req.companyId },
    });

    if (!event || !event.symplaId) {
      return res.status(404).json({ success: false, error: 'Evento não encontrado' });
    }

    const service = new SymplaService(integration.token);
    let page = 1;
    let hasMore = true;
    let imported = 0;

    while (hasMore) {
      try {
        const response = await service.getEventOrders(event.symplaId, page);
        const orders = response.data || [];

        for (const order of orders) {
          const existingOrder = await prisma.order.findUnique({
            where: { symplaOrderId: String(order.id) },
          });

          if (!existingOrder) {
            const buyerName = `${order.buyer_first_name || ''} ${order.buyer_last_name || ''}`.trim();
            const invoiceInfo = order.invoice_info || {};
            const document = invoiceInfo.doc_number || null;

            await prisma.order.create({
              data: {
                companyId: req.companyId!,
                eventId: event.id,
                symplaOrderId: String(order.id),
                symplaParticipantId: null,
                buyerName: invoiceInfo.client_name || buyerName,
                buyerEmail: order.buyer_email || '',
                buyerDocument: document,
                buyerPhone: null,
                amount: order.order_total_sale_price || 0,
                fees: (order.order_total_sale_price || 0) - (order.order_total_net_value || 0),
                netAmount: order.order_total_net_value || 0,
                purchaseDate: order.order_date ? new Date(order.order_date) : new Date(),
                orderStatus: order.order_status === 'APPROVED' ? 'approved' : (order.order_status?.toLowerCase() || 'pending'),
                ticketType: order.transaction_type || null,
                ticketNumber: null,
                origin: 'SYMPLA',
                rawPayload: order,
              },
            });
            imported++;
          }
        }

        hasMore = orders.length > 0 && response.pagination?.has_next;
        page++;
      } catch (err) {
        hasMore = false;
      }
    }

    res.json({ success: true, data: { imported } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Erro ao sincronizar vendas do evento' });
  }
}

export async function deleteIntegration(req: AuthRequest, res: Response) {
  try {
    const integration = await prisma.symplaIntegration.findFirst({
      where: { id: req.params.id, companyId: req.companyId },
    });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integração não encontrada' });
    }

    await prisma.symplaIntegration.delete({ where: { id: integration.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        companyId: req.companyId,
        action: 'DELETE_SYMPLA_INTEGRATION',
        entity: 'sympla_integration',
        entityId: integration.id,
        ip: req.ip,
      },
    });

    res.json({ success: true, message: 'Integração removida' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erro ao remover integração' });
  }
}
