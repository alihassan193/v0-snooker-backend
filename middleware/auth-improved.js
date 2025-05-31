const jwt = require("jsonwebtoken")
const config = require("../config/auth.config")
const db = require("../models")
const User = db.users
const { sendError } = require("../utils/responseHelper")

const verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"] || req.headers["authorization"]

  // Handle Bearer token format
  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7, token.length)
  }

  if (!token) {
    return sendError(res, "Access token is required", 403)
  }

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return sendError(res, "Token has expired", 401)
      }
      if (err.name === "JsonWebTokenError") {
        return sendError(res, "Invalid token", 401)
      }
      return sendError(res, "Token verification failed", 401)
    }

    req.userId = decoded.id
    next()
  })
}

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)

    if (!user) {
      return sendError(res, "User not found", 404)
    }

    if (!user.is_active) {
      return sendError(res, "Account is deactivated", 403)
    }

    if (user.role === "super_admin" || user.role === "sub_admin") {
      req.userRole = user.role // Store role for later use
      return next()
    }

    return sendError(res, "Admin access required", 403)
  } catch (err) {
    console.error("Auth middleware error:", err)
    return sendError(res, "Authentication failed", 500)
  }
}

const isSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)

    if (!user) {
      return sendError(res, "User not found", 404)
    }

    if (!user.is_active) {
      return sendError(res, "Account is deactivated", 403)
    }

    if (user.role === "super_admin") {
      req.userRole = user.role
      return next()
    }

    return sendError(res, "Super admin access required", 403)
  } catch (err) {
    console.error("Super admin middleware error:", err)
    return sendError(res, "Authentication failed", 500)
  }
}

const isManager = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId)

    if (!user) {
      return sendError(res, "User not found", 404)
    }

    if (!user.is_active) {
      return sendError(res, "Account is deactivated", 403)
    }

    if (["super_admin", "sub_admin", "manager"].includes(user.role)) {
      req.userRole = user.role
      return next()
    }

    return sendError(res, "Manager access or higher required", 403)
  } catch (err) {
    console.error("Manager middleware error:", err)
    return sendError(res, "Authentication failed", 500)
  }
}

const authJwt = {
  verifyToken,
  isAdmin,
  isSuperAdmin,
  isManager,
}

module.exports = authJwt
