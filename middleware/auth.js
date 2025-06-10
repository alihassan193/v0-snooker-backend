const jwt = require('jsonwebtoken')
const config = require('../config/auth.config.js')
const db = require('../models')
const User = db.users
const ClubManager = db.club_managers

// Verify JWT Token
const verifyToken = (req, res, next) => {
  let token = req.headers['x-access-token'] || req.headers['authorization']
  console.log('Auth Token is = ', token)
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7, token.length)
  }

  if (!token) {
    return res.status(403).send({
      message: 'No token provided!',
    })
  }

  jwt.verify(token, config.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: 'Unauthorized!',
      })
    }
    req.userId = decoded.id

    // Get user with role
    const user = await User.findByPk(req.userId)
    if (!user) {
      return res.status(404).send({
        message: 'User not found!',
      })
    }

    if (!user.is_active) {
      return res.status(403).send({
        message: 'Account is inactive!',
      })
    }

    // Add user role to request
    req.userRole = user.role
    console.log(req.userRole)
    // If user is a manager, get their assigned club
    if (user.role === 'manager') {
      const clubManager = await ClubManager.findOne({
        where: { manager_id: user.id, is_active: true },
      })

      if (clubManager) {
        req.userClubId = clubManager.club_id
      }
    }

    next()
  })
}

// Check if user is admin (sub_admin or super_admin)
const isAdmin = (req, res, next) => {
  if (req.userRole === 'sub_admin' || req.userRole === 'super_admin') {
    next()
    return
  }

  res.status(403).send({
    message: 'Require Admin Role!',
  })
}

// Check if user is super admin
const isSuperAdmin = (req, res, next) => {
  if (req.userRole === 'super_admin') {
    next()
    return
  }

  res.status(403).send({
    message: 'Require Super Admin Role!',
  })
}

// Check if user is manager or admin
const isManagerOrAdmin = (req, res, next) => {
  // console.log(req)
  if (req.userRole === 'manager' || req.userRole === 'sub_admin' || req.userRole === 'super_admin') {
    next()
    return
  }

  res.status(403).send({
    message: 'Require Manager or Admin Role!',
  })
}

// Check if user can manage tables
const canManageTables = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: ['permissions'],
    })

    if (!user) {
      return res.status(404).send({
        message: 'User not found!',
      })
    }

    if (user.role === 'super_admin' || (user.permissions && user.permissions.can_manage_tables)) {
      next()
      return
    }

    res.status(403).send({
      message: 'Require table management permission!',
    })
  } catch (error) {
    res.status(500).send({
      message: 'Unable to validate user permission!',
    })
  }
}

// Check if user can manage canteen
const canManageCanteen = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: ['permissions'],
    })

    if (!user) {
      return res.status(404).send({
        message: 'User not found!',
      })
    }

    if (user.role === 'super_admin' || (user.permissions && user.permissions.can_manage_canteen)) {
      next()
      return
    }

    res.status(403).send({
      message: 'Require canteen management permission!',
    })
  } catch (error) {
    res.status(500).send({
      message: 'Unable to validate user permission!',
    })
    consol.error('Manage canteen', error)
  }
}

// Check if user can view reports
const canViewReports = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: ['permissions'],
    })

    if (!user) {
      return res.status(404).send({
        message: 'User not found!',
      })
    }

    if (user.role === 'super_admin' || (user.permissions && user.permissions.can_view_reports)) {
      next()
      return
    }

    res.status(403).send({
      message: 'Require report viewing permission!',
    })
  } catch (error) {
    res.status(500).send({
      message: 'Unable to validate user permission!',
    })
  }
}

const authJwt = {
  verifyToken,
  isAdmin,
  isSuperAdmin,
  isManagerOrAdmin,
  canManageTables,
  canManageCanteen,
  canViewReports,
}

module.exports = authJwt
