export type UserRole = 'admin' | 'recepcion' | 'tecnico';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  workshopId: string;
  /** Nombre del taller (workshops.name). Solo lo completa AuthService al cargar el perfil propio;
   * se usa para no harcodear "Zentrofix" en mensajes de WhatsApp y comprobantes. */
  workshopName?: string;
  createdAt: string;
  updatedAt: string;
}
