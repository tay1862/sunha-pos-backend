import { z } from 'zod';

export const moneySchema = z.object({
  amount: z.string().regex(/^-?\d+$/, 'Money amount must be an integer string'),
  currency: z.literal('LAK'),
});

export const quantitySchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,3})?$/, 'Quantity must be a non-negative decimal with up to 3 digits');

export const itemUnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  multiplierToBase: quantitySchema,
  price: moneySchema,
  sku: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
});

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  correlationId: z.string().min(1).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const apiEnvelopeSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({ data: dataSchema, meta: z.record(z.string(), z.unknown()).optional() });

export const apiErrorEnvelopeSchema = z.object({ error: apiErrorSchema });

export type Money = z.infer<typeof moneySchema>;
export type Quantity = z.infer<typeof quantitySchema>;
export type ItemUnit = z.infer<typeof itemUnitSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;

export const idSchema = z.string().uuid();
export const currencySchema = z.literal('LAK');

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  businessName: z.string().trim().min(1).max(120),
  country: z.literal('LA'),
  deviceName: z.string().trim().min(1).max(120).optional(),
  publicKey: z.string().max(4096).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const refreshTokenSchema = z.object({ refreshToken: z.string().min(20).max(512) });
export const authTokenSchema = z.object({ token: z.string().min(20).max(512) });
export const passwordResetRequestSchema = z.object({ email: z.string().email() });
export const passwordResetSchema = z.object({
  token: z.string().min(20).max(512),
  password: z.string().min(12).max(128),
});

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).default(''),
  phone: z.string().trim().max(40).default(''),
  taxNumber: z.string().trim().max(80).default(''),
  currency: currencySchema.default('LAK'),
  timezone: z.string().default('Asia/Vientiane'),
  language: z.enum(['lo', 'en']).default('lo'),
});

export const updateStoreSettingsSchema = storeSettingsSchema.partial().extend({
  currency: currencySchema.optional(),
  timezone: z.string().min(1).max(64).optional(),
  language: z.enum(['lo', 'en']).optional(),
});

export const employeeRoleSchema = z.enum(['OWNER', 'MANAGER', 'CASHIER']);
export const permissionSchema = z.enum([
  'SELL',
  'VIEW_RECEIPTS',
  'APPLY_DISCOUNT',
  'REFUND',
  'MANAGE_ITEMS',
  'MANAGE_STOCK',
  'MANAGE_EMPLOYEES',
  'MANAGE_SETTINGS',
  'VIEW_REPORTS',
  'MANAGE_DEVICES',
]);

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: employeeRoleSchema.exclude(['OWNER']),
  pin: z.string().regex(/^\d{6}$/, 'PIN must contain exactly 6 digits'),
});
export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: employeeRoleSchema.exclude(['OWNER']).optional(),
  pin: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  active: z.boolean().optional(),
});
export const verifyEmployeePinSchema = z.object({
  employeeId: idSchema,
  pin: z.string().regex(/^\d{6}$/),
});
export const createDeviceInvitationSchema = z.object({
  deviceName: z.string().trim().min(1).max(120),
});
export const enrollDeviceSchema = z.object({
  token: z.string().min(20).max(512),
  deviceName: z.string().trim().min(1).max(120).optional(),
  publicKey: z.string().max(4096).optional(),
});

export const itemUnitInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  multiplierToBase: quantitySchema,
  price: moneySchema,
  sku: z.string().trim().max(80).optional(),
  barcode: z.string().trim().max(80).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#0284C7'),
});

export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: idSchema.optional(),
  cost: moneySchema.optional(),
  trackStock: z.boolean().default(false),
  imageUrl: z.string().url().max(500).optional(),
  baseUnitName: z.string().trim().min(1).max(40),
  units: z.array(itemUnitInputSchema).min(1).max(20),
});

export const updateItemSchema = createItemSchema.partial().extend({
  units: z.array(itemUnitInputSchema.extend({ id: idSchema.optional() })).min(1).max(20).optional(),
});
export const updateCategorySchema = createCategorySchema.partial();

export const inventoryAdjustmentSchema = z.object({
  itemId: idSchema,
  quantityBase: z.string().regex(/^-?\d+(?:\.\d{1,3})?$/),
  reason: z.string().trim().min(1).max(300),
  managerEmployeeId: idSchema,
  managerPin: z.string().regex(/^\d{6}$/),
});

export const modifierOptionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  priceDelta: moneySchema,
});

export const createModifierGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0).max(20).default(0),
  maxSelections: z.number().int().min(1).max(20).default(1),
  options: z.array(modifierOptionSchema).min(1).max(50),
});
export const updateModifierGroupSchema = createModifierGroupSchema.partial().extend({
  options: z.array(modifierOptionSchema.extend({ id: idSchema.optional() })).min(1).max(50).optional(),
});
export const assignModifierGroupSchema = z.object({ groupId: idSchema });

export const paymentTypeSchema = z.enum([
  'CASH',
  'MANUAL_QR',
  'BANK_TRANSFER',
  'CARD_MANUAL',
  'OTHER',
]);
export const discountInputSchema = z.union([
  z.object({ type: z.literal('FIXED'), amount: z.string().regex(/^\d+$/) }),
  z.object({ type: z.literal('PERCENTAGE'), basisPoints: z.number().int().min(0).max(10_000) }),
]);

export const orderLineInputSchema = z.object({
  itemId: idSchema,
  unitId: idSchema,
  quantity: quantitySchema,
  modifierOptionIds: z.array(idSchema).max(50).default([]),
  note: z.string().trim().max(300).default(''),
});

export const checkoutOrderSchema = z.object({
  clientOrderId: idSchema,
  lines: z.array(orderLineInputSchema).min(1).max(500),
  discount: discountInputSchema.optional(),
  paymentType: paymentTypeSchema,
  tenderedAmount: moneySchema.optional(),
  paymentReference: z.string().trim().max(160).optional(),
  taxRateBasisPoints: z.number().int().min(0).max(10_000).default(0),
  offline: z.boolean().default(false),
});

export const createTaxSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rateBasisPoints: z.number().int().min(0).max(10_000),
  mode: z.enum(['INCLUSIVE', 'EXCLUSIVE']),
});
export const updateTaxSchema = createTaxSchema.partial();

export const openShiftSchema = z.object({ openingAmount: z.string().regex(/^\d+$/) });
export const cashMovementSchema = z.object({
  amount: z.string().regex(/^-?\d+$/),
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  reason: z.string().trim().min(1).max(300),
});
export const closeShiftSchema = z.object({ closingAmount: z.string().regex(/^\d+$/) });
export const refundSchema = z.object({
  orderId: idSchema,
  managerEmployeeId: idSchema,
  managerPin: z.string().regex(/^\d{6}$/),
  reason: z.string().trim().min(1).max(300),
});

export const syncOperationSchema = z.object({
  operationId: idSchema,
  type: z.enum(['CHECKOUT_ORDER', 'OPEN_SHIFT', 'CLOSE_SHIFT', 'CASH_MOVEMENT']),
  occurredAtDevice: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export const syncPushSchema = z.object({
  deviceId: idSchema,
  employeeId: idSchema,
  operations: z.array(syncOperationSchema).min(1).max(100),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type AuthTokenInput = z.infer<typeof authTokenSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type StoreSettings = z.infer<typeof storeSettingsSchema>;
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type VerifyEmployeePinInput = z.infer<typeof verifyEmployeePinSchema>;
export type CreateDeviceInvitationInput = z.infer<typeof createDeviceInvitationSchema>;
export type EnrollDeviceInput = z.infer<typeof enrollDeviceSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>;
export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupSchema>;
export type AssignModifierGroupInput = z.infer<typeof assignModifierGroupSchema>;
export type CheckoutOrderInput = z.infer<typeof checkoutOrderSchema>;
export type CreateTaxInput = z.infer<typeof createTaxSchema>;
export type UpdateTaxInput = z.infer<typeof updateTaxSchema>;
export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type SyncPushInput = z.infer<typeof syncPushSchema>;
