import { Agent } from './Agent';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'agent.log' })
  ]
});

// Get configuration from environment variables or use defaults
const SUPERVISOR_URL = process.env.SUPERVISOR_URL || 'http://localhost:3000';
const CAPABILITIES = (process.env.CAPABILITIES || 'general').split(',');

try {
  const agent = new Agent(SUPERVISOR_URL, CAPABILITIES);

  // Handle process termination
  const cleanup = () => {
    logger.info('Shutting down agent...');
    agent.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Error handling
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    agent.disconnect();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Log agent status periodically
  setInterval(() => {
    const status = agent.getStatus();
    logger.info('Agent status:', status);
  }, 60000); // Every minute

  logger.info('Agent started', {
    supervisorUrl: SUPERVISOR_URL,
    capabilities: CAPABILITIES
  });

} catch (error) {
  logger.error('Failed to start agent:', error);
  process.exit(1);
}