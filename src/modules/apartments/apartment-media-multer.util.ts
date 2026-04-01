import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { Request } from 'express';
import { createWriteStream } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { basename, dirname, resolve } from 'path';

type ApartmentMediaRequest = Request & {
  user?: { sub?: string };
  params?: Record<string, string | undefined>;
};

const VALID_APARTMENT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const VALID_APARTMENT_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export type ApartmentStoredVideoMetadata = {
  destination: string;
  filename: string;
  path: string;
  relativePath: string;
  localPublicUrl: string;
  size: number;
};

type MulterStoredFileInfo = {
  buffer?: Buffer;
  size?: number;
  destination?: string;
  filename?: string;
  path?: string;
  relativePath?: string;
  localPublicUrl?: string;
};

export function createApartmentMediaMulterOptions(): MulterOptions {
  return {
    storage: createApartmentMediaStorage(),
    fileFilter: (_req, file, callback) => {
      if (file.fieldname === 'images') {
        if (VALID_APARTMENT_IMAGE_MIME_TYPES.includes(file.mimetype as any)) {
          return callback(null, true);
        }

        return callback(
          new BadRequestException(
            `Invalid image format: ${file.originalname}. Allowed: JPEG, PNG, WebP`,
          ),
          false,
        );
      }

      if (file.fieldname === 'video') {
        if (VALID_APARTMENT_VIDEO_MIME_TYPES.includes(file.mimetype as any)) {
          return callback(null, true);
        }

        return callback(
          new BadRequestException(
            `Invalid video format: ${file.originalname}. Allowed: MP4, MOV, WEBM`,
          ),
          false,
        );
      }

      return callback(
        new BadRequestException(`Unexpected file field: ${file.fieldname}`),
        false,
      );
    },
  };
}

export function getApartmentVideoExtension(mimetype: string) {
  return mimetype === 'video/quicktime' ? 'mov' : mimetype.split('/')[1];
}

function createApartmentMediaStorage() {
  return {
    _handleFile(
      req: ApartmentMediaRequest,
      file: any,
      callback: (error?: unknown, info?: MulterStoredFileInfo) => void,
    ) {
      if (file.fieldname !== 'video') {
        const chunks: Buffer[] = [];
        let size = 0;

        file.stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
        });
        file.stream.on('error', (error: Error) => callback(error));
        file.stream.on('end', () =>
          callback(null, {
            buffer: Buffer.concat(chunks),
            size,
          }),
        );

        return;
      }

      const relativePath = buildApartmentVideoRelativePath(req, file.mimetype);
      const uploadRoot = getLocalUploadRoot();
      const absolutePath = resolve(uploadRoot, relativePath);

      if (!absolutePath.startsWith(uploadRoot)) {
        callback(new Error('Invalid local upload path'));
        return;
      }

      let size = 0;
      let completed = false;
      const complete = (
        error?: unknown,
        info?: Partial<ApartmentStoredVideoMetadata>,
      ) => {
        if (completed) {
          return;
        }

        completed = true;
        callback(error, info);
      };

      mkdir(dirname(absolutePath), { recursive: true })
        .then(() => {
          const writeStream = createWriteStream(absolutePath);

          file.stream.on('data', (chunk: Buffer) => {
            size += chunk.length;
          });
          file.stream.on('error', (error: Error) => {
            writeStream.destroy(error);
            complete(error);
          });
          writeStream.on('error', (error) => complete(error));
          writeStream.on('finish', () =>
            complete(null, {
              destination: dirname(absolutePath),
              filename: basename(absolutePath),
              path: absolutePath,
              relativePath,
              localPublicUrl: buildLocalPublicUrl(relativePath),
              size,
            }),
          );

          file.stream.pipe(writeStream);
        })
        .catch((error) => complete(error));
    },

    _removeFile(
      _req: ApartmentMediaRequest,
      file: Partial<ApartmentStoredVideoMetadata>,
      callback: (error: Error | null) => void,
    ) {
      if (!file.path) {
        callback(null);
        return;
      }

      unlink(file.path)
        .then(() => callback(null))
        .catch(() => callback(null));
    },
  };
}

function buildApartmentVideoRelativePath(
  req: ApartmentMediaRequest,
  mimetype: string,
) {
  const timestamp = Date.now();
  const extension = getApartmentVideoExtension(mimetype);
  const actorId = req.user?.sub || 'anonymous';
  const apartmentId = req.params?.id;
  const normalizedUrl = (req.originalUrl || '').split('?')[0];

  if (normalizedUrl.endsWith('/apartments/partner/cooperation')) {
    return `apartment-videos/partner-${actorId}/video/${timestamp}.${extension}`;
  }

  if (/\/apartments\/[^/]+\/cooperation-media$/.test(normalizedUrl)) {
    return `apartment-videos/${apartmentId}/video/${actorId}-${timestamp}.${extension}`;
  }

  if (req.method === 'POST' && /\/apartments$/.test(normalizedUrl)) {
    return `apartment-videos/apartments/owner-${actorId}/video/${timestamp}.${extension}`;
  }

  if (req.method === 'PATCH' && /\/apartments\/[^/]+$/.test(normalizedUrl)) {
    return `apartment-videos/apartments/${apartmentId}/video/${timestamp}.${extension}`;
  }

  return `apartment-videos/misc/${actorId}-${timestamp}.${extension}`;
}

function getLocalUploadRoot() {
  const uploadDir = getNormalizedUploadDir();
  return resolve(process.cwd(), uploadDir);
}

function buildLocalPublicUrl(relativePath: string) {
  const baseUrl =
    (process.env.APP_PUBLIC_BASE_URL || '').replace(/\/+$/g, '') ||
    `http://localhost:${process.env.APP_PORT || '3000'}`;
  const uploadDir = getNormalizedUploadDir();
  const normalizedRelativePath = relativePath.replace(/\\/g, '/');

  return `${baseUrl}/${uploadDir}/${normalizedRelativePath}`;
}

function getNormalizedUploadDir() {
  return (process.env.LOCAL_UPLOAD_DIR || 'uploads').replace(/^\/+|\/+$/g, '');
}
