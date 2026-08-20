import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Warranty } from '../../models';

interface WarrantyRow {
  id: string;
  repair_order_id: string;
  coverage_details: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function mapWarranty(row: WarrantyRow): Warranty {
  return {
    id: row.id,
    repairOrderId: row.repair_order_id,
    coverageDetails: row.coverage_details,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class WarrantiesService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async getByOrder(repairOrderId: string): Promise<Warranty | null> {
    const { data, error } = await this.supabase.client
      .from('warranties')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapWarranty(data as WarrantyRow) : null;
  }

  async create(repairOrderId: string, coverageDetails: string, durationDays: number): Promise<Warranty> {
    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const { data, error } = await this.supabase.client
      .from('warranties')
      .insert({
        repair_order_id: repairOrderId,
        coverage_details: coverageDetails,
        starts_at: startsAt.toISOString().slice(0, 10),
        expires_at: expiresAt.toISOString().slice(0, 10),
        active: true,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapWarranty(data as WarrantyRow);
  }
}
