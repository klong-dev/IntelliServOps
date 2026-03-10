import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

/**
 * Custom pipe for file uploads
 * Bypasses normal validation and just returns the value as-is
 * Used for multipart/form-data endpoints
 */
@Injectable()
export class FileUploadPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // Just pass the value through without validation
    // The actual validation happens in the controller/service
    return value;
  }
}
