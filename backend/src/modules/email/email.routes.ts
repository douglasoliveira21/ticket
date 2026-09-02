import { Router } from 'express';
import { getEmailSettings, updateEmailSettings, resendEmail, sendTestEmailHandler, listEmailLogs } from './email.controller';
import { authGuard, adminGuard } from '../../common/guards/auth.guard';

export const emailRouter = Router();

emailRouter.use(authGuard);
emailRouter.get('/settings', getEmailSettings);
emailRouter.put('/settings', adminGuard, updateEmailSettings);
emailRouter.post('/resend/:invoiceId', resendEmail);
emailRouter.post('/test', adminGuard, sendTestEmailHandler);
emailRouter.get('/logs', listEmailLogs);
