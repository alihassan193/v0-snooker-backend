/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the user
 *         username:
 *           type: string
 *           description: The username of the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         role:
 *           type: string
 *           enum: [super_admin, sub_admin, manager]
 *           description: The role of the user
 */

const authJwt = require("../middleware/auth")
const controller = require("../controllers/auth.controller")
const { validateSignup, validateSignin } = require("../middleware/validation")
const rateLimit = require("express-rate-limit")

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = (app) => {
  /**
   * @swagger
   * /api/auth/signup:
   *   post:
   *     summary: Register a new user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - email
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [super_admin, sub_admin, manager]
   *     responses:
   *       201:
   *         description: User registered successfully
   *       400:
   *         description: Validation error
   *       409:
   *         description: User already exists
   */
  app.post("/api/auth/signup", [authLimiter, validateSignup], controller.signup)

  /**
   * @swagger
   * /api/auth/signin:
   *   post:
   *     summary: Login user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *       401:
   *         description: Invalid credentials
   */
  app.post("/api/auth/signin", [authLimiter, validateSignin], controller.signin)

  app.post("/api/auth/refresh-token", authLimiter, controller.refreshToken)
  app.post("/api/auth/logout", [authJwt.verifyToken], controller.logout)
  app.get("/api/auth/me", [authJwt.verifyToken], controller.getCurrentUser)
  app.put("/api/auth/change-password", [authJwt.verifyToken], controller.changePassword)
}
