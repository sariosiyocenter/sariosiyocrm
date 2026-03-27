import http from 'http';
const PORT = 3006;

const server = http.createServer((req, res) => {
  console.log(`Raw request received: ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Raw http server ok' }));
});

server.listen(PORT, () => {
  console.log(`Raw HTTP server running on port ${PORT}`);
});
