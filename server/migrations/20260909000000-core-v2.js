'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(`
        CREATE TABLE telemetry_receipts (
          id uuid PRIMARY KEY,
          agent_id varchar(100) NOT NULL,
          organization_id uuid,
          message_key varchar(255) NOT NULL,
          payload_hash char(64) NOT NULL,
          data_type varchar(20) NOT NULL CHECK (data_type IN ('system','network','logs','security')),
          sampled_at timestamptz NOT NULL,
          payload jsonb NOT NULL,
          received_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(agent_id, message_key)
        );
        CREATE INDEX telemetry_receipts_agent_time ON telemetry_receipts(agent_id, sampled_at DESC);
        CREATE TABLE telemetry_samples (
          receipt_id uuid NOT NULL REFERENCES telemetry_receipts(id),
          sampled_at timestamptz NOT NULL,
          agent_id varchar(100) NOT NULL,
          organization_id uuid,
          data_type varchar(20) NOT NULL,
          cpu_load double precision,
          memory_usage double precision,
          payload jsonb NOT NULL,
          PRIMARY KEY(receipt_id, sampled_at)
        ) PARTITION BY RANGE(sampled_at);
        CREATE INDEX telemetry_samples_agent_time ON telemetry_samples(agent_id, sampled_at DESC);
        CREATE TABLE telemetry_samples_default PARTITION OF telemetry_samples DEFAULT;
        CREATE TABLE outbox_jobs (
          id uuid PRIMARY KEY,
          kind varchar(100) NOT NULL,
          dedupe_key varchar(255) NOT NULL UNIQUE,
          payload jsonb NOT NULL,
          status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
          attempts integer NOT NULL DEFAULT 0,
          available_at timestamptz NOT NULL DEFAULT now(),
          lease_until timestamptz,
          lease_token uuid,
          last_error text,
          created_at timestamptz NOT NULL DEFAULT now(),
          finished_at timestamptz
        );
        CREATE INDEX outbox_jobs_ready ON outbox_jobs(available_at, created_at) WHERE status IN ('pending','running');
        CREATE TABLE application_cache (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          expires_at timestamptz NOT NULL
        );
        CREATE INDEX application_cache_expiry ON application_cache(expires_at);
      `, { transaction });
      // Prepare calendar partitions before traffic; old or late data remains durable in the default partition.
      await queryInterface.sequelize.query(`
        DO $$ DECLARE start_at date; end_at date; partition_name text;
        BEGIN
          FOR month_offset IN 0..2 LOOP
            start_at := (date_trunc('month', current_date) + make_interval(months => month_offset))::date;
            end_at := (start_at + interval '1 month')::date;
            partition_name := 'telemetry_samples_' || to_char(start_at, 'YYYYMM');
            EXECUTE format('CREATE TABLE %I PARTITION OF telemetry_samples FOR VALUES FROM (%L) TO (%L)', partition_name, start_at, end_at);
          END LOOP;
        END $$;
      `, { transaction });
    });
  },
  async down() {
    throw new Error('V2 telemetry and task data must be preserved; rollback requires an explicit data migration');
  }
};
