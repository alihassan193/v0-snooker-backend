const db = require("../models")
const User = db.users
const Permission = db.permissions
const AdminManagerAssociation = db.adminManagerAssociations
const bcrypt = require("bcryptjs")
const { Op } = require("sequelize")
const { sendSuccess, sendError } = require("../utils/responseHelper")

// Helper function to check if user is super admin
const checkSuperAdmin = async (userId) => {
  const user = await User.findByPk(userId)
  return user && user.role === "super_admin"
}

// Helper function to get user with permissions
const getUserWithPermissions = async (userId) => {
  return await User.findByPk(userId, {
    include: [Permission],
  })
}

exports.createAdmin = async (req, res) => {
  try {
    const { username, email, password, role, can_manage_tables, can_manage_canteen, can_view_reports } = req.body

    // Check if requesting user is super admin
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    // Validate role
    if (!["sub_admin", "manager"].includes(role)) {
      return sendError(res, "Invalid role specified", 400)
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    })

    if (existingUser) {
      return sendError(res, "Username or email already exists", 409)
    }

    const result = await db.sequelize.transaction(async (t) => {
      // Create user
      const user = await User.create(
        {
          username,
          email,
          password: bcrypt.hashSync(password, 12),
          role,
        },
        { transaction: t },
      )

      // Set permissions based on role
      const permissions = {
        sub_admin: {
          can_manage_tables: can_manage_tables ?? true,
          can_manage_canteen: can_manage_canteen ?? true,
          can_view_reports: can_view_reports ?? true,
        },
        manager: {
          can_manage_tables: can_manage_tables ?? false,
          can_manage_canteen: can_manage_canteen ?? true,
          can_view_reports: can_view_reports ?? false,
        },
      }

      await Permission.create(
        {
          user_id: user.id,
          ...permissions[role],
        },
        { transaction: t },
      )

      return user
    })

    sendSuccess(
      res,
      { id: result.id, username: result.username, role: result.role },
      `${role} created successfully`,
      201,
    )
  } catch (err) {
    console.error("Create admin error:", err)
    sendError(res, "Failed to create user", 500)
  }
}

exports.getUsers = async (req, res) => {
  try {
    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser) {
      return sendError(res, "User not found", 404)
    }

    let users = []

    if (currentUser.role === "super_admin") {
      // Super admin can see all sub-admins and managers
      users = await User.findAll({
        where: {
          role: { [Op.in]: ["sub_admin", "manager"] },
        },
        include: [Permission],
        attributes: { exclude: ["password"] },
        order: [["created_at", "DESC"]],
      })
    } else if (currentUser.role === "sub_admin") {
      // Sub-admin can only see their assigned managers
      const managerAssociations = await AdminManagerAssociation.findAll({
        where: { admin_id: req.userId },
        include: [
          {
            model: User,
            as: "manager",
            include: [Permission],
            attributes: { exclude: ["password"] },
          },
        ],
      })

      users = managerAssociations.map((assoc) => assoc.manager)
    } else {
      return sendError(res, "Unauthorized access", 403)
    }

    sendSuccess(res, users, "Users retrieved successfully")
  } catch (err) {
    console.error("Get users error:", err)
    sendError(res, "Failed to retrieve users", 500)
  }
}

exports.createManager = async (req, res) => {
  try {
    const { username, email, password } = req.body

    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser || currentUser.role !== "sub_admin") {
      return sendError(res, "Sub-admin access required", 403)
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    })

    if (existingUser) {
      return sendError(res, "Username or email already exists", 409)
    }

    const result = await db.sequelize.transaction(async (t) => {
      // Create manager
      const manager = await User.create(
        {
          username,
          email,
          password: bcrypt.hashSync(password, 12),
          role: "manager",
          is_active: true,
        },
        { transaction: t },
      )

      // Create default manager permissions
      await Permission.create(
        {
          user_id: manager.id,
          can_manage_tables: false,
          can_manage_canteen: true,
          can_view_reports: false,
        },
        { transaction: t },
      )

      // Create admin-manager association
      await AdminManagerAssociation.create(
        {
          admin_id: req.userId,
          manager_id: manager.id,
        },
        { transaction: t },
      )

      return manager
    })

    const { password: _, ...managerData } = result.toJSON()
    sendSuccess(res, managerData, "Manager created and assigned successfully", 201)
  } catch (err) {
    console.error("Create manager error:", err)
    sendError(res, "Failed to create manager", 500)
  }
}

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    // Validate input
    if (typeof is_active !== "boolean") {
      return sendError(res, "is_active must be a boolean value", 400)
    }

    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser) {
      return sendError(res, "User not found", 404)
    }

    const userToUpdate = await User.findByPk(id)
    if (!userToUpdate) {
      return sendError(res, "User to update not found", 404)
    }

    // Authorization checks
    if (currentUser.role === "sub_admin") {
      // Sub-admins can only update managers they manage
      const isManaged = await AdminManagerAssociation.findOne({
        where: {
          admin_id: req.userId,
          manager_id: id,
        },
      })

      if (!isManaged || userToUpdate.role !== "manager") {
        return sendError(res, "You can only update your assigned managers", 403)
      }
    } else if (currentUser.role !== "super_admin") {
      return sendError(res, "Insufficient permissions", 403)
    }

    // Update user status
    await userToUpdate.update({ is_active })

    const { password: _, ...userData } = userToUpdate.toJSON()
    sendSuccess(res, userData, "User status updated successfully")
  } catch (err) {
    console.error("Update user error:", err)
    sendError(res, "Failed to update user", 500)
  }
}

exports.getAllAdmins = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const admins = await User.findAll({
      where: { role: "sub_admin" },
      include: [Permission],
      attributes: { exclude: ["password"] },
      order: [["created_at", "DESC"]],
    })

    sendSuccess(res, admins, "Admins retrieved successfully")
  } catch (err) {
    console.error("Get all admins error:", err)
    sendError(res, "Failed to retrieve admins", 500)
  }
}

exports.getAdminById = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const admin = await User.findByPk(req.params.id, {
      include: [Permission],
      attributes: { exclude: ["password"] },
    })

    if (!admin || admin.role !== "sub_admin") {
      return sendError(res, "Sub-admin not found", 404)
    }

    sendSuccess(res, admin, "Admin retrieved successfully")
  } catch (err) {
    console.error("Get admin by ID error:", err)
    sendError(res, "Failed to retrieve admin", 500)
  }
}

exports.updateAdmin = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const { username, email, password, can_manage_tables, can_manage_canteen, can_view_reports } = req.body

    const user = await User.findByPk(req.params.id)
    if (!user || user.role !== "sub_admin") {
      return sendError(res, "Sub-admin not found", 404)
    }

    await db.sequelize.transaction(async (t) => {
      // Update user fields
      const updateData = {}
      if (username) updateData.username = username
      if (email) updateData.email = email
      if (password) updateData.password = bcrypt.hashSync(password, 12)

      if (Object.keys(updateData).length > 0) {
        await user.update(updateData, { transaction: t })
      }

      // Update permissions
      const permission = await Permission.findOne({
        where: { user_id: user.id },
      })

      if (permission) {
        const permissionUpdates = {}
        if (can_manage_tables !== undefined) permissionUpdates.can_manage_tables = can_manage_tables
        if (can_manage_canteen !== undefined) permissionUpdates.can_manage_canteen = can_manage_canteen
        if (can_view_reports !== undefined) permissionUpdates.can_view_reports = can_view_reports

        if (Object.keys(permissionUpdates).length > 0) {
          await permission.update(permissionUpdates, { transaction: t })
        }
      }
    })

    sendSuccess(res, null, "Sub-admin updated successfully")
  } catch (err) {
    console.error("Update admin error:", err)
    sendError(res, "Failed to update admin", 500)
  }
}

exports.deleteAdmin = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const user = await User.findByPk(req.params.id)
    if (!user || user.role !== "sub_admin") {
      return sendError(res, "Sub-admin not found", 404)
    }

    await user.destroy()
    sendSuccess(res, null, "Sub-admin deleted successfully")
  } catch (err) {
    console.error("Delete admin error:", err)
    sendError(res, "Failed to delete admin", 500)
  }
}
