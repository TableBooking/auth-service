import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const databaseError =
      (error as { driverError?: { code?: string }; code?: string })?.driverError ?? error;
    const code = (databaseError as { code?: string })?.code;
    const exception =
      code && /^(08|53|57|ECONN|ENOTFOUND)/.test(code) ? new ServiceUnavailableException() : error;
    const parserStatus = (error as { status?: number })?.status;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : parserStatus && [400, 413, 415].includes(parserStatus)
          ? parserStatus
          : 500;
    const raw = exception instanceof HttpException ? exception.getResponse() : {};
    const detail = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {};
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: 'request_failed',
          status,
          correlationId: response.getHeader('x-request-id'),
        }),
      );
    response.status(status).json({
      code:
        detail.code ??
        (status === 400
          ? 'BAD_REQUEST'
          : status === 503
            ? 'SERVICE_UNAVAILABLE'
            : status >= 500
              ? 'INTERNAL_ERROR'
              : `HTTP_${status}`),
      message:
        status >= 500 ? 'Service temporarily unavailable' : (detail.message ?? 'Request failed'),
      correlationId: response.getHeader('x-request-id'),
      ...(detail.details ? { details: detail.details } : {}),
    });
  }
}
