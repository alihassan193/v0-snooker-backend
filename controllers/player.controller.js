const db = require("../models")
const { successResponse, errorResponse } = require("../utils/responseHelper")
const logger = require("../utils/logger")

const ClubManager = db.club_managers

// Helper function to get user's club access
const getUserClubAccess = async (userId, userRole) => {
  if (userRole === "manager") {
    const clubManager = await ClubManager.findOne({
      where: { manager_id: userId, is_active: true },
    })
    return clubManager ? [clubManager.club_id] : []
  } else if (userRole === "sub_admin") {
    const clubManagers = await ClubManager.findAll({
      where: { admin_id: userId, is_active: true },
    })
    return clubManagers.map((cm) => cm.club_id)
  }
  return null // Super admin has access to all
}

// Create a new player
exports.createPlayer = async (req, res) => {
  try {
    const { name, phone, email, address, date_of_birth, membership_type, club_id } = req.body

    // Validate club_id
    if (!club_id) {
      return errorResponse(res, "Club ID is required", 400)
    }

    // Check if user has access to this club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(Number.parseInt(club_id))) {
      return errorResponse(res, "You can only create players for clubs you manage", 403)
    }

    // Check if player with same phone exists in this club
    const existingPlayer = await db.players.findOne({
      where: {
        phone,
        club_id,
      },
    })

    if (existingPlayer) {
      return errorResponse(res, "Player with this phone number already exists in this club", 400)
    }

    const player = await db.players.create({
      name,
      phone,
      email,
      address,
      date_of_birth,
      membership_type: membership_type || "regular",
      club_id,
    })

    // Get player with club info
    const playerWithClub = await db.players.findByPk(player.id, {
      include: [
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
    })

    logger.info(`Player created: ${player.id} by user: ${req.userId}`)
    return successResponse(res, "Player created successfully", playerWithClub, 201)
  } catch (error) {
    logger.error("Error creating player:", error)
    return errorResponse(res, "Failed to create player", 500)
  }
}

// Get all players
exports.getAllPlayers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, club_id } = req.query

    const offset = (page - 1) * limit
    const whereClause = {}

    if (search) {
      whereClause[db.Sequelize.Op.or] = [
        { name: { [db.Sequelize.Op.iLike]: `%${search}%` } },
        { phone: { [db.Sequelize.Op.iLike]: `%${search}%` } },
        { email: { [db.Sequelize.Op.iLike]: `%${search}%` } },
      ]
    }

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, "You can only view players for clubs you manage", 403)
        }
        whereClause.club_id = club_id
      } else {
        // Show players from all accessible clubs
        whereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause.club_id = club_id
    }

    const { count, rows } = await db.players.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["name", "ASC"]],
    })

    return successResponse(res, "Players retrieved successfully", {
      players: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error("Error getting players:", error)
    return errorResponse(res, "Failed to get players", 500)
  }
}

// Get player by ID
exports.getPlayerById = async (req, res) => {
  try {
    const { id } = req.params

    const player = await db.players.findByPk(id, {
      include: [
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
        {
          model: db.playerPreferences,
          as: "preferences",
          required: false,
        },
      ],
    })

    if (!player) {
      return errorResponse(res, "Player not found", 404)
    }

    // Check if user has access to this player's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(player.club_id)) {
      return errorResponse(res, "You can only view players from clubs you manage", 403)
    }

    return successResponse(res, "Player retrieved successfully", player)
  } catch (error) {
    logger.error("Error getting player:", error)
    return errorResponse(res, "Failed to get player", 500)
  }
}

// Update player
exports.updatePlayer = async (req, res) => {
  try {
    const { id } = req.params
    const { name, phone, email, address, date_of_birth, membership_type } = req.body

    const player = await db.players.findByPk(id)

    if (!player) {
      return errorResponse(res, "Player not found", 404)
    }

    // Check if user has access to this player's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(player.club_id)) {
      return errorResponse(res, "You can only update players from clubs you manage", 403)
    }

    // Check if new phone number conflicts (if changing phone)
    if (phone && phone !== player.phone) {
      const existingPlayer = await db.players.findOne({
        where: {
          phone,
          club_id: player.club_id,
          id: { [db.Sequelize.Op.ne]: player.id },
        },
      })

      if (existingPlayer) {
        return errorResponse(res, "Phone number already exists for another player in this club", 409)
      }
    }

    await db.players.update(
      {
        name,
        phone,
        email,
        address,
        date_of_birth,
        membership_type,
      },
      { where: { id } },
    )

    const updatedPlayer = await db.players.findByPk(id, {
      include: [
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
    })

    logger.info(`Player updated: ${id} by user: ${req.userId}`)
    return successResponse(res, "Player updated successfully", updatedPlayer)
  } catch (error) {
    logger.error("Error updating player:", error)
    return errorResponse(res, "Failed to update player", 500)
  }
}

// Delete player
exports.deletePlayer = async (req, res) => {
  try {
    const { id } = req.params

    const player = await db.players.findByPk(id)

    if (!player) {
      return errorResponse(res, "Player not found", 404)
    }

    // Check if user has access to this player's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(player.club_id)) {
      return errorResponse(res, "You can only delete players from clubs you manage", 403)
    }

    await db.players.destroy({ where: { id } })

    logger.info(`Player deleted: ${id} by user: ${req.userId}`)
    return successResponse(res, "Player deleted successfully")
  } catch (error) {
    logger.error("Error deleting player:", error)
    return errorResponse(res, "Failed to delete player", 500)
  }
}

// Search players
exports.searchPlayers = async (req, res) => {
  try {
    const { query } = req.params
    const { limit = 10, club_id } = req.query

    const whereClause = {
      [db.Sequelize.Op.or]: [
        { name: { [db.Sequelize.Op.iLike]: `%${query}%` } },
        { phone: { [db.Sequelize.Op.iLike]: `%${query}%` } },
        { email: { [db.Sequelize.Op.iLike]: `%${query}%` } },
      ],
    }

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, "You can only search players for clubs you manage", 403)
        }
        whereClause.club_id = club_id
      } else {
        // Search players from all accessible clubs
        whereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause.club_id = club_id
    }

    const players = await db.players.findAll({
      where: whereClause,
      include: [
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
      limit: Number.parseInt(limit),
      order: [["name", "ASC"]],
    })

    return successResponse(res, "Players found", players)
  } catch (error) {
    logger.error("Error searching players:", error)
    return errorResponse(res, "Failed to search players", 500)
  }
}

// Get player sessions
exports.getPlayerSessions = async (req, res) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 10 } = req.query

    // First check if player exists and user has access
    const player = await db.players.findByPk(id)
    if (!player) {
      return errorResponse(res, "Player not found", 404)
    }

    // Check if user has access to this player's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(player.club_id)) {
      return errorResponse(res, "You can only view sessions for players from clubs you manage", 403)
    }

    const offset = (page - 1) * limit

    const { count, rows } = await db.sessions.findAndCountAll({
      where: { player_id: id },
      include: [
        {
          model: db.tables,
          as: "table",
          attributes: ["id", "table_number"],
        },
        {
          model: db.gameTypes,
          as: "gameType",
          attributes: ["id", "name"],
        },
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["start_time", "DESC"]],
    })

    return successResponse(res, "Player sessions retrieved successfully", {
      sessions: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error("Error getting player sessions:", error)
    return errorResponse(res, "Failed to get player sessions", 500)
  }
}
