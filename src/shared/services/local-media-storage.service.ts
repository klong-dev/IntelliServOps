import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';

type LocalUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class LocalMediaStorageService {
  private readonly publicBaseUrl: string;
  private readonly uploadRoot: string;
  private readonly publicUploadPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const configuredUploadDir =
      this.configService.get<string>('app.localUploadDir') || 'uploads';
    const configuredBaseUrl =
      this.configService.get<string>('app.publicBaseUrl') ||
      `http://localhost:${this.configService.get<number>('app.port') || 3000}`;

    this.publicUploadPrefix = configuredUploadDir.replace(/^\/+|\/+$/g, '');
    this.uploadRoot = resolve(process.cwd(), this.publicUploadPrefix);
    this.publicBaseUrl = configuredBaseUrl.replace(/\/+$/g, '');
  }

  async saveApartmentVideo(
    relativePath: string,
    file: LocalUploadFile,
  ): Promise<string> {
    return this.saveFile(`apartment-videos/${relativePath}`, file);
  }

  private async saveFile(
    relativePath: string,
    file: LocalUploadFile,
  ): Promise<string> {
    const sanitizedRelativePath = this.sanitizeRelativePath(relativePath);
    const absolutePath = resolve(this.uploadRoot, sanitizedRelativePath);

    if (!absolutePath.startsWith(this.uploadRoot)) {
      throw new Error('Invalid local upload path');
    }

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return `${this.publicBaseUrl}/${this.publicUploadPrefix}/${sanitizedRelativePath.replace(/\\/g, '/')}`;
  }

  private sanitizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
  }
}
