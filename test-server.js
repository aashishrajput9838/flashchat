// Simple test server to check if Railway can route requests correctly
import express from 'express';

const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ message: 'Test server is running', port: port });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: port });
});

app.listen(port, () => {
  console.log(`Test server running on port ${port}`);
});