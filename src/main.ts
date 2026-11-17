import { createApplication } from './bootstrap.js';
import { AUTH_CONFIG, type AuthConfig } from './config/env.config.js';
try {
  const app = await createApplication();
  const config = app.get<AuthConfig>(AUTH_CONFIG);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  const server = await app.listen(config.PORT, config.HOST);
  server.requestTimeout = 30000;
  console.log(`Auth listening on port ${config.PORT}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Auth startup failed');
  process.exitCode = 1;
}
