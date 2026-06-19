import { Router } from 'express';
import { listOrders, getOrder, ignoreOrder } from './orders.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const ordersRouter = Router();

ordersRouter.use(authGuard);
ordersRouter.get('/', listOrders);
ordersRouter.get('/:id', getOrder);
ordersRouter.put('/:id/ignore', ignoreOrder);
