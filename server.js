require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const swaggerUi = require('swagger-ui-express')
const swaggerJsdoc = require('swagger-jsdoc')

const app = express()

// Import middleware
const errorHandler = require('./middleware/errorHandler')
const logger = require('./utils/logger')

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

// Compression middleware
app.use(compression())

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(generalLimiter)

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://885eae61-4521-46c2-b697-0341d67b547b.lovableproject.com',
      ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
}

app.use(cors(corsOptions))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Snooker Management API',
      version: '1.0.0',
      description: 'Complete API for Snooker Club Management System',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./routes/*.js', './controllers/*.js'],
}

const specs = swaggerJsdoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))

// Database
const db = require('./models')

// // Environment-based database sync
// if (process.env.NODE_ENV === 'development') {
//   db.sequelize
//     .sync({ alter: true })
//     .then(async () => {
//       logger.info('Database synced successfully')

//       // Insert initial game types
//       await db.gameTypes.findOrCreate({
//         where: { id: 1 },
//         defaults: { name: 'Frames', pricing_type: 'fixed' },
//       })
//       await db.gameTypes.findOrCreate({
//         where: { id: 2 },
//         defaults: { name: 'Century', pricing_type: 'per_minute' },
//       })

//       // Insert initial canteen categories
//       await db.canteenCategories.findOrCreate({
//         where: { id: 1 },
//         defaults: { name: 'Beverages' },
//       })
//       await db.canteenCategories.findOrCreate({
//         where: { id: 2 },
//         defaults: { name: 'Snacks' },
//       })
//       await db.canteenCategories.findOrCreate({
//         where: { id: 3 },
//         defaults: { name: 'Meals' },
//       })
//     })
//     .catch(err => {
//       logger.error('Failed to sync database:', err.message)
//     })
// }

// Routes
require('./routes')(app)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  })
})

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Snooker Management System API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      clubs: '/api/clubs',
      players: '/api/players',
      tables: '/api/tables',
      sessions: '/api/sessions',
      canteen: '/api/canteen',
      invoices: '/api/invoices',
      reports: '/api/reports',
    },
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  })
})

// Set port, listen for requests
const PORT = process.env.PORT || 5000
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server is running on port ${PORT}`)
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`)
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`)
})

module.exports = app
