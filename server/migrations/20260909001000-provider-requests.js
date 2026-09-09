'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`CREATE TABLE provider_requests (
      id uuid PRIMARY KEY, event_id uuid, provider varchar(50) NOT NULL,
      model text NOT NULL, status varchar(20) NOT NULL,
      input_tokens bigint, output_tokens bigint, error_code varchar(100),
      created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
    ); CREATE INDEX provider_requests_created_idx ON provider_requests(created_at)`);
  },
  async down() { throw new Error('Provider history is preserved; use a reviewed forward migration'); }
};
