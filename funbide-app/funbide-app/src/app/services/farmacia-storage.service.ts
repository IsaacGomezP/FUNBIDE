import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class FarmaciaStorageService {
  private readonly bucketName = 'productos-farmacia';

  constructor(private supabaseService: SupabaseService) {}

  async uploadProductImage(file: File, productName: string): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const ext = file.name.split('.').pop() || 'png';
    const safeName = productName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const filePath = `${safeName || 'producto'}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}
