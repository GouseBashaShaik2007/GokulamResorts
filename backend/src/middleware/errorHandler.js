// Central error handler. Keeps error shape consistent across the API and
// avoids leaking stack traces / internals in production responses.
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Upload problems (file too large, too many files) are the client's to fix.
  if (err.name === 'MulterError') {
    err.statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'File is too large (max 5 MB)';
  }
  if (!err.statusCode || err.statusCode >= 500) console.error(err);

  const status = err.statusCode || 500;
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(status).json({ success: false, message });
}

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { notFound, errorHandler, ApiError };
