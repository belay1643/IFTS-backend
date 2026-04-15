import crypto from 'crypto'

// Double-submit cookie CSRF protection
const csrf = (req, res, next) => {
  // issue token if missing
  if (!req.cookies.csrfToken) {
    const token = crypto.randomBytes(24).toString('hex')
    res.cookie('csrfToken', token, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    })
  }

  const method = req.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next()

  const sent = req.headers['x-csrf-token']
  const cookie = req.cookies.csrfToken
  if (!sent || !cookie || sent !== cookie) {
    return res.status(403).json({ message: 'Invalid CSRF token' })
  }
  return next()
}

export default csrf
