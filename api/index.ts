import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import express from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

const expressApp = express();
let initPromise: Promise<void> | null = null;

async function bootstrap() {
  if (initPromise === null) {
    initPromise = (async () => {
      const adapter = new ExpressAdapter(expressApp);
      const nestApp = await NestFactory.create(AppModule, adapter, {
        logger: ['error', 'warn', 'log'],
      });

      nestApp.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );

      await nestApp.init();
    })();
  }

  await initPromise;
  return expressApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const server = await bootstrap();
  server(req, res);
}
