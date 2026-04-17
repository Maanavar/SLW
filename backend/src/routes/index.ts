import { Router } from 'express';
import { healthRouter } from './health';
import { authRouter } from './auth';
import { customersRouter } from './customers';
import { workTypesRouter } from './workTypes';
import { jobsRouter } from './jobs';
import { paymentsRouter } from './payments';
import { expensesRouter } from './expenses';
import { logsRouter } from './logs';
import { adminRouter } from './admin';
import { commissionWorkersRouter } from './commissionWorkers';
import { commissionPaymentsRouter } from './commissionPayments';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use(requireAuth);
router.use('/customers', customersRouter);
router.use('/work-types', workTypesRouter);
router.use('/jobs', jobsRouter);
router.use('/payments', paymentsRouter);
router.use('/expenses', expensesRouter);
router.use('/commission-workers', commissionWorkersRouter);
router.use('/commission-payments', commissionPaymentsRouter);
router.use('/logs', logsRouter);
router.use('/admin', adminRouter);

export { router as apiRouter };
