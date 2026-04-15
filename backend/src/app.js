import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './docs/swagger.js'
import apiRoutes from './routes/index.js'
import errorHandler from './middleware/errorHandler.js'

const app = express()

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true, credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(compression())
app.use(limiter)
app.use(morgan('dev'))

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use('/api', apiRoutes)
app.use(errorHandler)

export default app
