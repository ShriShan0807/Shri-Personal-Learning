import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const productCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  codePrefix: z
    .string()
    .regex(/^[A-Z0-9]{2,16}$/, "Prefix must be 2-16 uppercase letters/digits."),
  defaultWarehouseId: z.string().optional().nullable(),
});

export const productUpdateSchema = productCreateSchema.partial().omit({ codePrefix: true });

export const labelBatchSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1).max(5000),
});

export const scanSchema = z.object({
  mode: z.enum(["ENTRY", "EXIT"]),
  storeId: z.string().optional().nullable(),
});

export const userInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional().nullable(),
  role: z.enum(["admin", "owner", "manager", "staff"]),
  warehouseId: z.string().optional().nullable(),
  password: z.string().min(6).max(100),
});

export const userUpdateSchema = z.object({
  role: z.enum(["admin", "owner", "manager", "staff"]).optional(),
  isActive: z.boolean().optional(),
  warehouseId: z.string().optional().nullable(),
  name: z.string().max(120).optional().nullable(),
});

export const warehouseSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional().nullable(),
});

export const storeSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional().nullable(),
});
