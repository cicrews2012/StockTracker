#!/usr/bin/env node
// Zero-dependency local server for StockTracker.
//
//   node server.js            → http://localhost:8080
//   PORT=3000 node server.js  → custom port
//
// 1. Serves the static app (index.html, src/…).
// 2. Proxies /proxy/alpaca/* → https://data.alpaca.markets/* because Alpaca's
//    data API does not allow browser (CORS) requests. API keys arrive as request
//    headers from your browser and are forwarded as-is; this server never logs
//    or stores them.
//
// It binds to 127.0.0.1 only, so nothing on your network can use the proxy.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const ALPACA_DATA = 'https://data.alpaca.markets';
// Only these upstream paths may be proxied.
const ALPACA_ALLOWED = [/^\/v1\/corporate-actions$/, /^\/v1beta1\/corporate-actions$/];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/proxy/alpaca/')) return await proxyAlpaca(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return await serveStatic(res, url.pathname, req.method === 'HEAD');
  } catch (err) {
    console.error(err);
    send(res, 500, 'Internal server error');
  }
});

async function proxyAlpaca(req, res, url) {
  if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
  const upstreamPath = url.pathname.slice('/proxy/alpaca'.length);
  if (!ALPACA_ALLOWED.some((re) => re.test(upstreamPath))) return send(res, 403, 'Path not allowed by proxy');

  const keyId = req.headers['apca-api-key-id'];
  const secret = req.headers['apca-api-secret-key'];
  if (!keyId || !secret) return send(res, 401, 'Missing Alpaca key headers');

  let upstream;
  try {
    upstream = await fetch(ALPACA_DATA + upstreamPath + url.search, {
      headers: { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secret, Accept: 'application/json' },
    });
  } catch (err) {
    return send(res, 502, `Could not reach Alpaca: ${err.message}`);
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function serveStatic(res, pathname, headOnly) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = normalize(join(ROOT, rel));
  // Block path traversal and dotfiles (.git, .env, …).
  if (!filePath.startsWith(ROOT + sep) || rel.split('/').some((p) => p.startsWith('.'))) {
    return send(res, 403, 'Forbidden');
  }
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return send(res, 404, 'Not found');
  }
  if (info.isDirectory()) return serveStatic(res, pathname.replace(/\/?$/, '/'), headOnly);
  const data = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(headOnly ? undefined : data);
}

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

server.listen(PORT, HOST, () => {
  console.log(`StockTracker running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
