import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  Agent,
  Task,
  Message,
  RegistrationMessage,
  TaskAcknowledgment,
  TaskUpdate,
  AgentStatus,
  TaskStatus,
  TaskPriority
} from '../../shared/types';
import winston from 'winston';

export class Supervisor {
  private agents: Map<string, Agent>;
  private tasks: Map<string, Task>;
  private io: Server;
  private logger: winston.Logger;

  constructor(io: Server) {
    this.agents = new Map();
    this.tasks = new Map();
    this.io = io;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'supervisor.log' })
      ]
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      this.logger.info('New connection established', { socketId: socket.id });

      // Handle agent registration
      socket.on('register', (message: RegistrationMessage) => {
        this.handleAgentRegistration(socket.id, message);
      });

      // Handle task acknowledgments
      socket.on('acknowledge', (message: TaskAcknowledgment) => {
        this.handleTaskAcknowledgment(socket.id, message);
      });

      // Handle task updates
      socket.on('update', (message: TaskUpdate) => {
        this.handleTaskUpdate(socket.id, message);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleAgentDisconnection(socket.id);
      });
    });
  }

  private handleAgentRegistration(socketId: string, message: RegistrationMessage): void {
    const agent: Agent = {
      id: message.agent_id,
      capabilities: message.capabilities,
      status: message.status,
      lastUpdate: new Date().toISOString()
    };

    this.agents.set(socketId, agent);
    this.logger.info('Agent registered', { agent });

    // Send registration response
    this.io.to(socketId).emit('registration_response', {
      type: 'registration_response',
      status: 'accepted',
      supervisor_id: 'supervisor-' + uuidv4().slice(0, 8),
      timestamp: new Date().toISOString()
    });

    // Check for pending tasks that match agent capabilities
    this.assignPendingTasks(socketId, agent);
  }

  private handleTaskAcknowledgment(socketId: string, message: TaskAcknowledgment): void {
    const task = this.tasks.get(message.task_id);
    if (!task) {
      this.logger.warn('Task not found for acknowledgment', { taskId: message.task_id });
      return;
    }

    if (message.status === 'accepted') {
      task.status = 'in_progress';
      const agent = this.agents.get(socketId);
      if (agent) {
        agent.status = 'busy';
        agent.currentTask = task.id;
      }
    } else {
      // If rejected, try to reassign to another agent
      task.status = 'pending';
      task.assignedAgent = undefined;
      this.assignTask(task);
    }

    this.logger.info('Task acknowledgment handled', { 
      taskId: message.task_id, 
      status: message.status 
    });
  }

  private handleTaskUpdate(socketId: string, message: TaskUpdate): void {
    const task = this.tasks.get(message.task_id);
    if (!task) {
      this.logger.warn('Task not found for update', { taskId: message.task_id });
      return;
    }

    task.status = message.status;
    task.progress = message.progress;
    task.result = message.result;
    task.updatedAt = new Date().toISOString();

    if (message.status === 'completed' || message.status === 'failed') {
      const agent = this.agents.get(socketId);
      if (agent) {
        agent.status = 'available';
        agent.currentTask = undefined;
        // Look for new tasks to assign to the now-available agent
        this.assignPendingTasks(socketId, agent);
      }
    }

    this.logger.info('Task update handled', { 
      taskId: message.task_id, 
      status: message.status,
      progress: message.progress 
    });
  }

  private handleAgentDisconnection(socketId: string): void {
    const agent = this.agents.get(socketId);
    if (agent) {
      if (agent.currentTask) {
        const task = this.tasks.get(agent.currentTask);
        if (task) {
          task.status = 'pending';
          task.assignedAgent = undefined;
          // Try to reassign the task
          this.assignTask(task);
        }
      }
      this.agents.delete(socketId);
      this.logger.info('Agent disconnected', { agentId: agent.id });
    }
  }

  public addTask(description: string, requirements: Record<string, any>, priority: TaskPriority, deadline: string): Task {
    const task: Task = {
      id: uuidv4(),
      description,
      requirements,
      priority,
      deadline,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.set(task.id, task);
    this.logger.info('New task added', { taskId: task.id });
    
    // Try to assign the task immediately
    this.assignTask(task);
    
    return task;
  }

  private assignTask(task: Task): void {
    // Find available agent with matching capabilities
    for (const [socketId, agent] of this.agents.entries()) {
      if (
        agent.status === 'available' &&
        this.hasRequiredCapabilities(agent, task.requirements)
      ) {
        task.assignedAgent = agent.id;
        task.updatedAt = new Date().toISOString();
        
        this.io.to(socketId).emit('task', {
          type: 'task',
          task_id: task.id,
          description: task.description,
          requirements: task.requirements,
          priority: task.priority,
          deadline: task.deadline,
          timestamp: new Date().toISOString()
        });

        this.logger.info('Task assigned', { 
          taskId: task.id, 
          agentId: agent.id 
        });
        return;
      }
    }

    this.logger.info('No available agent found for task', { taskId: task.id });
  }

  private assignPendingTasks(socketId: string, agent: Agent): void {
    if (agent.status !== 'available') return;

    // Look for pending tasks that match agent capabilities
    for (const task of this.tasks.values()) {
      if (
        task.status === 'pending' &&
        !task.assignedAgent &&
        this.hasRequiredCapabilities(agent, task.requirements)
      ) {
        this.assignTask(task);
        break; // Assign one task at a time
      }
    }
  }

  private hasRequiredCapabilities(agent: Agent, requirements: Record<string, any>): boolean {
    // Simple capability matching - can be made more sophisticated
    return requirements.capabilities?.every((cap: string) => 
      agent.capabilities.includes(cap)
    ) ?? true;
  }

  public getAgentStatus(): Map<string, Agent> {
    return new Map(this.agents);
  }

  public getTaskStatus(): Map<string, Task> {
    return new Map(this.tasks);
  }
}