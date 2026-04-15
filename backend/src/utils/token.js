import jwt from 'jsonwebtoken'

const ACCESS_TTL = '15m'
const REFRESH_TTL = '7d'

const accessSecret = process.env.JWT_SECRET || 'dev_secret'
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_refresh'

export const signAccessToken = (payload, opts = {}) => jwt.sign(payload, accessSecret, { expiresIn: ACCESS_TTL, ...opts })
export const signRefreshToken = (payload, opts = {}) => jwt.sign(payload, refreshSecret, { expiresIn: REFRESH_TTL, ...opts })

export const verifyToken = (token, isRefresh = false) => jwt.verify(token, isRefresh ? refreshSecret : accessSecret)
