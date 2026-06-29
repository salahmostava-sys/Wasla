const { ensurePostRequest } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!ensurePostRequest(req, res)) return;
  const { groqChatHandler } = await import('../../server/lib/handlers.js');
  return groqChatHandler(req, res);
};
