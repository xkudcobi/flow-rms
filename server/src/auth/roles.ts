import { SetMetadata } from '@nestjs/common';

// Sistemdeki roller. Yetki kontrolü bu sabitler üzerinden yapılır.
export const ROLES = {
  PATRON: 'PATRON',
  MUDUR: 'MUDUR',
  KASIYER: 'KASIYER',
  GARSON: 'GARSON',
  MUTFAK: 'MUTFAK',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

export const ROLES_KEY = 'roles';

// Controller/handler üzerinde izinli rolleri işaretlemek için: @Roles('MUDUR','PATRON')
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
