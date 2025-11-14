const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ message: 'Simple server is running', port: port });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: port, timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Simple server listening on port ${port}`);
});