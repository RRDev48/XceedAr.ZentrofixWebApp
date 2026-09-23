import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string | null;
  action: string;
  changedByName: string;
  changedAt: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  tableName?: string;
  limit?: number;
}

interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  changed_by: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

interface ProfileNameRow {
  id: string;
  full_name: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogsService {
  constructor(private readonly supabase: SupabaseClientService) {}

  async listRecent(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    let query = this.supabase.client
      .from('audit_logs')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(filters.limit ?? 100);

    if (filters.tableName) {
      query = query.eq('table_name', filters.tableName);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data ?? []) as AuditLogRow[];
    if (!rows.length) {
      return [];
    }

    const profileIds = [...new Set(rows.map((r) => r.changed_by).filter((id): id is string => Boolean(id)))];
    let namesById = new Map<string, string>();
    if (profileIds.length) {
      const { data: profiles, error: profilesError } = await this.supabase.client
        .from('profiles')
        .select('id, full_name')
        .in('id', profileIds);
      if (profilesError) {
        throw new Error(profilesError.message);
      }
      namesById = new Map((profiles as ProfileNameRow[] | null ?? []).map((p) => [p.id, p.full_name]));
    }

    return rows.map((r) => ({
      id: r.id,
      tableName: r.table_name,
      recordId: r.record_id,
      action: r.action,
      changedByName: r.changed_by ? namesById.get(r.changed_by) ?? 'Usuario eliminado' : 'Sistema',
      changedAt: r.changed_at,
      oldData: r.old_data,
      newData: r.new_data,
    }));
  }
}
