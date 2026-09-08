const bootstrapAdmin = async (sequelize, models, env = process.env) => {
  const username = env.BOOTSTRAP_ADMIN_USERNAME;
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  const email = env.BOOTSTRAP_ADMIN_EMAIL;
  if (!username && !password && !email) return;
  if (!username || !email || !password || password.length < 16) {
    throw new Error('Bootstrap requires administrator username, email and a password of at least 16 characters');
  }

  await sequelize.transaction(async transaction => {
    // Multiple application replicas may start against the same empty database.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:lock))', {
      replacements: { lock: 'tianwang.bootstrap-admin' }, transaction
    });
    const existing = await models.User.findOne({ where: { username }, transaction });
    if (existing) {
      if (existing.role !== 'super_admin' || !existing.organization_id) {
        throw new Error('Bootstrap username belongs to an existing non-administrator account');
      }
      return;
    }
    const [organization] = await models.Organization.findOrCreate({
      where: { slug: 'tianwang' },
      defaults: { name: '天网', status: 'active' },
      transaction
    });
    await models.User.create({
      username, email, password_hash: password, full_name: '管理员',
      role: 'super_admin', organization_id: organization.id, status: 'active'
    }, { transaction });
  });
};

module.exports = { bootstrapAdmin };
