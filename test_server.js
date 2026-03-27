import express from 'express';
const app = express();
const PORT = 3005;

app.get('/test', (req, res) => {
  console.log('Test request received');
  res.json({ message: 'Minimal server ok' });
});

app.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
});
