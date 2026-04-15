const errorHandler = (err, req, res, next) => {
  console.error(err)
  const status = err.status || 500
  const isDatabaseError = err?.name === 'SequelizeDatabaseError' || /unknown column/i.test(err?.message || '')
  const message = isDatabaseError
    ? 'Unable to load data from the database. Please refresh or contact support.'
    : err?.message || 'Internal Server Error'
  res.status(status).json({ message })
}

export default errorHandler
