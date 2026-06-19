import { Router } from 'express';
import { listEvents, getEvent, updateEventSettings } from './events.controller';
import { authGuard } from '../../common/guards/auth.guard';

export const eventsRouter = Router();

eventsRouter.use(authGuard);
eventsRouter.get('/', listEvents);
eventsRouter.get('/:id', getEvent);
eventsRouter.put('/:id/settings', updateEventSettings);
