import { z } from 'zod';

export const jobLineSchema = z.object({
  workType: z
    .object({ id: z.number(), name: z.string() })
    .nullable()
    .refine((v) => v !== null, { message: 'Work type is required' }),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(9999, 'Quantity too large'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: 'Amount must be greater than 0' }),
  commission: z
    .string()
    .optional()
    .refine((v) => v === undefined || v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), {
      message: 'Commission must be 0 or greater',
    }),
});

export const jobFormSchema = z.object({
  customerId: z.number().int().positive('Customer is required'),
  date: z.string().min(1, 'Date is required').refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  lines: z.array(jobLineSchema).min(1, 'At least one job line is required'),
});

export const paymentSchema = z.object({
  customerId: z.number().int().positive('Customer is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  date: z
    .string()
    .min(1, 'Date is required')
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' })
    .refine((v) => v <= new Date().toISOString().slice(0, 10), { message: 'Future dates are not allowed' }),
  paymentMode: z.enum(['Cash', 'UPI', 'Bank', 'Cheque', 'Mixed']),
  notes: z.string().max(500, 'Notes must be under 500 characters').optional(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;
export type PaymentValues = z.infer<typeof paymentSchema>;

export function parseZodErrors(
  result: ReturnType<(typeof paymentSchema | typeof jobFormSchema)['safeParse']>
): Record<string, string> {
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message])
  );
}
