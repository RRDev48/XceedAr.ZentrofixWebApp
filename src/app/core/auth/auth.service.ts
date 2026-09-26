import { Injectable, computed, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseClientService } from '../services/supabase-client.service';
import { Profile, UserRole } from '../../models';

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  workshop_id: string;
  workshops: { name: string } | null;
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
    workshopId: row.workshop_id,
    workshopName: row.workshops?.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<Session | null>(null);
  private readonly profileSignal = signal<Profile | null>(null);
  private readonly readySignal = signal(false);

  readonly session = this.sessionSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  constructor(private readonly supabase: SupabaseClientService) {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.sessionSignal.set(data.session);
      if (data.session) {
        this.loadProfile(data.session.user.id);
      }
      this.readySignal.set(true);
    });

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.sessionSignal.set(session);
      if (session) {
        this.loadProfile(session.user.id);
      } else {
        this.profileSignal.set(null);
      }
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('id, full_name, email, role, active, workshop_id, workshops(name), created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      this.profileSignal.set(mapProfile(data as unknown as ProfileRow));
    }
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: this.translateError(error.message) };
    }
    return { error: null };
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  async requestPasswordReset(email: string): Promise<{ error: string | null }> {
    const redirectTo = `${window.location.origin}/auth/restablecer-contrasena`;
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      return { error: this.translateError(error.message) };
    }
    return { error: null };
  }

  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.client.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: this.translateError(error.message) };
    }
    return { error: null };
  }

  private translateError(message: string): string {
    const map: Record<string, string> = {
      'Invalid login credentials': 'Correo electrónico o contraseña incorrectos.',
      'Email not confirmed': 'Debés confirmar tu correo electrónico antes de ingresar.',
      'User already registered': 'Ya existe un usuario registrado con ese correo.',
      'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
    };
    return map[message] ?? 'Ocurrió un error. Intentá nuevamente.';
  }
}
