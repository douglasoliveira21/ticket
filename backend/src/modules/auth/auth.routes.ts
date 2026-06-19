import { Router } from 'express';
import { login, register, me, changePassword } from './auth.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', authGuard, me);
authRouter.post('/change-password', authGuard, changePassword);
