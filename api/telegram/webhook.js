const { setCors } = require('../_lib');
const { telegramWebhookHandler } = require('../_telegramWebhook');

module.exports = async function handler(req, res) {
  const corsOk = setCors(req, res);
  if (corsOk === false) return;
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  return telegramWebhookHandler(req, res);
};
