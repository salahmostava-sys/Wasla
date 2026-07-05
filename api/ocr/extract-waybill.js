/**
 * POST /api/ocr/extract-waybill
 *
 * Receives a multipart/form-data image upload and returns the extracted text
 * using Google Cloud Vision API (Document Text Detection).
 *
 * Environment variables required (set in Vercel project settings):
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON  — full JSON string of the service account key
 */

const { ensurePostRequest, logError } = require('../_lib');

// ─── Google Vision helper ──────────────────────────────────────────────────────

async function detectTextViaVisionApi(imageBase64) {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error(
      'Google Vision not configured: GOOGLE_APPLICATION_CREDENTIALS_JSON env var is missing.',
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON.');
  }

  const accessToken = await getGoogleAccessToken(credentials);

  const response = await fetch(
    'https://vision.googleapis.com/v1/images:annotate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Vision API error ${response.status}: ${errBody}`);
  }

  const json = await response.json();
  const annotation = json.responses?.[0]?.fullTextAnnotation;
  return annotation?.text ?? '';
}

/**
 * Obtain a short-lived Google OAuth2 access token via JWT (RS256).
 */
async function getGoogleAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
  };

  const header = { alg: 'RS256', typ: 'JWT' };
  const b64u = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const signingInput = `${b64u(header)}.${b64u(payload)}`;

  const { createSign, createPrivateKey } = await import('node:crypto');

  // Aggressively reformat the private key to ensure it's a valid PEM
  let privateKeyStr = credentials.private_key || '';
  if (privateKeyStr.includes('BEGIN PRIVATE KEY')) {
    const b64 = privateKeyStr
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\\n/g, '')
      .replace(/\s+/g, '');
    const chunks = b64.match(/.{1,64}/g) || [];
    privateKeyStr = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;
  }

  // createPrivateKey() properly parses the PEM key — required for Node 18+ / OpenSSL 3.x
  const privateKey = createPrivateKey(privateKeyStr);
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signingInput}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const errBody = await tokenResp.text();
    throw new Error(`Google token exchange failed: ${errBody}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

// ─── Multipart parser ─────────────────────────────────────────────────────────

function parseMultipartFile(body, contentType) {
  const boundaryMatch = /boundary=([^\s;]+)/.exec(contentType);
  if (!boundaryMatch) throw new Error('No boundary in Content-Type');

  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const nl = Buffer.from('\r\n');
  const headerEnd = Buffer.from('\r\n\r\n');

  let start = 0;
  while (start < body.length) {
    const boundaryIdx = body.indexOf(boundary, start);
    if (boundaryIdx === -1) break;

    const afterBoundary = boundaryIdx + boundary.length;
    if (body[afterBoundary] === 0x2d && body[afterBoundary + 1] === 0x2d) break;

    const headerStart = afterBoundary + nl.length;
    const headerEndIdx = body.indexOf(headerEnd, headerStart);
    if (headerEndIdx === -1) break;

    const headerText = body.slice(headerStart, headerEndIdx).toString('utf8');
    const fileStart = headerEndIdx + headerEnd.length;

    const nextBoundaryIdx = body.indexOf(boundary, fileStart);
    if (nextBoundaryIdx === -1) break;

    const fileEnd = nextBoundaryIdx - nl.length;

    if (/filename=/i.test(headerText)) {
      return body.slice(fileStart, fileEnd);
    }

    start = nextBoundaryIdx;
  }

  throw new Error('No file field found in multipart body');
}

// ─── Vercel handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (!ensurePostRequest(req, res)) return;

  try {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const rawBody = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] ?? '';
    const fileBuffer = parseMultipartFile(rawBody, contentType);
    const imageBase64 = fileBuffer.toString('base64');

    const text = await detectTextViaVisionApi(imageBase64);
    return res.status(200).json({ success: true, text });
  } catch (err) {
    logError('[ocr/extract-waybill] error', { message: err.message });
    return res.status(500).json({
      success: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
};
