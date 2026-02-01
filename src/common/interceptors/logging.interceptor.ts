import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip;

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const contentLength = response.get('content-length');

          this.logger.log(
            `${method} ${url} ${statusCode} ${contentLength || 0}b - ${Date.now() - now}ms - ${ip} ${userAgent}`,
          );
        },
        error: (error) => {
          const statusCode = error?.status || 500;
          this.logger.error(
            `${method} ${url} ${statusCode} - ${Date.now() - now}ms - ${ip} ${userAgent}`,
          );
        },
      }),
    );
  }
}
