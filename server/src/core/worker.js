import { randomUUID } from 'node:crypto';
import logger from '../utils/logger.js';

export class Worker {
  constructor(db, handlers, { leaseSeconds = 60, maxAttempts = 8, retrySeconds = 5 } = {}) {
    this.db = db;
    this.handlers = handlers;
    this.leaseSeconds = leaseSeconds;
    this.maxAttempts = maxAttempts;
    this.retrySeconds = retrySeconds;
    this.stopped = true;
    this.active = null;
    this.timer = null;
    this.abortController = new AbortController();
  }

  async claim() {
    const kinds = Object.keys(this.handlers);
    if (!kinds.length) return null;
    const [rows] = await this.db.query(`WITH candidate AS (
      SELECT id FROM outbox_jobs
      WHERE kind IN (:kinds) AND (
        (status = 'pending' AND available_at <= now()) OR
        (status = 'running' AND lease_until <= now())
      ) ORDER BY available_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE outbox_jobs j SET status = 'running', attempts = attempts + 1,
      lease_token = :token, lease_until = now() + :seconds * interval '1 second'
      FROM candidate WHERE j.id = candidate.id RETURNING j.*`, {
      replacements: { kinds, token: randomUUID(), seconds: this.leaseSeconds }
    });
    return rows[0] || null;
  }

  async execute(job) {
    try {
      return await this.db.transaction(async transaction => {
        const [current] = await this.db.query(`SELECT * FROM outbox_jobs
          WHERE id = :id AND status = 'running' AND lease_token = :token FOR UPDATE`, {
          replacements: { id: job.id, token: job.lease_token }, transaction
        });
        if (!current.length) return false;
        await this.handlers[job.kind](job.payload, { db: this.db, transaction, job: current[0], signal: this.abortController.signal });
        await this.db.query(`UPDATE outbox_jobs SET status = 'completed', finished_at = now(),
          lease_token = NULL, lease_until = NULL, last_error = NULL WHERE id = :id AND lease_token = :token`, {
          replacements: { id: job.id, token: job.lease_token }, transaction
        });
        return true;
      });
    } catch (error) {
      // Persist classifications, never third-party response bodies or SQL values that may contain secrets.
      const reason = String(error.code || error.name || 'TASK_FAILED').slice(0, 100);
      await this.db.query(`UPDATE outbox_jobs SET status = :status, last_error = :reason,
        available_at = now() + :delay * interval '1 second', lease_token = NULL, lease_until = NULL,
        finished_at = CASE WHEN :status = 'failed' THEN now() ELSE NULL END
        WHERE id = :id AND status = 'running' AND lease_token = :token`, {
        replacements: {
          id: job.id, token: job.lease_token, reason,
          status: job.attempts >= this.maxAttempts ? 'failed' : 'pending',
          delay: Math.min(3600, this.retrySeconds * 2 ** Math.min(job.attempts - 1, 10))
        }
      });
      logger.warn('Background task failed', { jobId: job.id, kind: job.kind, reason });
      return false;
    }
  }

  async runOnce() {
    const job = await this.claim();
    if (!job) return false;
    await this.execute(job);
    return true;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.abortController = new AbortController();
    const tick = () => {
      if (this.stopped) return;
      this.active = this.runOnce().catch(error => {
        logger.error('Background worker unavailable', { reason: error.code || error.name });
        return false;
      }).then(worked => {
        if (!this.stopped) this.timer = setTimeout(tick, worked ? 0 : 1000);
      });
    };
    tick();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.abortController.abort();
    await this.active;
  }
}
