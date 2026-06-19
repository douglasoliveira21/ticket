import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  issueInvoice,
  issueBatch,
  retryInvoice,
  cancelInvoice,
} from './invoices.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const invoicesRouter = Router();

invoicesRouter.use(authGuard);
invoicesRouter.get('/', listInvoices);
invoicesRouter.get('/:id', getInvoice);
invoicesRouter.post('/issue/:orderId', issueInvoice);
invoicesRouter.post('/issue-batch', issueBatch);
invoicesRouter.post('/:id/retry', retryInvoice);
invoicesRouter.post('/:id/cancel', cancelInvoice);
