import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const { statusCode } = res;
          this.logger.log(`${method} ${originalUrl} ${statusCode} ${ms}ms`);
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          const status = err instanceof HttpException ? err.getStatus() : res.statusCode || 500;
          this.logger.error(`${method} ${originalUrl} ${status} ${ms}ms — ${err.message}`);
        },
      }),
    );
  }
}
