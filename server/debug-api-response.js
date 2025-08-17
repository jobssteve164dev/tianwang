const express = require('express');
const app = express();
const port = 3001;

// 模拟注册码数据
const mockRegistrationCodes = [
  {
    code: 'TW-A1521C4757CBB4EAA79CE0BB027ECD05',
    status: 'active',
    permissions: ['basic'],
    description: '',
    createdBy: 'admin',
    createdAt: '2025-08-14T00:10:26.953Z',
    expiry: 1755101426953,
    usedCount: 63,
    maxUses: 1000,
    remainingUses: 937
  },
  {
    code: 'TW-A599AE6B1F194F65B79C936178B77772',
    status: 'exhausted',
    permissions: ['basic'],
    description: '',
    createdBy: 'admin',
    createdAt: '2025-08-14T00:04:13.500Z',
    expiry: 1755101053500,
    usedCount: 1,
    maxUses: 1,
    remainingUses: 0
  }
];

app.use(express.json());

app.get('/api/agents/registration-codes', (req, res) => {
  console.log('📡 API Request received');
  console.log('Query params:', req.query);
  
  const response = {
    success: true,
    data: {
      codes: mockRegistrationCodes,
      count: mockRegistrationCodes.length
    }
  };
  
  console.log('📤 API Response:');
  console.log(JSON.stringify(response, null, 2));
  
  res.json(response);
});

app.listen(port, () => {
  console.log(`🔧 Debug API server running on port ${port}`);
  console.log(`📊 Test data:`);
  mockRegistrationCodes.forEach((code, index) => {
    console.log(`\n${index + 1}. Code: ${code.code}`);
    console.log(`   Expiry timestamp: ${code.expiry}`);
    console.log(`   Expiry date: ${new Date(code.expiry).toISOString()}`);
    console.log(`   Created: ${code.createdAt}`);
    console.log(`   Status: ${code.status}`);
  });
});
