const db = require("../models")
const User = db.users
const Permission = db.permissions
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const config = require("../config/auth.config")
const { sendSuccess, sendError } = require("../utils/responseHelper")

exports.signup = async (req, res) => {
  try {
    const { username, email, password, role = "sub_admin", permissions } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [db.Sequelize.Op.or]: [{ username }, { email }],
      },
    })

    if (existingUser) {
      return sendError(res, "Username or email already exists", 409)
    }

    // Create user with transaction
    const result = await db.sequelize.transaction(async (t) => {
      const user = await User.create(
        {
          username,
          email,
          password: bcrypt.hashSync(password, 12), // Increased salt rounds
          role,
        },
        { transaction: t },
      )

      // Set default permissions based on role
      const defaultPermissions = {
        super_admin: {
          can_manage_tables: true,
          can_manage_canteen: true,
          can_view_reports: true,
        },
        sub_admin: {
          can_manage_tables: true,
          can_manage_canteen: true,
          can_view_reports: true,
        },
        manager: {
          can_manage_tables: false,
          can_manage_canteen: true,
          can_view_reports: false,
        },
      }

      await Permission.create(
        {
          user_id: user.id,
          ...(permissions || defaultPermissions[role]),
        },
        { transaction: t },
      )

      return user
    })

    sendSuccess(res, { id: result.id, username: result.username }, "User registered successfully", 201)
  } catch (err) {
    console.error("Signup error:", err)
    sendError(res, "Registration failed", 500)
  }
}

exports.signin = async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!password) {
      return sendError(res, "Password is required", 400)
    }

    // Find user by username or email
    const whereCondition = email ? { email } : { username }

    const user = await User.findOne({
      where: whereCondition,
      include: [
        {
          model: Permission,
          as: "permission",
        },
      ],
    })

    if (!user) {
      return sendError(res, "Invalid credentials", 401)
    }

    // Check if user is active
    if (!user.is_active) {
      return sendError(res, "Account is deactivated", 403)
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password)

    if (!passwordIsValid) {
      return sendError(res, "Invalid credentials", 401)
    }

    // Generate tokens
    const accessToken = jwt.sign({ id: user.id }, config.secret, {
      expiresIn: config.jwtExpiration,
    })

    const refreshToken = jwt.sign({ id: user.id }, config.refreshSecret, {
      expiresIn: config.jwtRefreshExpiration,
    })

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user.toJSON()

    sendSuccess(
      res,
      {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      },
      "Login successful",
    )
  } catch (err) {
    console.error("Signin error:", err)
    sendError(res, "Login failed", 500)
  }
}

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return sendError(res, "Refresh token is required", 403)
    }

    const decoded = jwt.verify(refreshToken, config.refreshSecret)

    // Verify user still exists and is active
    const user = await User.findByPk(decoded.id)
    if (!user || !user.is_active) {
      return sendError(res, "Invalid refresh token", 401)
    }

    const accessToken = jwt.sign({ id: decoded.id }, config.secret, {
      expiresIn: config.jwtExpiration,
    })

    sendSuccess(res, { accessToken }, "Token refreshed successfully")
  } catch (err) {
    console.error("Refresh token error:", err)
    sendError(res, "Invalid refresh token", 401)
  }
}

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: [Permission],
      attributes: { exclude: ["password"] },
    })

    if (!user) {
      return sendError(res, "User not found", 404)
    }

    sendSuccess(res, user, "User retrieved successfully")
  } catch (err) {
    console.error("Get current user error:", err)
    sendError(res, "Failed to retrieve user", 500)
  }
}

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    const user = await User.findByPk(req.userId)
    if (!user) {
      return sendError(res, "User not found", 404)
    }

    const passwordIsValid = bcrypt.compareSync(currentPassword, user.password)
    if (!passwordIsValid) {
      return sendError(res, "Current password is incorrect", 400)
    }

    user.password = bcrypt.hashSync(newPassword, 12)
    await user.save()

    sendSuccess(res, null, "Password changed successfully")
  } catch (err) {
    console.error("Change password error:", err)
    sendError(res, "Failed to change password", 500)
  }
}

exports.logout = async (req, res) => {
  try {
    // In a real implementation, you might want to blacklist the token
    // For now, just send success response
    sendSuccess(res, null, "Logged out successfully")
  } catch (err) {
    console.error("Logout error:", err)
    sendError(res, "Logout failed", 500)
  }
}
