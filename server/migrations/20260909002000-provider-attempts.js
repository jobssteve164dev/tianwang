'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE provider_requests ADD COLUMN job_id uuid,
      ADD COLUMN attempt integer;
      CREATE INDEX provider_requests_job_idx ON provider_requests(job_id)`);
  },
  async down() { throw new Error('Provider attempts are preserved; use a reviewed forward migration'); }
};
