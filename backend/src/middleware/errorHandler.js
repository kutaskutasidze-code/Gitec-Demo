function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);
  console.error(err.stack);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = errorHandler;
