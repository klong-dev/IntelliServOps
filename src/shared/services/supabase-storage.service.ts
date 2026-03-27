import type { Express } from 'express';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly supabaseClient: SupabaseClient;
  private readonly supabaseEnabled: boolean;
  private readonly chatImagesBucket: string;
  private readonly chatImagesFallbackBucket = 'apartment-cooperation';

  constructor(private readonly configService: ConfigService) {
    const supabaseConfig = this.configService.get('supabase');
    this.supabaseEnabled = supabaseConfig?.enabled || false;
    this.chatImagesBucket = supabaseConfig?.chatImagesBucket || 'chat-images';

    if (this.supabaseEnabled) {
      this.supabaseClient = createClient(
        supabaseConfig.url,
        supabaseConfig.anonKey,
      );
      this.logger.log('Supabase Storage initialized');
    }
  }

  async uploadChatImage(path: string, file: any): Promise<string> {
    try {
      return await this.uploadFile(this.chatImagesBucket, path, file);
    } catch (error) {
      if (
        this.isBucketNotFoundError(error) &&
        this.chatImagesBucket !== this.chatImagesFallbackBucket
      ) {
        const fallbackPath = `chat/${path}`;
        this.logger.warn(
          `Bucket ${this.chatImagesBucket} not found. Falling back to ${this.chatImagesFallbackBucket}/${fallbackPath}`,
        );

        return this.uploadFile(this.chatImagesFallbackBucket, fallbackPath, file);
      }

      throw error;
    }
  }

  /**
   * Upload file to Supabase Storage
   * @param bucket - Bucket name (e.g., 'identities')
   * @param path - File path in bucket (e.g., 'user-id/front.jpg')
   * @param file - Express Multer file object
   * @returns Public URL of uploaded file
   */
  async uploadFile(bucket: string, path: string, file: any): Promise<string> {
    if (!this.supabaseEnabled) {
      throw new Error('Supabase Storage is not enabled');
    }

    try {
      this.logger.log(
        `Uploading file to ${bucket}/${path}, size: ${file.size} bytes`,
      );

      // Upload file to Supabase Storage
      const { data, error } = await this.supabaseClient.storage
        .from(bucket)
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: true, // Overwrite if exists
        });

      if (error) {
        this.logger.error(
          `Failed to upload file: ${error.message}`,
          error.stack,
        );
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrl } = this.supabaseClient.storage
        .from(bucket)
        .getPublicUrl(data.path);

      this.logger.log(`File uploaded successfully: ${publicUrl.publicUrl}`);
      return publicUrl.publicUrl;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Upload identity card images (front and back)
   * @param userId - User ID for organizing storage
   * @param frontFile - Front image file
   * @param backFile - Back image file (optional)
   * @returns Object with front and back URLs
   */
  async uploadIdentityCardImages(
    userId: string,
    frontFile: any,
    backFile?: any,
  ): Promise<{ frontUrl: string; backUrl?: string }> {
    const bucket = 'identities';

    // Validate files
    if (!frontFile) {
      throw new Error('Front image file is required');
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimeTypes.includes(frontFile.mimetype)) {
      throw new Error(
        `Invalid image format. Allowed: ${validMimeTypes.join(', ')}`,
      );
    }

    if (backFile && !validMimeTypes.includes(backFile.mimetype)) {
      throw new Error(
        `Invalid image format. Allowed: ${validMimeTypes.join(', ')}`,
      );
    }

    try {
      // Upload front image
      const timestamp = Date.now();
      const frontPath = `${userId}/front-${timestamp}.${this.getFileExtension(frontFile.mimetype)}`;
      const frontUrl = await this.uploadFile(bucket, frontPath, frontFile);

      // Upload back image if provided
      let backUrl: string | undefined;
      if (backFile) {
        const backPath = `${userId}/back-${timestamp}.${this.getFileExtension(backFile.mimetype)}`;
        backUrl = await this.uploadFile(bucket, backPath, backFile);
      }

      this.logger.log(
        `Identity card images uploaded for user ${userId}: ${frontUrl}${backUrl ? `, ${backUrl}` : ''}`,
      );

      return {
        frontUrl,
        backUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload identity card images: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return mimeMap[mimeType] || 'jpg';
  }

  /**
   * Delete file from Supabase Storage
   * @param bucket - Bucket name
   * @param path - File path
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    if (!this.supabaseEnabled) {
      console.warn('Supabase Storage is not enabled');
      return;
    }

    try {
      const { error } = await this.supabaseClient.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        this.logger.warn(
          `Failed to delete file ${bucket}/${path}: ${error.message}`,
        );
      } else {
        this.logger.log(`File deleted: ${bucket}/${path}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`, error.stack);
    }
  }

  private isBucketNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.toLowerCase().includes('bucket not found');
  }
}
