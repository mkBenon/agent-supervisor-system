import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Supervisor } from './Supervisor';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' })
  ]
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, configure this to specific origins
    methods: ["GET", "POST"]
  }
});

const supervisor = new Supervisor(io);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`Supervisor server running on port ${PORT}`);
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    agents: supervisor.getAgentStatus().size,
    tasks: supervisor.getTaskStatus().size
  };
  res.json(status);
});

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});