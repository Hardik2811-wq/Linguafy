export function notFound(_req, res) { res.status(404).json({ success: false, error: 'Endpoint not found.' }); }
export function errorHandler(error, _req, res, _next) {
  console.error(error);
  res.status(error.status || 500).json({ success: false, error: error.message || 'Something went wrong. Please try again.' });
}
