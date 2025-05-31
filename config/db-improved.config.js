const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_NAME"]

// Validate required environment variables
const validateEnvVars = () => {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }
}

// Validate environment variables on module load
validateEnvVars()

const config = {
  HOST: process.env.DB_HOST,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD || "",
  DB: process.env.DB_NAME,
  dialect: "mysql",

  // Connection pool settings
  pool: {
    max: Number.parseInt(process.env.DB_POOL_MAX) || 10,
    min: Number.parseInt(process.env.DB_POOL_MIN) || 0,
    acquire: Number.parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
    idle: Number.parseInt(process.env.DB_POOL_IDLE) || 10000,
  },

  // Logging settings
  logging: process.env.NODE_ENV === "development" ? console.log : false,

  // Timezone settings
  timezone: process.env.DB_TIMEZONE || "+00:00",

  // SSL settings for production
  dialectOptions: {
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            require: true,
            rejectUnauthorized: false, // Set to true in production with proper certificates
          }
        : false,

    // Connection timeout
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
  },

  // Additional options
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
  },

  // Retry settings
  retry: {
    max: 3,
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ESOCKETTIMEDOUT/,
      /EHOSTUNREACH/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
    ],
  },
}

module.exports = config
