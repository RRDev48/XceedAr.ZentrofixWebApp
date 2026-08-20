export type UserRole = 'admin' | 'recepcion' | 'tecnico';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
