import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Profile, UserRole } from '../../models';

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class ProfilesService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async list(): Promise<Profile[]> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return (data as ProfileRow[]).map(mapProfile);
  }

  async updateRoleAndActive(id: string, role: UserRole, active: boolean): Promise<Profile> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .update({ role, active })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapProfile(data as ProfileRow);
  }
}
