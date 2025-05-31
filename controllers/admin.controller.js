const db = require("../models")
const User = db.users
const Permission = db.permissions
const Club = db.clubs
const ClubManager = db.club_managers
const bcrypt = require("bcryptjs")
const { Op } = require("sequelize")
const { sendSuccess, sendError } = require("../utils/responseHelper")
const logger = require("../utils/logger")

// Helper function to check if user is super admin
const checkSuperAdmin = async (userId) => {
  const user = await User.findByPk(userId)
  return user && user.role === "super_admin"
}

// Helper function to get user with permissions
const getUserWithPermissions = async (userId) => {
  return await User.findByPk(userId, {
    include: [{ model: Permission, as: "permissions" }],
  })
}

// Helper function to get clubs managed by sub-admin
const getSubAdminClubs = async (subAdminId) => {
  return await ClubManager.findAll({
    where: { admin_id: subAdminId, is_active: true },
    include: [
      {
        model: Club,
        as: "club",
        attributes: ["id", "name", "address", "phone"],
      },
    ],
  })
}

const createAdmin = async (req, res) => {
  try {
    const { username, email, password, role, can_manage_tables, can_manage_canteen, can_view_reports, club_ids } =
      req.body

    // Check if requesting user is super admin
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    // Validate role
    if (!["sub_admin", "manager"].includes(role)) {
      return sendError(res, "Invalid role specified", 400)
    }

    // For sub-admin creation, club_ids are required
    if (role === "sub_admin" && (!club_ids || !Array.isArray(club_ids) || club_ids.length === 0)) {
      return sendError(res, "Club IDs are required for sub-admin creation", 400)
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

    // Validate clubs exist
    if (club_ids && club_ids.length > 0) {
      const clubs = await Club.findAll({
        where: { id: { [Op.in]: club_ids } },
      })
      if (clubs.length !== club_ids.length) {
        return sendError(res, "One or more clubs not found", 404)
      }
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

      // Assign clubs to sub-admin
      if (role === "sub_admin" && club_ids && club_ids.length > 0) {
        const clubAssignments = club_ids.map((clubId) => ({
          admin_id: user.id,
          manager_id: user.id, // For sub-admin, admin_id and manager_id are the same
          club_id: clubId,
          is_active: true,
        }))

        await ClubManager.bulkCreate(clubAssignments, { transaction: t })
      }

      return user
    })

    logger.info(`${role} created: ${result.username}`)
    sendSuccess(
      res,
      { id: result.id, username: result.username, role: result.role },
      `${role} created successfully`,
      201,
    )
  } catch (err) {
    logger.error("Create admin error:", err)
    sendError(res, "Failed to create user", 500)
  }
}

const createManager = async (req, res) => {
  try {
    const { username, email, password, club_id, can_manage_tables, can_manage_canteen, can_view_reports } = req.body

    // Validate required fields
    if (!club_id) {
      return sendError(res, "Club ID is required for manager creation", 400)
    }

    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser || currentUser.role !== "sub_admin") {
      return sendError(res, "Sub-admin access required", 403)
    }

    // Check if sub-admin manages the specified club
    const subAdminClubs = await getSubAdminClubs(req.userId)
    const managedClubIds = subAdminClubs.map((cm) => cm.club_id)

    if (!managedClubIds.includes(Number.parseInt(club_id))) {
      return sendError(res, "You can only create managers for clubs you manage", 403)
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

    // Verify club exists
    const club = await Club.findByPk(club_id)
    if (!club) {
      return sendError(res, "Club not found", 404)
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

      // Create manager permissions
      await Permission.create(
        {
          user_id: manager.id,
          can_manage_tables: can_manage_tables ?? false,
          can_manage_canteen: can_manage_canteen ?? true,
          can_view_reports: can_view_reports ?? false,
        },
        { transaction: t },
      )

      // Assign manager to club
      await ClubManager.create(
        {
          admin_id: req.userId, // The sub-admin who created this manager
          manager_id: manager.id,
          club_id: club_id,
          is_active: true,
        },
        { transaction: t },
      )

      return manager
    })

    const { password: _, ...managerData } = result.toJSON()
    logger.info(`Manager created: ${result.username} for club: ${club.name}`)
    sendSuccess(res, { ...managerData, club_id }, "Manager created and assigned to club successfully", 201)
  } catch (err) {
    logger.error("Create manager error:", err)
    sendError(res, "Failed to create manager", 500)
  }
}

const getUsers = async (req, res) => {
  try {
    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser) {
      return sendError(res, "User not found", 404)
    }

    let users = []

    if (currentUser.role === "super_admin") {
      // Super admin can see all sub-admins and managers with their club assignments
      users = await User.findAll({
        where: {
          role: { [Op.in]: ["sub_admin", "manager"] },
        },
        include: [
          { model: Permission, as: "permissions" },
          {
            model: ClubManager,
            as: "managed_clubs",
            include: [
              {
                model: Club,
                as: "club",
                attributes: ["id", "name", "address"],
              },
            ],
          },
        ],
        attributes: { exclude: ["password"] },
        order: [["created_at", "DESC"]],
      })
    } else if (currentUser.role === "sub_admin") {
      // Sub-admin can only see managers they created for their clubs
      const subAdminClubs = await getSubAdminClubs(req.userId)
      const managedClubIds = subAdminClubs.map((cm) => cm.club_id)

      users = await User.findAll({
        where: {
          role: "manager",
        },
        include: [
          { model: Permission, as: "permissions" },
          {
            model: ClubManager,
            as: "managed_clubs",
            where: {
              admin_id: req.userId,
              club_id: { [Op.in]: managedClubIds },
            },
            include: [
              {
                model: Club,
                as: "club",
                attributes: ["id", "name", "address"],
              },
            ],
          },
        ],
        attributes: { exclude: ["password"] },
        order: [["created_at", "DESC"]],
      })
    } else {
      return sendError(res, "Unauthorized access", 403)
    }

    sendSuccess(res, users, "Users retrieved successfully")
  } catch (err) {
    logger.error("Get users error:", err)
    sendError(res, "Failed to retrieve users", 500)
  }
}

const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { is_active, club_id } = req.body

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
      // Sub-admins can only update managers they created
      if (userToUpdate.role !== "manager") {
        return sendError(res, "You can only update managers", 403)
      }

      // Check if this manager belongs to sub-admin's clubs
      const managerClub = await ClubManager.findOne({
        where: {
          manager_id: id,
          admin_id: req.userId,
          is_active: true,
        },
      })

      if (!managerClub) {
        return sendError(res, "You can only update managers you created", 403)
      }
    } else if (currentUser.role !== "super_admin") {
      return sendError(res, "Insufficient permissions", 403)
    }

    await db.sequelize.transaction(async (t) => {
      // Update user status
      await userToUpdate.update({ is_active }, { transaction: t })

      // If club_id is provided and user is manager, update club assignment
      if (club_id && userToUpdate.role === "manager") {
        await ClubManager.update(
          { club_id },
          {
            where: {
              manager_id: id,
              admin_id: currentUser.role === "sub_admin" ? req.userId : { [Op.ne]: null },
            },
            transaction: t,
          },
        )
      }
    })

    const { password: _, ...userData } = userToUpdate.toJSON()
    logger.info(`User status updated: ${userToUpdate.username}`)
    sendSuccess(res, userData, "User status updated successfully")
  } catch (err) {
    logger.error("Update user error:", err)
    sendError(res, "Failed to update user", 500)
  }
}

const getAllAdmins = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const admins = await User.findAll({
      where: { role: "sub_admin" },
      include: [
        { model: Permission, as: "permissions" },
        {
          model: ClubManager,
          as: "managed_clubs",
          include: [
            {
              model: Club,
              as: "club",
              attributes: ["id", "name", "address"],
            },
          ],
        },
      ],
      attributes: { exclude: ["password"] },
      order: [["created_at", "DESC"]],
    })

    sendSuccess(res, admins, "Admins retrieved successfully")
  } catch (err) {
    logger.error("Get all admins error:", err)
    sendError(res, "Failed to retrieve admins", 500)
  }
}

const getAdminById = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const admin = await User.findByPk(req.params.id, {
      include: [
        { model: Permission, as: "permissions" },
        {
          model: ClubManager,
          as: "managed_clubs",
          include: [
            {
              model: Club,
              as: "club",
              attributes: ["id", "name", "address"],
            },
          ],
        },
      ],
      attributes: { exclude: ["password"] },
    })

    if (!admin || admin.role !== "sub_admin") {
      return sendError(res, "Sub-admin not found", 404)
    }

    sendSuccess(res, admin, "Admin retrieved successfully")
  } catch (err) {
    logger.error("Get admin by ID error:", err)
    sendError(res, "Failed to retrieve admin", 500)
  }
}

const updateAdmin = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const { username, email, password, can_manage_tables, can_manage_canteen, can_view_reports, club_ids } = req.body

    const user = await User.findByPk(req.params.id)
    if (!user || user.role !== "sub_admin") {
      return sendError(res, "Sub-admin not found", 404)
    }

    // Validate clubs if provided
    if (club_ids && Array.isArray(club_ids) && club_ids.length > 0) {
      const clubs = await Club.findAll({
        where: { id: { [Op.in]: club_ids } },
      })
      if (clubs.length !== club_ids.length) {
        return sendError(res, "One or more clubs not found", 404)
      }
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

      // Update club assignments if provided
      if (club_ids && Array.isArray(club_ids)) {
        // Remove existing club assignments
        await ClubManager.destroy({
          where: { admin_id: user.id },
          transaction: t,
        })

        // Add new club assignments
        if (club_ids.length > 0) {
          const clubAssignments = club_ids.map((clubId) => ({
            admin_id: user.id,
            manager_id: user.id,
            club_id: clubId,
            is_active: true,
          }))

          await ClubManager.bulkCreate(clubAssignments, { transaction: t })
        }
      }
    })

    logger.info(`Admin updated: ${user.username}`)
    sendSuccess(res, null, "Sub-admin updated successfully")
  } catch (err) {
    logger.error("Update admin error:", err)
    sendError(res, "Failed to update admin", 500)
  }
}

const deleteAdmin = async (req, res) => {
  try {
    if (!(await checkSuperAdmin(req.userId))) {
      return sendError(res, "Super admin access required", 403)
    }

    const user = await User.findByPk(req.params.id)
    if (!user || user.role !== "sub_admin") {
      return sendError(res, "Sub-admin not found", 404)
    }

    await db.sequelize.transaction(async (t) => {
      // Remove club assignments
      await ClubManager.destroy({
        where: { admin_id: user.id },
        transaction: t,
      })

      // Delete user
      await user.destroy({ transaction: t })
    })

    logger.info(`Admin deleted: ${user.username}`)
    sendSuccess(res, null, "Sub-admin deleted successfully")
  } catch (err) {
    logger.error("Delete admin error:", err)
    sendError(res, "Failed to delete admin", 500)
  }
}

// Get clubs managed by current sub-admin
const getManagedClubs = async (req, res) => {
  try {
    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser || currentUser.role !== "sub_admin") {
      return sendError(res, "Sub-admin access required", 403)
    }

    const managedClubs = await getSubAdminClubs(req.userId)
    const clubs = managedClubs.map((cm) => cm.club)

    sendSuccess(res, clubs, "Managed clubs retrieved successfully")
  } catch (err) {
    logger.error("Get managed clubs error:", err)
    sendError(res, "Failed to retrieve managed clubs", 500)
  }
}

module.exports = {
  createAdmin,
  getUsers,
  createManager,
  updateUser,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  getManagedClubs,
}
