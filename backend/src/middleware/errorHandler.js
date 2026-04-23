const errorHandler = (err, req, res, next) => {
  const status = err.status || 500
  if (status >= 500) {
    console.error(err)
  } else if (status === 401 || status === 403) {
    console.warn(`${status} ${req.method} ${req.originalUrl}: ${err?.message || 'Unauthorized'}`)
  }
  const isDatabaseError = err?.name === 'SequelizeDatabaseError' || /unknown column/i.test(err?.message || '')
  const message = isDatabaseError
    ? 'Unable to load data from the database. Please refresh or contact support.'
    : err?.message || 'Internal Server Error'
  res.status(status).json({ message })
}

export default errorHandler
