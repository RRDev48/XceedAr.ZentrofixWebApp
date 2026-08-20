import { Injectable } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AuthService } from '../auth/auth.service';
import { Attachment, AttachmentCategory } from '../../models';

const BUCKET = 'attachments';

interface AttachmentRow {
  id: string;
  repair_order_id: string | null;
  bucket: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  category: AttachmentCategory | null;
  uploaded_by: string | null;
  created_at: string;
}

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    repairOrderId: row.repair_order_id,
    bucket: row.bucket,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    category: row.category,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  constructor(
    private readonly supabase: SupabaseClientService,
    private readonly auth: AuthService,
  ) {}

  async listByOrder(repairOrderId: string): Promise<Attachment[]> {
    const { data, error } = await this.supabase.client
      .from('attachments')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data as AttachmentRow[]).map(mapAttachment);
  }

  async upload(repairOrderId: string, file: File, category: AttachmentCategory): Promise<Attachment> {
    const path = `${repairOrderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await this.supabase.client.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data, error } = await this.supabase.client
      .from('attachments')
      .insert({
        repair_order_id: repairOrderId,
        bucket: BUCKET,
        storage_path: path,
        file_name: file.name,
        content_type: file.type || null,
        size_bytes: file.size,
        category,
        uploaded_by: this.auth.session()?.user.id ?? null,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapAttachment(data as AttachmentRow);
  }

  async uploadBlob(
    repairOrderId: string,
    blob: Blob,
    fileName: string,
    category: AttachmentCategory,
  ): Promise<Attachment> {
    const file = new File([blob], fileName, { type: blob.type });
    return this.upload(repairOrderId, file, category);
  }

  /**
   * Genera o reemplaza el adjunto de una categoría para una orden (por ejemplo, el
   * comprobante digital). Si ya existe uno, se sobrescribe el mismo archivo en Storage
   * y se actualiza su fila en vez de acumular copias nuevas cada vez que se regenera.
   */
  async upsertForOrder(
    repairOrderId: string,
    blob: Blob,
    fileName: string,
    category: AttachmentCategory,
  ): Promise<Attachment> {
    const { data: existingRows, error: existingError } = await this.supabase.client
      .from('attachments')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existingError) {
      throw new Error(existingError.message);
    }
    const existing = (existingRows as AttachmentRow[] | null)?.[0];

    if (!existing) {
      return this.uploadBlob(repairOrderId, blob, fileName, category);
    }

    const file = new File([blob], fileName, { type: blob.type });
    const { error: uploadError } = await this.supabase.client.storage
      .from(BUCKET)
      .upload(existing.storage_path, file, { contentType: file.type || undefined, upsert: true });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data, error } = await this.supabase.client
      .from('attachments')
      .update({ file_name: fileName, content_type: file.type || null, size_bytes: file.size })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapAttachment(data as AttachmentRow);
  }

  /** URL temporal para ver/descargar un adjunto de un bucket privado (por defecto, 1 hora). */
  async getSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error) {
      throw new Error(error.message);
    }
    return data.signedUrl;
  }

  async remove(attachmentId: string, storagePath: string): Promise<void> {
    const { error: storageError } = await this.supabase.client.storage.from(BUCKET).remove([storagePath]);
    if (storageError) {
      throw new Error(storageError.message);
    }
    const { error } = await this.supabase.client.from('attachments').delete().eq('id', attachmentId);
    if (error) {
      throw new Error(error.message);
    }
  }
}
