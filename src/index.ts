import { buildApp } from './config/app.js';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;

const start = async () => {
  const app = await buildApp();

  try {
    await app.listen({ host: HOST, port: PORT });
    app.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
