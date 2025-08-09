const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TianWang Test Server Running' });
});

app.listen(8000, () => {
  console.log('Server running on http://localhost:8000');
}); 