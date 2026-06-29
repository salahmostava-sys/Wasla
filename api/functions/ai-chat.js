const { ensurePostRequest } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!ensurePostRequest(req, res)) return;
  const { aiChatHandler } = await import('../../server/lib/handlers.js');
  return aiChatHandler(req, res);
};
