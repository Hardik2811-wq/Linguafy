export function notFound(_req, res) { res.status(404).json({ success: false, error: 'Endpoint not found.' }); }
export function errorHandler(error, _req, res, _next) {
  console.error(error);
  const isUpstream = Boolean(error.headers || error.error);
  const status = isUpstream ? 502 : (Number(error.status) >= 400 ? error.status : 500);
  const message = isUpstream ? `The AI service failed. ${error.message || 'Please try again.'}` : (error.message || 'Something went wrong. Please try again.');
  res.status(status).json({ success: false, error: message });
}
