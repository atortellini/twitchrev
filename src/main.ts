import {config} from './config';
import {Application} from './presentation';
import {logger} from './utils';

async function main() {
  try {
    const app = new Application(config);
    await app.start();

  } catch (error) {
    logger.error('Failed:', error);
    process.exit(1);
  }
}
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
})

main();