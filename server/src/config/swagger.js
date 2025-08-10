/**
 * Swagger配置
 * Swagger Configuration
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./index');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TianWang Security Monitoring API',
      version: config.app.version,
      description: 'AI驱动的网络安全监控系统API文档',
      contact: {
        name: 'TianWang Team',
        email: 'support@tianwang.com'
      }
    },
    servers: [
      {
        url: `http://${config.app.host}:${config.app.port}/api`,
        description: '开发服务器'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/models/*.js'
  ]
};

const specs = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'TianWang API Documentation'
  }));
}

module.exports = {
  setupSwagger,
  specs
};
