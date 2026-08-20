import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Device, DeviceFormValue, DeviceType } from '../../models';

interface DeviceRow {
  id: string;
  customer_id: string;
  device_type: DeviceType;
  brand: string;
  model: string;
  color: string | null;
  imei_or_serial: string | null;
  access_detail: string | null;
  accessories: string | null;
  physical_condition_in: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    customerId: row.customer_id,
    deviceType: row.device_type,
    brand: row.brand,
    model: row.model,
    color: row.color,
    imeiOrSerial: row.imei_or_serial,
    accessDetail: row.access_detail,
    accessories: row.accessories,
    physicalConditionIn: row.physical_condition_in,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toRow(value: DeviceFormValue) {
  return {
    customer_id: value.customerId,
    device_type: value.deviceType,
    brand: value.brand.trim(),
    model: value.model.trim(),
    color: value.color?.trim() || null,
    imei_or_serial: value.imeiOrSerial?.trim() || null,
    access_detail: value.accessDetail?.trim() || null,
    accessories: value.accessories?.trim() || null,
    physical_condition_in: value.physicalConditionIn?.trim() || null,
    notes: value.notes?.trim() || null,
  };
}

@Injectable({ providedIn: 'root' })
export class DevicesService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listByCustomer(customerId: string): Promise<Device[]> {
    const { data, error } = await this.supabase.client
      .from('devices')
      .select('*')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as DeviceRow[]).map(mapDevice);
  }

  async getById(id: string): Promise<Device | null> {
    const { data, error } = await this.supabase.client.from('devices').select('*').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapDevice(data as DeviceRow) : null;
  }

  async create(value: DeviceFormValue): Promise<Device> {
    const { data, error } = await this.supabase.client.from('devices').insert(toRow(value)).select('*').single();
    if (error) {
      throw new Error(error.message);
    }
    return mapDevice(data as DeviceRow);
  }

  async update(id: string, value: DeviceFormValue): Promise<Device> {
    const { data, error } = await this.supabase.client
      .from('devices')
      .update(toRow(value))
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapDevice(data as DeviceRow);
  }
}
