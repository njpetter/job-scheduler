/**
 * Database Initialization Script
 * Creates tables for jobs and executions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data', 'scheduler.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Create tables
db.serialize(() => {
  // Jobs table
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      jobId TEXT PRIMARY KEY,
      schedule TEXT NOT NULL,
      api TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating jobs table:', err.message);
    } else {
      console.log('Jobs table created/verified');
    }
  });

  // Executions table
  db.run(`
    CREATE TABLE IF NOT EXISTS executions (
      executionId TEXT PRIMARY KEY,
      jobId TEXT NOT NULL,
      timestamp DATETIME NOT NULL,
      status TEXT NOT NULL,
      httpStatus INTEGER,
      duration INTEGER,
      error TEXT,
      FOREIGN KEY (jobId) REFERENCES jobs(jobId)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating executions table:', err.message);
    } else {
      console.log('Executions table created/verified');
    }
  });

  // Create index for faster queries
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_executions_jobId_timestamp 
    ON executions(jobId, timestamp DESC)
  `, (err) => {
    if (err) {
      console.error('Error creating index:', err.message);
    } else {
      console.log('Index created/verified');
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database initialization complete!');
        }
      });
    }
  });
});

