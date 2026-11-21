import { spawn } from 'node:child_process';
import { DataError } from '@fluxion/core';
import { serve } from '@hono/node-server';
import type { Hono } from 'hono';

const LOCAL_HOST = '127.0.0.1';

export interface RunningServer {
  url: string;
  close(): Promise<void>;
}

export function startServer(app: Hono, port: number): Promise<RunningServer> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname: LOCAL_HOST }, (info) => {
      const close = () => new Promise<void>((done) => server.close(() => done()));
      resolve({ url: `http://${LOCAL_HOST}:${info.port}`, close });
    });
    server.once('error', (error) => reject(new DataError(`Cannot start the dashboard on port ${port}: ${error.message}`, { cause: error })));
  });
}

function openCommand(url: string): [string, string[]] {
  if (process.platform === 'darwin') return ['open', [url]];
  if (process.platform === 'win32') return ['cmd', ['/c', 'start', '', url]];
  return ['xdg-open', [url]];
}

export function openBrowser(url: string): void {
  const [command, args] = openCommand(url);
  spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => undefined).unref();
}
