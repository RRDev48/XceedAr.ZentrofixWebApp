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
}
