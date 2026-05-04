import { Timestamp } from 'firebase-admin/firestore';

export type UserRole = 'admin' | 'manager' | 'employee';

export interface CompanyUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  companyId: string;
  role: UserRole;
  department?: string;
  jobTitle?: string;
  phoneNumber?: string;
  isActive: boolean;
  lastLoginAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}
