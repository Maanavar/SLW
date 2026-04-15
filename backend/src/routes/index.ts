import { Router } from 'express';
import { healthRouter } from './health';
import { customersRouter } from './customers';
import { workTypesRouter } from './workTypes';
import { jobsRouter } from './jobs';
import { paymentsRouter } from './payments';
import { expensesRouter } from './expenses';
import { logsRouter } from './logs';
import { adminRouter } from './admin';

const router = Router();

router.use('/health', healthRouter);
router.use('/customers', customersRouter);
router.use('/work-types', workTypesRouter);
router.use('/jobs', jobsRouter);
router.use('/payments', paymentsRouter);
router.use('/expenses', expensesRouter);
router.use('/logs', logsRouter);
router.use('/admin', adminRouter);

export { router as apiRouter };
