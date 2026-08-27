const config = require('../../config');
const keyManagementService = require('../KeyManagementService');

describe('KeyManagementService security defaults', () => {
  test('does not rotate task-signing keys without coordinated node key refresh', () => {
    expect(config.keyManagement.rotationEnabled).toBe(false);
    keyManagementService.rotationTimer = null;
    keyManagementService.startKeyRotation();
    expect(keyManagementService.rotationTimer).toBeNull();
  });
});
