const express = require('express');
const router = express.Router();
let rulesRouter;
router.use(async (req, res, next) => {
  rulesRouter ||= (await import('../core/rule-routes.js')).default;
  rulesRouter(req, res, next);
});

module.exports = router;
