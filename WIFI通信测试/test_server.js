const http = require('http');

const PORT = Number(process.env.PORT || 3000);

const state = {
  requestCount: 0,
  lastHeartbeat: null,
  lastRawBody: '',
  startedAt: new Date().toISOString(),
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  state.requestCount += 1;
  const requestTime = new Date().toISOString();

  if (req.method === 'GET' && req.url === '/ping') {
    return sendJson(res, 200, {
      ok: true,
      message: 'pong',
      time: requestTime,
      requestCount: state.requestCount,
    });
  }

  if (req.method === 'GET' && req.url === '/api/status') {
    return sendJson(res, 200, {
      ok: true,
      startedAt: state.startedAt,
      requestCount: state.requestCount,
      lastHeartbeat: state.lastHeartbeat,
    });
  }

  if (req.method === 'GET' && req.url === '/api/last') {
    return sendJson(res, 200, {
      ok: true,
      lastHeartbeat: state.lastHeartbeat,
      lastRawBody: state.lastRawBody,
    });
  }

  if (req.method === 'POST' && req.url === '/api/report') {
    try {
      const rawBody = await collectRequestBody(req);
      state.lastRawBody = rawBody;
      state.lastHeartbeat = rawBody ? JSON.parse(rawBody) : null;

      console.log(`[${requestTime}] heartbeat received`);
      console.log(state.lastHeartbeat);

      return sendJson(res, 200, {
        ok: true,
        receivedAt: requestTime,
        requestCount: state.requestCount,
      });
    } catch (error) {
      console.error(`[${requestTime}] invalid JSON`, error.message);
      return sendJson(res, 400, {
        ok: false,
        error: 'Invalid JSON body',
        detail: error.message,
      });
    }
  }

  return sendJson(res, 404, {
    ok: false,
    error: 'Route not found',
    method: req.method,
    url: req.url,
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WiFi test server listening on http://0.0.0.0:${PORT}`);
  console.log('GET  /ping');
  console.log('GET  /api/status');
  console.log('GET  /api/last');
  console.log('POST /api/report');
});
