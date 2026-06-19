import { Router } from 'express';
import {
  listIntegrations,
  createIntegration,
  testConnection,
  importEvents,
  syncOrders,
  syncOrdersByEvent,
  deleteIntegration,
} from './sympla.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const symplaRouter = Router();

symplaRouter.use(authGuard);
symplaRouter.get('/integrations', listIntegrations);
symplaRouter.post('/integrations', createIntegration);
symplaRouter.post('/integrations/:id/test', testConnection);
symplaRouter.post('/integrations/:id/import-events', importEvents);
symplaRouter.post('/integrations/:id/sync-orders', syncOrders);
symplaRouter.post('/integrations/:id/sync-orders/:eventId', syncOrdersByEvent);
symplaRouter.delete('/integrations/:id', deleteIntegration);
