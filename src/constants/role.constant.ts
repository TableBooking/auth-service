export const ROLE = { CUSTOMER: 'CUSTOMER', STAFF: 'STAFF', MANAGER: 'MANAGER' } as const;
export const USER_ROLES = [ROLE.CUSTOMER, ROLE.STAFF, ROLE.MANAGER] as const;
export type Role = (typeof USER_ROLES)[number];
