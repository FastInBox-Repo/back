import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number.parseInt(process.env.PORT ?? '4001', 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error('Invalid PORT value. Use a positive integer.');
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:3001'],
    credentials: true,
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`FastInBox API listening on http://localhost:${port}`);
}
void bootstrap();
