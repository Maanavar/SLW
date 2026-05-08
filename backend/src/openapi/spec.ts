import type {
  OpenAPIObject,
  SchemaObject,
  SecurityRequirementObject,
  SecuritySchemeObject,
} from 'openapi3-ts/oas30';
import {
  CUSTOMER_TYPES,
  EXPENSE_CATEGORIES,
  PAYMENT_MODES,
  PAYMENT_STATUSES,
  WORK_MODES,
} from '../domain/constants';

const securitySchemes: Record<string, SecuritySchemeObject> = {
  cookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'slw_session',
  },
};

const security: SecurityRequirementObject[] = [{ cookieAuth: [] }];

const errorSchema: SchemaObject = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: { type: 'object' },
    correlationId: { type: 'string' },
  },
  required: ['error'],
};

export const openApiSpec: OpenAPIObject = {
  openapi: '3.0.3',
  info: {
    title: 'Siva Lathe Works API',
    version: '1.0.0',
    description:
      'REST API for the SLW business management system — jobs, payments, commission, expenses, and customers.',
  },
  servers: [{ url: '/api', description: 'Current server' }],
  components: {
    securitySchemes,
    schemas: {
      Error: errorSchema,
      CustomerType: { type: 'string', enum: [...CUSTOMER_TYPES] },
      PaymentMode: { type: 'string', enum: [...PAYMENT_MODES] },
      PaymentStatus: { type: 'string', enum: [...PAYMENT_STATUSES] },
      WorkMode: { type: 'string', enum: [...WORK_MODES] },
      ExpenseCategory: { type: 'string', enum: [...EXPENSE_CATEGORIES] },
      Customer: {
        type: 'object',
        required: ['id', 'name', 'shortCode', 'type', 'hasCommission', 'requiresDc', 'isActive'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string', maxLength: 120 },
          shortCode: { type: 'string', maxLength: 20 },
          type: { $ref: '#/components/schemas/CustomerType' },
          hasCommission: { type: 'boolean' },
          requiresDc: { type: 'boolean' },
          hasBillNo: { type: 'boolean' },
          advanceBalance: { type: 'number' },
          openingBalance: { type: 'number' },
          invoiceGroup: { type: 'string', enum: ['rmp', 'ww', 'nm'], nullable: true },
          notes: { type: 'string' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      WorkType: {
        type: 'object',
        required: ['id', 'category', 'name', 'shortCode', 'defaultUnit', 'defaultRate'],
        properties: {
          id: { type: 'integer' },
          category: { type: 'string', maxLength: 60 },
          name: { type: 'string', maxLength: 120 },
          shortCode: { type: 'string', maxLength: 20 },
          defaultUnit: { type: 'string', maxLength: 30 },
          defaultRate: { type: 'number' },
          isActive: { type: 'boolean' },
        },
      },
      Job: {
        type: 'object',
        required: ['id', 'customerId', 'workTypeName', 'quantity', 'amount', 'commissionAmount', 'date'],
        properties: {
          id: { type: 'integer' },
          customerId: { type: 'integer' },
          workTypeName: { type: 'string' },
          workName: { type: 'string', nullable: true },
          quantity: { type: 'number' },
          amount: { type: 'number' },
          commissionAmount: { type: 'number' },
          commissionWorkerId: { type: 'integer', nullable: true },
          commissionWorkerName: { type: 'string', nullable: true },
          netAmount: { type: 'number', nullable: true },
          date: { type: 'string', format: 'date' },
          paymentStatus: { $ref: '#/components/schemas/PaymentStatus', nullable: true },
          paymentMode: { type: 'string', nullable: true },
          paidAmount: { type: 'number', nullable: true },
          workMode: { $ref: '#/components/schemas/WorkMode', nullable: true },
          isSpotWork: { type: 'boolean' },
          jobCardId: { type: 'string', nullable: true },
          jobCardLine: { type: 'integer', nullable: true },
          billNo: { type: 'string', nullable: true },
          dcNo: { type: 'string', nullable: true },
          vehicleNo: { type: 'string', nullable: true },
          dcDate: { type: 'string', format: 'date', nullable: true },
          dcApproval: { type: 'boolean', nullable: true },
          rmpHandler: { type: 'string', enum: ['Bhai', 'Raja'], nullable: true },
          jobFlowType: { type: 'string', enum: ['slw_work', 'agent_work'], nullable: true },
          externalDc: { type: 'boolean', nullable: true },
          agentName: { type: 'string', nullable: true },
          agentCommissionAmount: { type: 'number', nullable: true },
          agentTdsAmount: { type: 'number', nullable: true },
          agentSettlementPaidAmount: { type: 'number', nullable: true },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Payment: {
        type: 'object',
        required: ['id', 'customerId', 'amount', 'date', 'paymentMode'],
        properties: {
          id: { type: 'integer' },
          customerId: { type: 'integer' },
          amount: { type: 'number' },
          date: { type: 'string', format: 'date' },
          paymentMode: { $ref: '#/components/schemas/PaymentMode' },
          breakdown: {
            type: 'object',
            properties: {
              cash: { type: 'number' },
              upi: { type: 'number' },
              bank: { type: 'number' },
              cheque: { type: 'number' },
            },
            nullable: true,
          },
          referenceNumber: { type: 'string', nullable: true },
          paymentForMonth: { type: 'string', nullable: true },
          paymentForDate: { type: 'string', format: 'date', nullable: true },
          paymentForFromDate: { type: 'string', format: 'date', nullable: true },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Expense: {
        type: 'object',
        required: ['id', 'category', 'description', 'amount', 'date', 'isRecurring'],
        properties: {
          id: { type: 'integer' },
          category: { $ref: '#/components/schemas/ExpenseCategory' },
          description: { type: 'string', maxLength: 255 },
          amount: { type: 'number' },
          date: { type: 'string', format: 'date' },
          isRecurring: { type: 'boolean' },
          recurringDay: { type: 'integer', minimum: 1, maximum: 28, nullable: true },
          notes: { type: 'string', nullable: true },
        },
      },
      CommissionWorker: {
        type: 'object',
        required: ['id', 'customerId', 'name', 'shareType', 'shareValue', 'isActive'],
        properties: {
          id: { type: 'integer' },
          customerId: { type: 'integer' },
          name: { type: 'string', maxLength: 120 },
          shareType: { type: 'string', enum: ['percentage', 'fixed'] },
          shareValue: { type: 'number' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CommissionPayment: {
        type: 'object',
        required: ['id', 'workerId', 'workerName', 'customerId', 'jobIds', 'amount', 'date'],
        properties: {
          id: { type: 'integer' },
          workerId: { type: 'integer' },
          workerName: { type: 'string' },
          customerId: { type: 'integer' },
          jobIds: { type: 'array', items: { type: 'integer' } },
          amount: { type: 'number' },
          date: { type: 'string', format: 'date' },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PaginatedJobs: {
        type: 'object',
        required: ['total', 'limit', 'offset', 'items'],
        properties: {
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          items: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: {
          200: { description: 'Service is healthy' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: { type: 'string' },
                  name: { type: 'string', maxLength: 80 },
                  email: { type: 'string', format: 'email', maxLength: 160 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    expiresAt: { type: 'string', format: 'date-time' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', nullable: true },
                        name: { type: 'string' },
                        role: { type: 'string', enum: ['admin'] },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limit exceeded' },
        },
      },
    },
    '/auth/session': {
      get: {
        tags: ['Auth'],
        summary: 'Validate current session',
        security,
        responses: {
          200: { description: 'Session valid' },
          401: { description: 'Not authenticated' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout',
        security,
        responses: { 204: { description: 'Logged out' } },
      },
    },
    '/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List all customers',
        security,
        responses: {
          200: {
            description: 'Customer list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Customer' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create a customer',
        security,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
            },
          },
        },
      },
    },
    '/customers/{id}': {
      put: {
        tags: ['Customers'],
        summary: 'Update a customer',
        security,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
          },
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
            },
          },
        },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete a customer',
        security,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/jobs': {
      get: {
        tags: ['Jobs'],
        summary: 'List jobs (date-windowed)',
        security,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'customerId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'Job list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Jobs'],
        summary: 'Create a job',
        security,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Job' } },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Job' } },
            },
          },
        },
      },
    },
    '/jobs/page': {
      get: {
        tags: ['Jobs'],
        summary: 'Paginated jobs (for history load-more)',
        security,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'customerId', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'Paginated job list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PaginatedJobs' } },
            },
          },
        },
      },
    },
    '/jobs/{id}': {
      put: {
        tags: ['Jobs'],
        summary: 'Update a job',
        security,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Job' } },
          },
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Job' } },
            },
          },
        },
      },
      delete: {
        tags: ['Jobs'],
        summary: 'Delete a job',
        security,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List payments',
        security,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'customerId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'Payment list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Payment' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Payments'],
        summary: 'Record a payment',
        security,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Payment' } },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Payment' } },
            },
          },
        },
      },
    },
    '/expenses': {
      get: {
        tags: ['Expenses'],
        summary: 'List expenses',
        security,
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'category', in: 'query', schema: { $ref: '#/components/schemas/ExpenseCategory' } },
          { name: 'isRecurring', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: {
            description: 'Expense list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Expense' } },
              },
            },
          },
        },
      },
      post: {
        tags: ['Expenses'],
        summary: 'Create an expense',
        security,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Expense' } },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Expense' } },
            },
          },
        },
      },
    },
    '/commission-workers': {
      get: {
        tags: ['Commission'],
        summary: 'List commission workers',
        security,
        responses: {
          200: {
            description: 'Commission worker list',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/CommissionWorker' } },
              },
            },
          },
        },
      },
    },
    '/commission-payments': {
      get: {
        tags: ['Commission'],
        summary: 'List commission payments',
        security,
        responses: {
          200: {
            description: 'Commission payment list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CommissionPayment' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Commission'],
        summary: 'Record a commission payment',
        security,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CommissionPayment' } },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/CommissionPayment' } },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Customers' },
    { name: 'Jobs' },
    { name: 'Payments' },
    { name: 'Expenses' },
    { name: 'Commission' },
  ],
};
