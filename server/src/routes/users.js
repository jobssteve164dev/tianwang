const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const models = require('../models');
const logger = require('../utils/logger');

const editableFields = ['email', 'full_name', 'role', 'status', 'organization_id', 'preferences'];

function databaseUnavailable(res) {
  return res.status(503).json({ success: false, message: '用户数据库不可用' });
}

function canManageRole(actor, requestedRole) {
  return !requestedRole || requestedRole !== 'super_admin' || actor.role === 'super_admin';
}

// GET /api/users - 获取用户列表
router.get('/', authenticate, authorize(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!models.User) return databaseUnavailable(res);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));
    const where = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.search) {
      where[Op.or] = [
        { username: { [Op.iLike]: `%${req.query.search}%` } },
        { email: { [Op.iLike]: `%${req.query.search}%` } },
        { full_name: { [Op.iLike]: `%${req.query.search}%` } }
      ];
    }
    const { rows, count } = await models.User.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['createdAt', 'DESC']]
    });
    res.json({
      success: true,
      users: rows,
      pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) }
    });
  } catch (error) {
    logger.error('获取用户列表失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// GET /api/users/:id - 获取用户详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (!models.User) return databaseUnavailable(res);
    if (req.user.id !== req.params.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: '无权查看该用户' });
    }
    const user = await models.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({ success: true, user });
  } catch (error) {
    logger.error('获取用户详情失败', { error: error.message });
    res.status(500).json({ success: false, message: '获取用户详情失败' });
  }
});

// POST /api/users - 创建用户
router.post('/', authenticate, authorize(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!models.User) return databaseUnavailable(res);
    const { username, email, password, full_name, role = 'viewer', status = 'active', organization_id } = req.body;
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ success: false, message: '用户名、邮箱、密码和姓名不能为空' });
    }
    if (!canManageRole(req.user, role)) {
      return res.status(403).json({ success: false, message: '无权授予超级管理员角色' });
    }
    const user = await models.User.create({
      username,
      email,
      password_hash: password,
      full_name,
      role,
      status,
      organization_id: organization_id || req.user.organization_id || null
    });
    res.status(201).json({ success: true, user });
  } catch (error) {
    const status = error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError' ? 400 : 500;
    logger.error('创建用户失败', { error: error.message });
    res.status(status).json({ success: false, message: status === 400 ? '用户信息无效或已存在' : '创建用户失败' });
  }
});

async function updateUser(req, res) {
  try {
    if (!models.User) return databaseUnavailable(res);
    if (!canManageRole(req.user, req.body.role)) {
      return res.status(403).json({ success: false, message: '无权授予超级管理员角色' });
    }
    const user = await models.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: '无权修改超级管理员' });
    }
    const changes = {};
    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) changes[field] = req.body[field];
    }
    if (req.body.password) changes.password_hash = req.body.password;
    await user.update(changes);
    res.json({ success: true, user });
  } catch (error) {
    const status = error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError' ? 400 : 500;
    logger.error('更新用户失败', { error: error.message });
    res.status(status).json({ success: false, message: status === 400 ? '用户信息无效或已存在' : '更新用户失败' });
  }
}

router.put('/:id', authenticate, authorize(['admin', 'super_admin']), updateUser);
router.patch('/:id', authenticate, authorize(['admin', 'super_admin']), updateUser);

router.delete('/:id', authenticate, authorize(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!models.User) return databaseUnavailable(res);
    if (req.user.id === req.params.id) {
      return res.status(400).json({ success: false, message: '不能删除当前登录用户' });
    }
    const user = await models.User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: '无权删除超级管理员' });
    }
    await user.destroy();
    res.status(204).end();
  } catch (error) {
    logger.error('删除用户失败', { error: error.message });
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

module.exports = router;
