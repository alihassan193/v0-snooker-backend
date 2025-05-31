const crypto = require("crypto")

// Generate a strong secret if none provided (for development only)
const generateSecret = () => {
  return crypto.randomBytes(64).toString("hex")
}

// Validate JWT secrets
const validateSecrets = () => {
  const secret = process.env.JWT_SECRET
  const refreshSecret = process.env.JWT_REFRESH_SECRET

  if (!secret || secret === "your_jwt_secret_key" || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to a strong secret in production")
    }
    console.warn("⚠️  Using weak JWT secret. Please set a strong JWT_SECRET in production")
  }

  if (!refreshSecret || refreshSecret === "your_jwt_refresh_secret_key" || refreshSecret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_REFRESH_SECRET must be set to a strong secret in production")
    }
    console.warn("⚠️  Using weak JWT refresh secret. Please set a strong JWT_REFRESH_SECRET in production")
  }
}

// Validate secrets on module load
validateSecrets()

module.exports = {
  secret: process.env.JWT_SECRET || generateSecret(),
  refreshSecret: process.env.JWT_REFRESH_SECRET || generateSecret(),
  jwtExpiration: process.env.JWT_EXPIRE || "24h",
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRE || "7d",

  // Additional security settings
  issuer: process.env.JWT_ISSUER || "snooker-management-system",
  audience: process.env.JWT_AUDIENCE || "snooker-users",

  // Algorithm settings
  algorithm: "HS256",

  // Token settings
  clockTolerance: 30, // 30 seconds clock tolerance
}
