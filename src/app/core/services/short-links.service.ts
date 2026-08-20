import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AuthService } from '../auth/auth.service';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function randomCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

@Injectable({ providedIn: 'root' })
export class ShortLinksService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auth: AuthService,
  ) {}

  /** Crea un enlace corto propio (gestor-zentrofix.vercel.app/s/xxxxxxxx) para compartir por WhatsApp. */
  async create(targetUrl: string, title: string, repairOrderId: string, expiresInSeconds: number): Promise<string> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = randomCode();
      const { error } = await this.supabase.client.from('short_links').insert({
        code,
        target_url: targetUrl,
        title,
        repair_order_id: repairOrderId,
        created_by: this.auth.session()?.user.id ?? null,
        expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      });
      if (!error) {
        return `${window.location.origin}/s/${code}`;
      }
      if (error.code !== '23505') {
        throw new Error(error.message);
      }
    }
    throw new Error('No se pudo generar un enlace corto.');
  }

  /**
   * Reutiliza el enlace corto ya creado para esta orden y este título (por ejemplo, el
   * comprobante digital), actualizando su destino y vencimiento, en vez de acumular un
   * enlace nuevo cada vez que se comparte de nuevo.
   */
  async upsertForOrder(
    repairOrderId: string,
    title: string,
    targetUrl: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const { data: existingRows, error: existingError } = await this.supabase.client
      .from('short_links')
      .select('code')
      .eq('repair_order_id', repairOrderId)
      .eq('title', title)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existingError) {
      throw new Error(existingError.message);
    }
    const existing = existingRows?.[0] as { code: string } | undefined;

    if (existing) {
      const { error } = await this.supabase.client
        .from('short_links')
        .update({ target_url: targetUrl, expires_at: expiresAt })
        .eq('code', existing.code);
      if (error) {
        throw new Error(error.message);
      }
      return `${window.location.origin}/s/${existing.code}`;
    }

    return this.create(targetUrl, title, repairOrderId, expiresInSeconds);
  }
}
