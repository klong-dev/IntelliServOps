import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface JsonApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  meta: Record<string, any>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  JsonApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<JsonApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((responseData) => {
        // Skip wrapping for StreamableFile (binary responses like PDF)
        if (responseData instanceof StreamableFile) {
          return responseData as any;
        }

        const statusCode = response.statusCode;
        const timestamp = new Date().toISOString();

        // Null / undefined
        if (responseData === null || responseData === undefined) {
          return {
            statusCode,
            message: 'Success',
            data: null as any,
            meta: { timestamp },
          };
        }

        // ── Pagination pattern: { items, total, page, limit, totalPages } ──
        if (
          typeof responseData === 'object' &&
          !Array.isArray(responseData) &&
          'items' in responseData &&
          'total' in responseData
        ) {
          const { items, total, page, limit, totalPages, ...rest } =
            responseData;
          return {
            statusCode,
            message: rest.message || 'Success',
            data: items,
            meta: {
              timestamp,
              total,
              page,
              limit,
              totalPages,
            },
          };
        }

        // ── Service returned a message field alongside data ──────────────
        if (
          typeof responseData === 'object' &&
          !Array.isArray(responseData) &&
          'message' in responseData
        ) {
          const { message, ...data } = responseData;
          return {
            statusCode,
            message: message as string,
            data: data as any,
            meta: { timestamp },
          };
        }

        // ── Default: wrap raw entity / array ────────────────────────────
        return {
          statusCode,
          message: 'Success',
          data: responseData,
          meta: { timestamp },
        };
      }),
    );
  }
}
