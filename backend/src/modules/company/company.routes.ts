import { Router } from 'express';
import { getCompany, updateCompany, updateFiscalSettings, getFiscalSettings } from './company.controller';
import { authGuard, adminGuard } from '../../common/guards/auth.guard';

export const companyRouter = Router();

companyRouter.use(authGuard);
companyRouter.get('/me', getCompany);
companyRouter.put('/me', adminGuard, updateCompany);
companyRouter.get('/fiscal-settings', getFiscalSettings);
companyRouter.put('/fiscal-settings', adminGuard, updateFiscalSettings);
