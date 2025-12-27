# Architecture Documentation

## System Overview

This document provides a detailed explanation of the Job Scheduler architecture, design decisions, and data flow.

## High-Level Architecture

The system follows a layered architecture pattern:

1. **Presentation Layer**: REST API endpoints
2. **Application Layer**: Business logic (scheduler, executor)
3. **Data Layer**: Database persistence

## Detailed Component Design

### 1. CRON Parser (`src/utils/cronParser.js`)

**Purpose**: Parse CRON-like schedule strings with second-level precision

**Format**: `"second minute hour day month dayOfWeek"`

**Example**: `"31 10-15 1 * * MON-FRI"` means:
- Second: 31
- Minute: 10-15 (range)
- Hour: 1
- Day: * (all)
- Month: * (all)
- Day of Week: MON-FRI (range)

**Key Methods**:
- `parse()`: Converts string to structured object
- `getNextExecution()`: Calculates next execution time
- `matchesSchedule()`: Checks if a date matches the schedule

### 2. Scheduler Service (`src/services/scheduler.js`)

**Purpose**: Manages job scheduling and execution timing

**How it works**:
1. Maintains a Map of active jobs in memory
2. For each job, calculates the next execution time
3. Uses setTimeout for initial scheduling
4. Runs an execution loop every 100ms to check for due jobs
5. Executes jobs asynchronously without blocking

**Key Features**:
- Dynamic job addition/removal
- Automatic rescheduling after execution
- Drift tracking (difference between scheduled and actual time)
- Metrics collection

**Execution Flow**:
```
Job Created → Parse Schedule → Calculate Next Execution → 
Set Timeout → Execution Loop Checks → Execute Job → 
Reschedule → Repeat
```

### 3. Executor Service (`src/services/executor.js`)

**Purpose**: Execute HTTP POST requests for jobs

**Features**:
- HTTP POST requests using Axios
- Retry logic for ATLEAST_ONCE semantics (3 retries with exponential backoff)
- Error handling and logging
- Execution duration tracking
- Failure alerting

**Retry Logic**:
- For ATLEAST_ONCE type: Retries up to 3 times on failure
- Exponential backoff: 1s, 2s, 3s delays
- Records all attempts in database

### 4. Data Models

#### Job Model (`src/models/Job.js`)
- CRUD operations for jobs
- Database abstraction layer

#### Execution Model (`src/models/Execution.js`)
- Stores execution history
- Provides statistics and query methods

### 5. Database Schema

#### Jobs Table
```sql
CREATE TABLE jobs (
  jobId TEXT PRIMARY KEY,
  schedule TEXT NOT NULL,
  api TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

#### Executions Table
```sql
CREATE TABLE executions (
  executionId TEXT PRIMARY KEY,
  jobId TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  status TEXT NOT NULL,
  httpStatus INTEGER,
  duration INTEGER,
  error TEXT,
  FOREIGN KEY (jobId) REFERENCES jobs(jobId)
)
```

**Index**: `idx_executions_jobId_timestamp` for fast execution queries

## Data Flow

### Job Creation Flow

```
1. Client → POST /api/jobs
2. API validates request
3. Job.create() → Database insert
4. scheduler.addJob() → Parse schedule, calculate next execution
5. Schedule timeout/execution loop
6. Return jobId to client
```

### Job Execution Flow

```
1. Scheduler detects job is due (execution loop)
2. scheduler.executeJob() called
3. executor.execute() → HTTP POST request
4. Retry logic (if ATLEAST_ONCE and failure)
5. Execution.create() → Save result to database
6. Alert on failure (console log)
7. scheduler.rescheduleJob() → Calculate next execution
8. Repeat
```

### Query Execution Flow

```
1. Client → GET /api/jobs/:jobId/executions
2. API validates jobId
3. Execution.getLastN() → Database query
4. Return execution history
```

## Scalability Considerations

### Current Design

**Strengths**:
- Non-blocking async execution
- In-memory job tracking for fast access
- Efficient execution loop (100ms precision)
- Database indexing for fast queries

**Limitations**:
- Single process (not horizontally scalable)
- SQLite concurrency limits
- In-memory scheduler state (lost on restart, but reloaded from DB)

### Scaling Strategies

For production at scale:

1. **Horizontal Scaling**:
   - Use distributed job queue (Redis, RabbitMQ)
   - Multiple worker processes/containers
   - Distributed locking for job assignment

2. **Database**:
   - PostgreSQL/MySQL for better concurrency
   - Connection pooling
   - Read replicas for queries

3. **Job Execution**:
   - Separate worker pool from scheduler
   - Priority queues for job execution
   - Rate limiting per API endpoint

4. **High Availability**:
   - Leader election for scheduler
   - Job state replication
   - Graceful failover

## Fault Tolerance

### Current Implementation

1. **Job Execution Failures**:
   - Retry logic (3 attempts)
   - Error logging
   - Execution history preserved

2. **Database Failures**:
   - Connection error handling
   - Graceful degradation

3. **Process Failures**:
   - Jobs reloaded from database on restart
   - Graceful shutdown handling

### Production Recommendations

1. **Circuit Breaker**: Prevent cascading failures
2. **Dead Letter Queue**: Store permanently failed jobs
3. **Health Checks**: Monitor system health
4. **Backup & Recovery**: Regular database backups
5. **Monitoring**: Alert on critical failures

## Observability

### Logging

- Request logging (method, path, timestamp)
- Job execution logs (start, completion, errors)
- Scheduler state changes
- Error stack traces

### Metrics

- Total executions
- Success/failure counts
- Average execution duration
- Schedule drift
- Active job count

### Endpoints

- `/api/health`: System health check
- `/api/metrics`: Real-time metrics
- `/api/stats`: Overall statistics
- `/api/executions`: Recent executions (debugging)

## Security Considerations

### Current Implementation

- Basic input validation
- SQL injection prevention (parameterized queries)
- Error message sanitization

### Production Recommendations

- Authentication & Authorization (JWT, OAuth)
- Rate limiting
- API key management
- HTTPS enforcement
- Input sanitization
- CORS configuration

## Performance Metrics

### Target Performance

- **Throughput**: Thousands of jobs per second
- **Schedule Accuracy**: < 100ms drift
- **API Latency**: < 50ms for queries
- **Execution Latency**: Depends on external API response time

### Optimization Techniques

1. **Database**:
   - Indexed queries
   - Connection pooling
   - Query optimization

2. **Scheduler**:
   - In-memory job tracking
   - Efficient execution loop
   - Minimal blocking operations

3. **Executor**:
   - Async execution
   - Connection reuse
   - Timeout management

## Testing Strategy

### Unit Tests (Recommended)
- CRON parser edge cases
- Schedule calculation accuracy
- Retry logic behavior

### Integration Tests (Recommended)
- API endpoint testing
- Database operations
- End-to-end job execution

### Load Tests (Recommended)
- Concurrent job creation
- High-throughput execution
- Database query performance

## Deployment

### Development
- Local Node.js process
- SQLite database
- Console logging

### Production (Recommended)
- Docker containers
- PostgreSQL/MySQL database
- Centralized logging (ELK, Splunk)
- Monitoring (Prometheus, Grafana)
- Load balancer for API
- Worker pool for execution

