import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import express from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

const expressApp = express();
let nestApp: INestApplication | null = null;
let initPromise: Promise<void> | null = null;

export async function getNestApp(): Promise<INestApplication> {
  if (initPromise === null) {
    initPromise = (async () => {
      const adapter = new ExpressAdapter(expressApp);
      nestApp = await NestFactory.create(AppModule, adapter, {
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
  return nestApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await getNestApp();
  expressApp(req, res);
}
