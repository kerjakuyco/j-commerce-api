import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Terjadi kesalahan internal server';
    let error = 'Internal Server Error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as { message?: string | string[]; error?: string };
        message = Array.isArray(r.message) ? r.message.join(', ') : r.message || message;
        error = r.error || error;
        if (Array.isArray(r.message)) {
          details = this.formatValidationDetails(r.message);
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const result = this.mapPrismaError(exception);
      statusCode = result.statusCode;
      message = result.message;
      error = result.error;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      message = 'Data tidak valid';
      error = 'Validation Error';
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      message = exception.message;
    } else {
      this.logger.error(`Unknown error: ${String(exception)}`);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    error: string;
  } {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint
        const field = (err.meta?.target as string[])?.join(', ') || 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `${field} sudah terdaftar`,
          error: 'Conflict',
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Data tidak ditemukan',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint gagal',
          error: 'Bad Request',
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'ID tidak valid',
          error: 'Bad Request',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'Database Error',
        };
    }
  }

  private formatValidationDetails(messages: string[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const m of messages) {
      const [key, ...rest] = m.split(' ');
      const value = rest.join(' ');
      if (key) {
        if (!out[key]) out[key] = [];
        out[key].push(value);
      }
    }
    return out;
  }
}
