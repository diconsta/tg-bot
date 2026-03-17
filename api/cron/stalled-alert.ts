import type { IncomingMessage, ServerResponse } from 'http';
import { getNestApp } from '../index';
import { StalledStageAlertJob } from '../../src/scheduler/stalled-stage-alert.job';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    (res as any).statusCode = 405;
    (res as any).end('Method Not Allowed');
    return;
  }

  try {
    const app = await getNestApp();
    const job = app.get(StalledStageAlertJob);
    await job.sendStalledStageAlerts();
    (res as any).statusCode = 200;
    (res as any).end(JSON.stringify({ success: true }));
  } catch (error) {
    (res as any).statusCode = 500;
    (res as any).end(JSON.stringify({ error: error.message }));
  }
}
