export const openApiDocument = {
  openapi: '3.0.3',
  info: { title: 'OpsFlow API', version: '1.0.0', description: 'Operations ERP API. Authenticate with a JWT bearer token returned by /api/auth/login.' },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } },
      Transfer: { type: 'object', required: ['code', 'sourceLocationId', 'destinationLocationId', 'itemId', 'quantity'], properties: { code: { type: 'string' }, sourceLocationId: { type: 'string' }, destinationLocationId: { type: 'string' }, itemId: { type: 'string' }, batch: { type: 'string', default: 'GENERAL' }, quantity: { type: 'number', minimum: 0.001 } } },
      Order: { type: 'object', required: ['code', 'customerId', 'locationId', 'items'], properties: { code: { type: 'string' }, customerId: { type: 'string' }, locationId: { type: 'string' }, items: { type: 'array', items: { type: 'object', required: ['itemId', 'quantity'], properties: { itemId: { type: 'string' }, batch: { type: 'string' }, quantity: { type: 'number', minimum: 0.001 } } } } } },
    },
  },
  paths: {
    '/auth/login': { post: { tags: ['Authentication'], summary: 'Log in and receive a bearer token', requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/Login' } } } }, responses: { '200': { description: 'Authenticated' }, '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } } } } },
    '/inventory': { get: { tags: ['Inventory'], security: [{ bearerAuth: [] }], summary: 'List inventory' }, post: { tags: ['Inventory'], security: [{ bearerAuth: [] }], summary: 'Stock in inventory (Admin or Operations)' } },
    '/work-orders': { get: { tags: ['Work Orders'], security: [{ bearerAuth: [] }], summary: 'List work orders with current material shortages' }, post: { tags: ['Work Orders'], security: [{ bearerAuth: [] }], summary: 'Create work order (Admin)' } },
    '/transfers': { get: { tags: ['Transfers'], security: [{ bearerAuth: [] }], summary: 'List transfers' }, post: { tags: ['Transfers'], security: [{ bearerAuth: [] }], summary: 'Request transfer (Admin or Operations)', requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/Transfer' } } } } } },
    '/transfers/{id}/dispatch': { post: { tags: ['Transfers'], security: [{ bearerAuth: [] }], summary: 'Dispatch requested transfer. Atomically removes source stock.' } },
    '/transfers/{id}/receive': { post: { tags: ['Transfers'], security: [{ bearerAuth: [] }], summary: 'Receive dispatched transfer. Atomically adds destination stock once.' } },
    '/orders': { get: { tags: ['Customer Orders'], security: [{ bearerAuth: [] }], summary: 'List customer orders' }, post: { tags: ['Customer Orders'], security: [{ bearerAuth: [] }], summary: 'Create customer order (Sales)', requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/Order' } } } } } },
    '/orders/{id}/reserve': { post: { tags: ['Customer Orders'], security: [{ bearerAuth: [] }], summary: 'Reserve all order lines atomically (Sales). Returns 409 INSUFFICIENT_STOCK if unavailable.' } },
  },
};
