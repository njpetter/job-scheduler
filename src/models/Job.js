const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

class Job {
  static async create(jobSpec) {
    const jobId = uuidv4();
    const { schedule, api, type } = jobSpec;

    await db.run(
      `INSERT INTO jobs (jobId, schedule, api, type, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      [jobId, schedule, api, type]
    );

    return { jobId, schedule, api, type, status: 'active' };
  }

  static async getById(jobId) {
    return await db.get('SELECT * FROM jobs WHERE jobId = ?', [jobId]);
  }

  static async update(jobId, updates) {
    const allowedFields = ['schedule', 'api', 'type'];
    const fieldsToUpdate = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fieldsToUpdate.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (fieldsToUpdate.length === 0) {
      return await this.getById(jobId);
    }

    fieldsToUpdate.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(jobId);

    const sql = `UPDATE jobs SET ${fieldsToUpdate.join(', ')} WHERE jobId = ?`;
    
    await db.run(sql, values);

    return await this.getById(jobId);
  }

  static async getAllActive() {
    return await db.all('SELECT * FROM jobs WHERE status = ?', ['active']);
  }

  static async getAll() {
    return await db.all('SELECT * FROM jobs ORDER BY createdAt DESC');
  }

  static async delete(jobId) {
    await db.run(
      `UPDATE jobs SET status = 'deleted', updatedAt = CURRENT_TIMESTAMP WHERE jobId = ?`,
      [jobId]
    );
  }
}

module.exports = Job;

