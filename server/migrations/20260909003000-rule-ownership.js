module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE threat_rules ADD COLUMN organization_id uuid; CREATE INDEX threat_rules_organization ON threat_rules(organization_id, enabled)');
  },
  async down() { throw new Error('Rule ownership must be preserved'); }
};
