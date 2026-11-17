import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
export function requestContext(logging: boolean) {
  return (request: Request, response: Response, next: NextFunction) => {
    const given = request.get('x-request-id');
    response.setHeader(
      'x-request-id',
      given && /^[a-f0-9-]{36}$/i.test(given) ? given : randomUUID(),
    );
    response.setHeader('Cache-Control', 'no-store');
    if (logging)
      response.once('finish', () =>
        console.log(
          JSON.stringify({
            event: 'http_request',
            method: request.method,
            path: request.path,
            status: response.statusCode,
            correlationId: response.getHeader('x-request-id'),
          }),
        ),
      );
    next();
  };
}
