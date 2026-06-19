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
        const existing = await prisma.event.findUnique({
          where: { symplaId: String(symplaEvent.id) },
        });

        if (!existing) {
          await prisma.event.create({
            data: {
              companyId: req.companyId!,
              symplaIntegrationId: integration.id,
              symplaId: String(symplaEvent.id),
              name: symplaEvent.name || 'Sem nome',
              description: symplaEvent.detail || null,
              startDate: symplaEvent.start_date ? new Date(symplaEvent.start_date) : null,
              endDate: symplaEvent.end_date ? new Date(symplaEvent.end_date) : null,
              location: symplaEvent.address?.name || null,
              status: symplaEvent.published ? 'active' : 'draft',
              url: symplaEvent.url || null,
              organizer: symplaEvent.organizer?.name || null,
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
    return res.status(500).json({ success: false, error: 'Erro ao importar eventos' });
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
          const response = await service.getEventParticipants(event.symplaId, page);
          const participants = response.data || [];

          for (const participant of participants) {
            const existingOrder = await prisma.order.findUnique({
              where: { symplaOrderId: String(participant.order_id) },
            });

            if (!existingOrder) {
              await prisma.order.create({
                data: {
                  companyId: req.companyId!,
                  eventId: event.id,
                  symplaOrderId: String(participant.order_id),
                  symplaParticipantId: String(participant.id),
                  buyerName: `${participant.first_name || ''} ${participant.last_name || ''}`.trim(),
                  buyerEmail: participant.email || '',
                  buyerDocument: participant.document || null,
                  buyerPhone: participant.phone || null,
                  amount: participant.ticket_sale_price || 0,
                  fees: 0,
                  netAmount: participant.ticket_sale_price || 0,
                  purchaseDate: participant.order_date ? new Date(participant.order_date) : new Date(),
                  orderStatus: participant.order_status || 'approved',
                  ticketType: participant.ticket_name || null,
                  ticketNumber: participant.ticket_num || null,
                  origin: 'SYMPLA',
                  rawPayload: participant,
                },
              });
              totalImported++;
            }
          }

          hasMore = participants.length > 0 && response.pagination?.has_next;
          page++;
        } catch (err) {
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
        const response = await service.getEventParticipants(event.symplaId, page);
        const participants = response.data || [];

        for (const participant of participants) {
          const existingOrder = await prisma.order.findUnique({
            where: { symplaOrderId: String(participant.order_id) },
          });

          if (!existingOrder) {
            await prisma.order.create({
              data: {
                companyId: req.companyId!,
                eventId: event.id,
                symplaOrderId: String(participant.order_id),
                symplaParticipantId: String(participant.id),
                buyerName: `${participant.first_name || ''} ${participant.last_name || ''}`.trim(),
                buyerEmail: participant.email || '',
                buyerDocument: participant.document || null,
                buyerPhone: participant.phone || null,
                amount: participant.ticket_sale_price || 0,
                fees: 0,
                netAmount: participant.ticket_sale_price || 0,
                purchaseDate: participant.order_date ? new Date(participant.order_date) : new Date(),
                orderStatus: participant.order_status || 'approved',
                ticketType: participant.ticket_name || null,
                ticketNumber: participant.ticket_num || null,
                origin: 'SYMPLA',
                rawPayload: participant,
              },
            });
            imported++;
          }
        }

        hasMore = participants.length > 0 && response.pagination?.has_next;
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
