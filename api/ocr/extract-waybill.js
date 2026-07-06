/**
 * POST /api/ocr/extract-waybill
 *
 * Receives a multipart/form-data image upload and returns the extracted text
 * using Google Cloud Vision API (Document Text Detection).
 *
 * Environment variables required (set in Vercel project settings):
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON  — full JSON string of the service account key
 */

const { ensurePostRequest, requireAuth, getAdminClient, logError } = require('../_lib');

// 8 MB is generous for a single photographed document while still bounding
// memory/Vision-API spend per request. Requests over this are rejected
// before any Vision API call is made.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Lightweight local rate limiter (mirrors server/lib/handlers.js#checkRateLimit,
// duplicated here because this route is a standalone Vercel function that
// cannot import the ESM server handlers module).
async function checkRateLimit(supabaseClient, userId, action, limit, windowSeconds) {
  const key = `${action}_${userId}`;
  const { data, error } = await supabaseClient.rpc('enforce_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    logError('[ocr/extract-waybill] rate limit check failed — denying request (fail-closed)', {
      error: error.message,
    });
    return { allowed: false };
  }
  return data?.[0] ?? { allowed: true };
}

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
  if (!privateKeyStr || privateKeyStr.length < 50) {
    throw new Error('private_key is missing or too short in GOOGLE_APPLICATION_CREDENTIALS_JSON.');
  }

  if (privateKeyStr.includes('BEGIN')) {
    const b64 = privateKeyStr
      .replace(/-----BEGIN.*?-----/g, '')
      .replace(/-----END.*?-----/g, '')
      .replace(/\\n/g, '')
      .replace(/\s+/g, '');
    const chunks = b64.match(/.{1,64}/g) || [];
    privateKeyStr = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;
  } else {
    // If it has no headers at all, assume it's raw base64
    const b64 = privateKeyStr.replace(/\\n/g, '').replace(/\s+/g, '');
    const chunks = b64.match(/.{1,64}/g) || [];
    privateKeyStr = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;
  }

  let privateKey;
  try {
    // createPrivateKey() properly parses the PEM key — required for Node 18+ / OpenSSL 3.x
    privateKey = createPrivateKey(privateKeyStr);
  } catch (err) {
    throw new Error(`Failed to decode private key (length ${privateKeyStr.length}): ${err.message}`);
  }
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

  // FIX: this endpoint used to call a paid Google Vision API with no
  // authentication, no rate limit, and no upload size cap — any anonymous
  // caller who knew the URL could exhaust the Vision API quota/invoice or
  // DoS the function. It now requires a valid logged-in session and is
  // rate-limited, exactly like every other endpoint in this project.
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const adminClient = getAdminClient();
    const rl = await checkRateLimit(adminClient, auth.user.id, 'ocr_extract_waybill', 20, 60);
    if (!rl.allowed) {
      return res.status(429).json({ success: false, detail: 'Too many requests. Please wait before trying again.' });
    }

    const chunks = [];
    let totalBytes = 0;
    let tooLarge = false;
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_UPLOAD_BYTES) {
          tooLarge = true;
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', resolve);
      req.on('error', reject);
      req.on('close', () => {
        if (tooLarge) reject(new Error('PAYLOAD_TOO_LARGE'));
      });
    });
    if (tooLarge) {
      return res.status(413).json({ success: false, detail: 'Uploaded file is too large (max 8MB).' });
    }
    const rawBody = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] ?? '';
    const fileBuffer = parseMultipartFile(rawBody, contentType);
    const imageBase64 = fileBuffer.toString('base64');

    const text = await detectTextViaVisionApi(imageBase64);
    return res.status(200).json({ success: true, text });
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      return res.status(413).json({ success: false, detail: 'Uploaded file is too large (max 8MB).' });
    }
    logError('[ocr/extract-waybill] error', { message: err.message });
    return res.status(500).json({
      success: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
};
