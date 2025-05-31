const db = require("../models")
const { successResponse, errorResponse } = require("../utils/responseHelper")
const logger = require("../utils/logger")

// Create a new player
exports.createPlayer = async (req, res) => {
  try {
    const { name, phone, email, address, date_of_birth, membership_type } = req.body

    // Check if player with same phone exists
    const existingPlayer = await db.players.findOne({ where: { phone } })
    if (existingPlayer) {
      return errorResponse(res, "Player with this phone number already exists", 400)
    }

    const player = await db.players.create({
      name,
      phone,
      email,
      address,
      date_of_birth,
      membership_type: membership_type || "regular",
      club_id: req.user.club_id,
    })

    logger.info(`Player created: ${player.id} by user: ${req.user.id}`)
    return successResponse(res, "Player created successfully", player, 201)
  } catch (error) {
    logger.error("Error creating player:", error)
    return errorResponse(res, "Failed to create player", 500)
  }
}

// Get all players
exports.getAllPlayers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query

    const offset = (page - 1) * limit
    const whereClause = { club_id: req.user.club_id }

    if (search) {
      whereClause[db.Sequelize.Op.or] = [
        { name: { [db.Sequelize.Op.iLike]: `%${search}%` } },
        { phone: { [db.Sequelize.Op.iLike]: `%${search}%` } },
        { email: { [db.Sequelize.Op.iLike]: `%${search}%` } },
      ]
    }

    const { count, rows } = await db.players.findAndCountAll({
      where: whereClause,
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

    const player = await db.players.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!player) {
      return errorResponse(res, "Player not found", 404)
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

    const player = await db.players.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!player) {
      return errorResponse(res, "Player not found", 404)
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
      { where: { id, club_id: req.user.club_id } },
    )

    const updatedPlayer = await db.players.findByPk(id)

    logger.info(`Player updated: ${id} by user: ${req.user.id}`)
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

    const player = await db.players.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!player) {
      return errorResponse(res, "Player not found", 404)
    }

    await db.players.destroy({ where: { id, club_id: req.user.club_id } })

    logger.info(`Player deleted: ${id} by user: ${req.user.id}`)
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
    const { limit = 10 } = req.query

    const players = await db.players.findAll({
      where: {
        club_id: req.user.club_id,
        [db.Sequelize.Op.or]: [
          { name: { [db.Sequelize.Op.iLike]: `%${query}%` } },
          { phone: { [db.Sequelize.Op.iLike]: `%${query}%` } },
          { email: { [db.Sequelize.Op.iLike]: `%${query}%` } },
        ],
      },
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

    const offset = (page - 1) * limit

    const { count, rows } = await db.sessions.findAndCountAll({
      where: { player_id: id },
      include: [
        {
          model: db.tables,
          attributes: ["id", "table_number"],
        },
        {
          model: db.gameTypes,
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
