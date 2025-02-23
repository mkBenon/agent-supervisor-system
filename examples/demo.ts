import { Supervisor } from '../supervisor/src/Supervisor';
import { Agent } from '../agent/src/Agent';
import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { TaskPriority } from '../shared/types';

async function runDemo() {
  // Start supervisor
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const supervisor = new Supervisor(io);

  // Start HTTP server
  const PORT = 3000;
  httpServer.listen(PORT, () => {
    console.log(`Supervisor running on port ${PORT}`);
  });

  // Create agents with different capabilities
  const agents = [
    new Agent('http://localhost:3000', ['data-processing', 'analysis']),
    new Agent('http://localhost:3000', ['image-processing', 'ml']),
    new Agent('http://localhost:3000', ['data-processing', 'ml'])
  ];

  // Wait for agents to connect
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Add some tasks
  const tasks = [
    {
      description: 'Analyze customer data',
      requirements: {
        capabilities: ['data-processing', 'analysis']
      },
      priority: 'high' as TaskPriority,
      deadline: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
    },
    {
      description: 'Process satellite imagery',
      requirements: {
        capabilities: ['image-processing', 'ml']
      },
      priority: 'medium' as TaskPriority,
      deadline: new Date(Date.now() + 7200000).toISOString() // 2 hours from now
    },
    {
      description: 'Train ML model on customer data',
      requirements: {
        capabilities: ['data-processing', 'ml']
      },
      priority: 'high' as TaskPriority,
      deadline: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
    }
  ];

  // Assign tasks
  tasks.forEach(task => {
    const assignedTask = supervisor.addTask(
      task.description,
      task.requirements,
      task.priority,
      task.deadline
    );
    console.log(`Task assigned: ${assignedTask.id}`);
  });

  // Run for a while to see task execution
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Clean up
  agents.forEach(agent => agent.disconnect());
  httpServer.close();
  console.log('Demo completed');
}

// Run the demo
runDemo().catch(console.error);