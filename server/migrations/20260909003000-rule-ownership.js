const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      if (!await queryInterface.tableExists('threat_rules', { transaction })) {
        await queryInterface.createTable('threat_rules', {
          id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
          name: { type: DataTypes.STRING(100), allowNull: false },
          organization_id: { type: DataTypes.UUID },
          rule_type: { type: DataTypes.ENUM('sigma', 'yara', 'suricata', 'custom'), allowNull: false },
          content: { type: DataTypes.TEXT, allowNull: false },
          enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
          severity: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false },
          tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
          metadata: { type: DataTypes.JSONB, defaultValue: {} },
          created_at: { type: DataTypes.DATE, allowNull: false },
          updated_at: { type: DataTypes.DATE, allowNull: false }
        }, { transaction });
      }
      await queryInterface.sequelize.query('ALTER TABLE threat_rules ADD COLUMN IF NOT EXISTS organization_id uuid; CREATE INDEX IF NOT EXISTS threat_rules_organization ON threat_rules(organization_id, enabled)', { transaction });
    });
  },
  async down() { throw new Error('Rule ownership must be preserved'); }
};
