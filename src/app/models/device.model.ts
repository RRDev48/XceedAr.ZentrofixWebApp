export type DeviceType = 'celular' | 'tablet' | 'notebook' | 'consola' | 'otro';

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  celular: 'Celular',
  tablet: 'Tablet',
  notebook: 'Notebook',
  consola: 'Consola',
  otro: 'Otro',
};

export interface Device {
  id: string;
  customerId: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  color: string | null;
  imeiOrSerial: string | null;
  accessDetail: string | null;
  accessories: string | null;
  physicalConditionIn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DeviceFormValue {
  customerId: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  color: string | null;
  imeiOrSerial: string | null;
  accessDetail: string | null;
  accessories: string | null;
  physicalConditionIn: string | null;
  notes: string | null;
}
