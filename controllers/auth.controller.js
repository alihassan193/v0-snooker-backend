const db = require('../models')
const User = db.users
const Permission = db.permissions
const Club = db.club_managers
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const config = require('../config/auth.config')
const { sendSuccess, sendError } = require('../utils/responseHelper')
const logger = require('../utils/logger')

exports.signup = async (req, res) => {
  try {
    const { username, email, password, role = 'sub_admin', permissions } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [db.Sequelize.Op.or]: [{ username }, { email }],
      },
    })

    if (existingUser) {
      return sendError(res, 'Username or email already exists', 409)
    }

    // Create user with transaction
    const result = await db.sequelize.transaction(async t => {
      const user = await User.create(
        {
          username,
          email,
          password: bcrypt.hashSync(password, 12),
          role,
        },
        { transaction: t }
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
        { transaction: t }
      )

      return user
    })

    logger.info(`User registered: ${result.username}`)
    sendSuccess(res, { id: result.id, username: result.username }, 'User registered successfully', 201)
  } catch (err) {
    logger.error('Signup error:', err)
    sendError(res, 'Registration failed', 500)
  }
}
exports.signin = async (req, res) => {
  try {
    const { email, username, password } = req.body

    // Input validation
    if (!password) {
      return sendError(res, 'Password is required', 400)
    }
    if (!email && !username) {
      return sendError(res, 'Email or username is required', 400)
    }

    // Find user with appropriate includes
    const whereCondition = username ? { username } : { email }
    const user = await db.users.findOne({
      where: whereCondition,
      include: [
        {
          model: db.permissions,
          as: 'permissions',
        },
        {
          model: db.club_managers,
          as: 'managed_clubs',
          include: [
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'],
            },
          ],
          required: false,
        },
      ],
    })

    if (!user) {
      return sendError(res, 'Invalid credentials', 401)
    }

    // Check account status
    if (!user.is_active) {
      return sendError(res, 'Account is deactivated', 403)
    }

    // Verify password
    const passwordIsValid = await bcrypt.compare(password, user.password)
    if (!passwordIsValid) {
      return sendError(res, 'Invalid credentials', 401)
    }

    // Get the club for managers (assuming one manager per club)
    const managerClub = user.managed_clubs && user.managed_clubs.length > 0 ? user.managed_clubs[0].club : null

    // Prepare token payload
    const tokenPayload = {
      id: user.id,
      role: user.role,
      ...(user.role === 'manager' && managerClub && { club_id: managerClub.id }),
    }

    // Generate tokens
    const accessToken = jwt.sign(tokenPayload, config.secret, {
      expiresIn: config.jwtExpiration,
    })

    const refreshToken = jwt.sign(tokenPayload, config.refreshSecret, {
      expiresIn: config.jwtRefreshExpiration,
    })

    // Prepare user data response
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      permissions: user.permissions,
      ...(user.role === 'manager' && {
        club: managerClub,
      }),
    }

    logger.info(`User logged in: ${user.username || user.email}`)
    sendSuccess(
      res,
      {
        user: userData,
        accessToken,
        refreshToken,
      },
      'Login successful'
    )
  } catch (err) {
    logger.error('Signin error:', err)
    sendError(res, 'Login failed', 500, process.env.NODE_ENV === 'development' ? err.message : undefined)
  }
}
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 403)
    }

    const decoded = jwt.verify(refreshToken, config.refreshSecret)

    // Verify user still exists and is active
    const user = await User.findByPk(decoded.id)
    if (!user || !user.is_active) {
      return sendError(res, 'Invalid refresh token', 401)
    }

    const accessToken = jwt.sign({ id: decoded.id }, config.secret, {
      expiresIn: config.jwtExpiration,
    })

    sendSuccess(res, { accessToken }, 'Token refreshed successfully')
  } catch (err) {
    logger.error('Refresh token error:', err)
    sendError(res, 'Invalid refresh token', 401)
  }
}

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await db.users.findByPk(req.userId, {
      include: [
        {
          model: db.permissions,
          as: 'permissions',
        },
        {
          model: db.club_managers,
          as: 'managed_clubs',
          include: [
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'], // Include club details
            },
          ],
          required: false,
        },
      ],
      attributes: { exclude: ['password'] },
    })

    if (!user) {
      return sendError(res, 'User not found', 404)
    }

    const userData = user.toJSON()

    // For managers, add club information to response
    if (req.userRole === 'manager' && userData.managed_clubs && userData.managed_clubs.length > 0) {
      // Assuming one manager manages one club (adjust if multiple clubs possible)
      userData.club = userData.managed_clubs[0].club
      userData.club_id = userData.club.id
    }

    // Remove the intermediate association data if needed
    delete userData.managed_clubs

    sendSuccess(res, userData, 'User retrieved successfully')
  } catch (err) {
    logger.error('Get current user error:', err)
    sendError(res, 'Failed to retrieve user', 500)
  }
}
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    const user = await User.findByPk(req.userId)
    if (!user) {
      return sendError(res, 'User not found', 404)
    }

    const passwordIsValid = bcrypt.compareSync(currentPassword, user.password)
    if (!passwordIsValid) {
      return sendError(res, 'Current password is incorrect', 400)
    }

    user.password = bcrypt.hashSync(newPassword, 12)
    await user.save()

    logger.info(`Password changed for user: ${user.username}`)
    sendSuccess(res, null, 'Password changed successfully')
  } catch (err) {
    logger.error('Change password error:', err)
    sendError(res, 'Failed to change password', 500)
  }
}

exports.logout = async (req, res) => {
  try {
    // In a real implementation, you might want to blacklist the token
    sendSuccess(res, null, 'Logged out successfully')
  } catch (err) {
    logger.error('Logout error:', err)
    sendError(res, 'Logout failed', 500)
  }
}
