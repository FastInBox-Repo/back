import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';

/** Dependency-free security headers applied to every response. */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=15552000; includeSubDomains',
    );
  }
  next();
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number.parseInt(process.env.PORT ?? '4001', 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error('Invalid PORT value. Use a positive integer.');
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(securityHeaders);
  app.enableCors({
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:3001'],
    credentials: true,
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`FastInBox API listening on http://localhost:${port}`);
}
void bootstrap();
