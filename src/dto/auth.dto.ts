import { z } from 'zod';
const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const password = z.string().min(8).max(128);
const fullName = z.string().trim().min(1).max(150);
const phone = z.string().trim().max(30);
export const registerInput = z.strictObject({ email, password, fullName, phone: phone.optional() });
export const staffInput = z.strictObject({ email, password, fullName });
export const loginInput = z.strictObject({ email, password });
export const profileInput = z.strictObject({
  fullName: fullName.optional(),
  phone: phone.optional(),
});
export const passwordInput = z.strictObject({ currentPassword: password, newPassword: password });
export const statusInput = z.strictObject({ active: z.boolean() });
export const paginationInput = z.strictObject({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type RegisterInput = z.infer<typeof registerInput>;
