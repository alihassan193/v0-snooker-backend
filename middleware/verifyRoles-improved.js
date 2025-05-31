const db = require("../models")
const { sendError } = require("../utils/responseHelper")

const verifyPermissions = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = await db.users.findByPk(req.userId, {
        include: [
          {
            model: db.permissions,
            as: "permission",
          },
        ],
      })

      if (!user) {
        return sendError(res, "User not found", 404)
      }

      if (!user.is_active) {
        return sendError(res, "Account is deactivated", 403)
      }

      // Super admin has all permissions
      if (user.role === "super_admin") {
        req.userRole = user.role
        req.userPermissions = {
          can_manage_tables: true,
          can_manage_canteen: true,
          can_view_reports: true,
        }
        return next()
      }

      // Check specific permission
      if (user.permission && user.permission[requiredPermission]) {
        req.userRole = user.role
        req.userPermissions = user.permission
        return next()
      }

      return sendError(res, `${requiredPermission} permission required`, 403)
    } catch (err) {
      console.error("Permission verification error:", err)
      return sendError(res, "Permission verification failed", 500)
    }
  }
}

const verifyTableAccess = async (req, res, next) => {
  try {
    const user = await db.users.findByPk(req.userId, {
      include: [db.permissions],
    })

    if (!user || !user.is_active) {
      return sendError(res, "User not found or inactive", 404)
    }

    // Super admin and sub-admin have full access
    if (["super_admin", "sub_admin"].includes(user.role)) {
      return next()
    }

    // Managers can only access tables they're assigned to
    if (user.role === "manager") {
      const tableId = req.params.id || req.params.tableId
      if (tableId) {
        const table = await db.tables.findByPk(tableId)
        if (table && table.manager_id === user.id) {
          return next()
        }
        return sendError(res, "Access denied to this table", 403)
      }
    }

    return sendError(res, "Insufficient permissions", 403)
  } catch (err) {
    console.error("Table access verification error:", err)
    return sendError(res, "Access verification failed", 500)
  }
}

const verifyCanteenAccess = async (req, res, next) => {
  try {
    const user = await db.users.findByPk(req.userId, {
      include: [db.permissions],
    })

    if (!user || !user.is_active) {
      return sendError(res, "User not found or inactive", 404)
    }

    if (user.role === "super_admin" || (user.permission && user.permission.can_manage_canteen)) {
      return next()
    }

    return sendError(res, "Canteen management permission required", 403)
  } catch (err) {
    console.error("Canteen access verification error:", err)
    return sendError(res, "Access verification failed", 500)
  }
}

module.exports = {
  verifyPermissions,
  verifyTableAccess,
  verifyCanteenAccess,
}
