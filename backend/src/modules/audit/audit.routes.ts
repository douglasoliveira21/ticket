import { Router } from 'express';
import { listAuditLogs } from './audit.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const auditRouter = Router();

auditRouter.use(authGuard);
auditRouter.get('/', listAuditLogs);
