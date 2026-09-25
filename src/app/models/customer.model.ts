export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  whatsappPhone: string;
  dni: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Fecha de la última orden de reparación (received_at), si tiene alguna. Solo lo completan listPage()/listWithLastOrder(). */
  lastOrderAt?: string | null;
}

export interface CustomerFormValue {
  firstName: string;
  lastName: string;
  whatsappPhone: string;
  dni: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface CustomerMatch {
  id: string;
  firstName: string;
  lastName: string;
  whatsappPhone: string;
  dni: string | null;
}
