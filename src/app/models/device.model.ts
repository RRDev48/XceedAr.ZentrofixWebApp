export type DeviceType = 'celular' | 'tablet' | 'notebook' | 'consola' | 'otro';

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  celular: 'Celular',
  tablet: 'Tablet',
  notebook: 'Notebook',
  consola: 'Consola',
  otro: 'Otro',
};

/** Marcas sugeridas por tipo de equipo, para autocompletar el campo "Marca" sin
 * dejar de aceptar cualquier otra que no esté en la lista (input + datalist, no un select). */
export const DEVICE_TYPE_BRANDS: Record<DeviceType, string[]> = {
  celular: ['Samsung', 'Apple', 'Motorola', 'Xiaomi', 'Huawei', 'LG', 'Nokia', 'Oppo', 'ZTE', 'Alcatel'],
  tablet: ['Samsung', 'Apple', 'Lenovo', 'Huawei', 'Amazon', 'Xiaomi'],
  notebook: ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Apple', 'Samsung', 'MSI'],
  consola: ['Sony', 'Microsoft', 'Nintendo'],
  otro: [],
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
