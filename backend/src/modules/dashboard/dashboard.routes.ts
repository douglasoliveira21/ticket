import { Router } from 'express';
import { getDashboard } from './dashboard.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const dashboardRouter = Router();

dashboardRouter.use(authGuard);
dashboardRouter.get('/', getDashboard);
