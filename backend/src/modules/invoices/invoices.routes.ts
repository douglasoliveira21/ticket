import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  issueInvoice,
  issueBatch,
  retryInvoice,
  cancelInvoice,
  downloadInvoiceXml,
  downloadInvoicePdf,
  consultarParametroMunicipal,
} from './invoices.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const invoicesRouter = Router();

invoicesRouter.use(authGuard);
invoicesRouter.get('/', listInvoices);
invoicesRouter.get('/nfse-nacional/parametro-municipal/:cTribNac', consultarParametroMunicipal);
invoicesRouter.get('/:id', getInvoice);
invoicesRouter.get('/:id/download-xml', downloadInvoiceXml);
invoicesRouter.get('/:id/download-pdf', downloadInvoicePdf);
invoicesRouter.post('/issue/:orderId', issueInvoice);
invoicesRouter.post('/issue-batch', issueBatch);
invoicesRouter.post('/:id/retry', retryInvoice);
invoicesRouter.post('/:id/cancel', cancelInvoice);
