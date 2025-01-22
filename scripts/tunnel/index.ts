import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ngrok from 'ngrok';
import { pathToFileURL } from 'node:url';
import { Logger } from '@nestjs/common';

export type TunnelInit = (url: string) => Promise<void>;

const port = Number(process.argv[2] ?? process.env['PORT'] ?? 8888);
const logger = new Logger('Tunnel');

export async function setupTunnel() {
  try {
    logger.log('Starting Tunnel... on port ', port);
    const entries = await readdir(__dirname);
    if (entries.length <= 1) {
      logger.log('No tunnel scripts available. Shutting down...');
      return;
    }
    const tunnelUrl = await ngrok.connect({
      authtoken: process.env['NGROK_TOKEN'],
      port,
    });
    logger.log(`Tunnelling port localhost:${port} -> ${tunnelUrl}`);

    for (const entry of entries) {
      if (entry == '.' || entry == '..' || entry == 'index.ts') continue;
      const url = pathToFileURL(join(__dirname, entry));
      const file = url.toString();
      const init = await import(file).then((mod) => mod.default as TunnelInit);
      await init(tunnelUrl);
    }
  } catch (e) {
    logger.error(e.message, e.stack);
    process.exit(1);
  }
}

setupTunnel()
  .then(() => {})
  .catch((e: Error) => logger.error(e.message, e.stack));
