// Local server: serves static files on port 7788 AND proxies /dymo-api/* to DYMO service at 41951
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 7788;
const DYMO_PORT = 41951;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.label': 'text/xml', '.json': 'application/json',
};

http.createServer((req, res) => {
  // Proxy DYMO API calls — strips /dymo-api prefix and forwards to port 41951
  if (req.url.startsWith('/dymo-api/')) {
    const dymoPath = req.url.slice('/dymo-api'.length);
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const opts = {
        hostname: '127.0.0.1', port: DYMO_PORT,
        path: dymoPath, method: req.method,
        rejectUnauthorized: false,
        headers: {
          ...req.headers,
          host: 'localhost',
          origin: `https://localhost:${DYMO_PORT}`,
          referer: `https://localhost:${DYMO_PORT}/`,
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
      };
      const proxy = https.request(opts, (pr) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(pr.statusCode, pr.headers);
        pr.pipe(res);
      });
      proxy.on('error', e => { res.writeHead(502); res.end('DYMO proxy error: ' + e.message); });
      if (body.length) proxy.write(body);
      proxy.end();
    });
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(204); res.end(); return;
  }

  // Serve static files
  let filePath = path.join(DIR, req.url === '/' ? '/index.html' : req.url);
  // Strip query string
  filePath = filePath.split('?')[0];
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + filePath); return; }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200);
    res.end(data);
  });
}).listen(PORT, () => console.log(`Label printer server running at http://localhost:${PORT}`));
