# Basic Interaction Example

This example demonstrates a simple interaction between a supervisor agent and a subordinate agent.

## Scenario
A supervisor agent coordinates with a subordinate agent to complete a task that involves processing data.

## Interaction Flow

1. Agent Registration
```json
// Subordinate Agent → Supervisor
{
  "type": "register",
  "agent_id": "data-processor-1",
  "capabilities": ["data-processing", "text-analysis"],
  "status": "available"
}

// Supervisor → Subordinate Agent
{
  "type": "registration_response",
  "status": "accepted",
  "supervisor_id": "main-supervisor"
}
```

2. Task Assignment
```json
// Supervisor → Subordinate Agent
{
  "type": "task",
  "task_id": "task-123",
  "description": "Analyze customer feedback data",
  "requirements": {
    "input_format": "text/csv",
    "expected_output": "sentiment_analysis",
    "min_confidence": 0.8
  },
  "priority": "high",
  "deadline": "2025-02-23T20:00:00Z"
}

// Subordinate Agent → Supervisor
{
  "type": "acknowledge",
  "task_id": "task-123",
  "status": "accepted",
  "message": "Starting data analysis"
}
```

3. Progress Updates
```json
// Subordinate Agent → Supervisor
{
  "type": "update",
  "task_id": "task-123",
  "progress": 50,
  "status": "in_progress",
  "message": "Processed 500/1000 records"
}

// Later...
{
  "type": "update",
  "task_id": "task-123",
  "progress": 100,
  "status": "completed",
  "result": {
    "total_records": 1000,
    "sentiment_breakdown": {
      "positive": 600,
      "neutral": 300,
      "negative": 100
    },
    "average_confidence": 0.92
  },
  "message": "Analysis completed successfully"
}
```

4. Task Completion Acknowledgment
```json
// Supervisor → Subordinate Agent
{
  "type": "completion_acknowledgment",
  "task_id": "task-123",
  "status": "accepted",
  "message": "Results validated and stored"
}
```

## Key Points

1. **Clear Communication Protocol**
   - Each message has a defined type and structure
   - Status updates are regular and informative
   - Progress is quantified when possible

2. **Error Handling**
   - Messages include status fields
   - Detailed error information when needed
   - Clear success/failure indicators

3. **Task Context**
   - Task requirements are clearly specified
   - Progress is measurable
   - Results include relevant metrics

4. **Resource Management**
   - Agent indicates its capabilities
   - Task includes priority and deadline
   - Results include performance metrics

This example shows the basic flow of communication between agents while maintaining clear protocols and handling task execution effectively.
