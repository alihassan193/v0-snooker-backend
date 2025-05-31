const path = require("path")

// Load environment variables
require("dotenv").config()

const environment = {
  // Server settings
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number.parseInt(process.env.PORT) || 5000,

  // Security settings
  BCRYPT_ROUNDS: Number.parseInt(process.env.BCRYPT_ROUNDS) || 12,

  // CORS settings
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:5173"],

  // Rate limiting
  RATE_LIMIT: {
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    authMax: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  },

  // File upload settings
  UPLOAD: {
    maxFileSize: Number.parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    uploadPath: process.env.UPLOAD_PATH || path.join(__dirname, "../uploads"),
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  },

  // Logging settings
  LOGGING: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || path.join(__dirname, "../logs/app.log"),
  },

  // Email settings (for future features)
  EMAIL: {
    host: process.env.EMAIL_HOST,
    port: Number.parseInt(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
  },

  // Feature flags
  FEATURES: {
    enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === "true",
    enableFileUploads: process.env.ENABLE_FILE_UPLOADS === "true",
    enableRealTimeUpdates: process.env.ENABLE_REALTIME_UPDATES === "true",
  },
}

// Validation for production
if (environment.NODE_ENV === "production") {
  const requiredProdVars = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DB_HOST", "DB_USER", "DB_NAME"]

  const missing = requiredProdVars.filter((envVar) => !process.env[envVar])

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`)
  }

  // Validate JWT secrets strength in production
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production")
  }

  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    throw new Error("JWT_REFRESH_SECRET must be at least 32 characters in production")
  }
}

module.exports = environment
