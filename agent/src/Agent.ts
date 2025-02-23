import { io, Socket } from 'socket.io-client';
import {
  Agent as AgentType,
  RegistrationMessage,
  TaskMessage,
  TaskAcknowledgment,
  TaskUpdate,
  TaskStatus,
  AgentStatus
} from '../../shared/types';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export class Agent {
  private socket: Socket;
  private logger: winston.Logger;
  private id: string;
  private capabilities: string[];
  private status: AgentStatus;
  private currentTask?: string;
  private supervisorUrl: string;

  constructor(supervisorUrl: string, capabilities: string[]) {
    this.id = `agent-${uuidv4().slice(0, 8)}`;
    this.capabilities = capabilities;
    this.status = 'available';
    this.supervisorUrl = supervisorUrl;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `agent-${this.id}.log` })
      ]
    });

    this.socket = io(supervisorUrl);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Connection events
    this.socket.on('connect', () => {
      this.logger.info('Connected to supervisor');
      this.register();
    });

    this.socket.on('disconnect', () => {
      this.logger.info('Disconnected from supervisor');
    });

    this.socket.on('connect_error', (error) => {
      this.logger.error('Connection error:', error);
    });

    // Registration response
    this.socket.on('registration_response', (response) => {
      this.logger.info('Registration response received', response);
    });

    // Task assignment
    this.socket.on('task', (message: TaskMessage) => {
      this.handleTaskAssignment(message);
    });
  }

  private register(): void {
    const registrationMessage: RegistrationMessage = {
      type: 'register',
      agent_id: this.id,
      capabilities: this.capabilities,
      status: this.status,
      timestamp: new Date().toISOString()
    };

    this.socket.emit('register', registrationMessage);
    this.logger.info('Registration sent', { message: registrationMessage });
  }

  private async handleTaskAssignment(message: TaskMessage): Promise<void> {
    this.logger.info('Task received', { taskId: message.task_id });

    // Check if we can handle the task
    const canHandle = this.checkCapabilities(message.requirements);
    
    const acknowledgment: TaskAcknowledgment = {
      type: 'acknowledge',
      task_id: message.task_id,
      status: canHandle ? 'accepted' : 'rejected',
      message: canHandle ? 'Task accepted' : 'Missing required capabilities',
      timestamp: new Date().toISOString()
    };

    this.socket.emit('acknowledge', acknowledgment);

    if (canHandle) {
      this.status = 'busy';
      this.currentTask = message.task_id;
      await this.executeTask(message);
    }
  }

  private checkCapabilities(requirements: Record<string, any>): boolean {
    if (!requirements.capabilities) return true;
    return requirements.capabilities.every((cap: string) => 
      this.capabilities.includes(cap)
    );
  }

  private async executeTask(task: TaskMessage): Promise<void> {
    try {
      // Simulate task execution with progress updates
      for (let progress = 0; progress <= 100; progress += 20) {
        if (progress < 100) {
          await this.sendTaskUpdate(task.task_id, 'in_progress', progress);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
        }
      }

      // Task completed
      await this.sendTaskUpdate(task.task_id, 'completed', 100, {
        completedAt: new Date().toISOString(),
        result: 'Task execution successful'
      });

      this.status = 'available';
      this.currentTask = undefined;

    } catch (error) {
      this.logger.error('Task execution failed', { taskId: task.task_id, error });
      
      await this.sendTaskUpdate(task.task_id, 'failed', 0, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.status = 'available';
      this.currentTask = undefined;
    }
  }

  private async sendTaskUpdate(
    taskId: string,
    status: TaskStatus,
    progress: number,
    result?: Record<string, any>
  ): Promise<void> {
    const update: TaskUpdate = {
      type: 'update',
      task_id: taskId,
      status,
      progress,
      result,
      timestamp: new Date().toISOString()
    };

    this.socket.emit('update', update);
    this.logger.info('Task update sent', { update });
  }

  public disconnect(): void {
    this.socket.disconnect();
  }

  public getStatus(): AgentType {
    return {
      id: this.id,
      capabilities: this.capabilities,
      status: this.status,
      currentTask: this.currentTask,
      lastUpdate: new Date().toISOString()
    };
  }
}