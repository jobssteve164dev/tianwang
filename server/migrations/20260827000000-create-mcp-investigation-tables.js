'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('investigations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      case_id: { type: Sequelize.UUID, allowNull: false },
      node_id: { type: Sequelize.STRING(100), allowNull: false },
      source: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'mcp' },
      requested_by: { type: Sequelize.STRING(255), allowNull: false },
      authorization_grant_id: Sequelize.STRING(255),
      organization_id: Sequelize.UUID,
      request_scope: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'requested' },
      task_id: Sequelize.UUID,
      evidence_manifest: Sequelize.JSONB,
      result: Sequelize.JSONB,
      started_at: Sequelize.DATE,
      deadline_at: Sequelize.DATE,
      finished_at: Sequelize.DATE,
      expires_at: Sequelize.DATE,
      error_code: Sequelize.STRING(100),
      error_message: Sequelize.TEXT,
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('findings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      case_id: { type: Sequelize.UUID, allowNull: false },
      investigation_id: { type: Sequelize.UUID, allowNull: false },
      node_id: { type: Sequelize.STRING(100), allowNull: false },
      classification: { type: Sequelize.STRING(40), allowNull: false },
      confidence: { type: Sequelize.FLOAT, allowNull: false },
      evidence_refs: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      observations: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      limitations: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      submitted_by: { type: Sequelize.STRING(255), allowNull: false },
      organization_id: Sequelize.UUID,
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('response_plans', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      case_id: { type: Sequelize.UUID, allowNull: false },
      node_id: { type: Sequelize.STRING(100), allowNull: false },
      finding_ref: { type: Sequelize.UUID, allowNull: false },
      evidence_refs: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      idempotency_key: { type: Sequelize.STRING(255), allowNull: false },
      actions: { type: Sequelize.JSONB, allowNull: false },
      verification: { type: Sequelize.JSONB, allowNull: false },
      rollback: { type: Sequelize.JSONB, allowNull: false },
      validation: Sequelize.JSONB,
      execution: Sequelize.JSONB,
      status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'validated' },
      submitted_by: { type: Sequelize.STRING(255), allowNull: false },
      organization_id: Sequelize.UUID,
      executed_at: Sequelize.DATE,
      expires_at: Sequelize.DATE,
      rolled_back_at: Sequelize.DATE,
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.addIndex('investigations', ['node_id', 'created_at']);
    await queryInterface.addIndex('investigations', ['case_id']);
    await queryInterface.addIndex('investigations', ['organization_id', 'created_at']);
    await queryInterface.addIndex('findings', ['investigation_id']);
    await queryInterface.addIndex('response_plans', ['node_id', 'created_at']);
    await queryInterface.addIndex('response_plans', ['organization_id', 'idempotency_key'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('response_plans');
    await queryInterface.dropTable('findings');
    await queryInterface.dropTable('investigations');
  }
};
