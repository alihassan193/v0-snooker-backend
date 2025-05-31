const { authJwt } = require("../middleware/auth")
const controller = require("../controllers/auth.controller")
const { validateSignup, validateSignin } = require("../middleware/validation")
const rateLimit = require("express-rate-limit")

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = (app) => {
  // Remove individual CORS headers - handled globally now

  app.post("/api/auth/signup", [authLimiter, validateSignup], controller.signup)
  app.post("/api/auth/signin", [authLimiter, validateSignin], controller.signin)
  app.post("/api/auth/refresh-token", authLimiter, controller.refreshToken)

  // New endpoints
  app.post("/api/auth/logout", [authJwt.verifyToken], controller.logout)
  app.get("/api/auth/me", [authJwt.verifyToken], controller.getCurrentUser)
  app.put("/api/auth/change-password", [authJwt.verifyToken], controller.changePassword)
}
