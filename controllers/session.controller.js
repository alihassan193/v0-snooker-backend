const db = require('../models')
const { successResponse, errorResponse } = require('../utils/responseHelper')
const logger = require('../utils/logger')

// Start a new session
exports.startSession = async (req, res) => {
  try {
    const { table_id, player_id, game_type_id } = req.body

    // Check if table is available
    const table = await db.tables.findOne({
      where: { id: table_id, status: 'available', club_id: req.user.club_id },
    })

    if (!table) {
      return errorResponse(res, 'Table is not available', 400)
    }

    // Check if player exists
    const player = await db.players.findOne({
      where: { id: player_id, club_id: req.user.club_id },
    })

    if (!player) {
      return errorResponse(res, 'Player not found', 404)
    }

    // Start session
    const session = await db.sessions.create({
      table_id,
      player_id,
      game_type_id,
      start_time: new Date(),
      status: 'active',
      club_id: req.user.club_id,
    })

    // Update table status
    await db.tables.update({ status: 'occupied' }, { where: { id: table_id } })

    logger.info(`Session started: ${session.id} by user: ${req.user.id}`)
    return successResponse(res, 'Session started successfully', session, 201)
  } catch (error) {
    logger.error('Error starting session:', error)
    return errorResponse(res, 'Failed to start session', 500)
  }
}

// End session
exports.endSession = async (req, res) => {
  try {
    const { id } = req.params

    const session = await db.sessions.findOne({
      where: { id, status: 'active', club_id: req.user.club_id },
    })

    if (!session) {
      return errorResponse(res, 'Active session not found', 404)
    }

    const endTime = new Date()
    const duration = Math.ceil((endTime - session.start_time) / (1000 * 60)) // minutes

    // Calculate cost based on game type pricing
    const gameType = await db.gameTypes.findByPk(session.game_type_id)
    const pricing = await db.gamePricing.findOne({
      where: { game_type_id: session.game_type_id, club_id: req.user.club_id },
    })

    let totalCost = 0
    if (pricing) {
      if (gameType.pricing_type === 'per_minute') {
        totalCost = duration * pricing.price_per_minute
      } else {
        totalCost = pricing.fixed_price
      }
    }

    // Update session
    await db.sessions.update(
      {
        end_time: endTime,
        duration_minutes: duration,
        total_cost: totalCost,
        status: 'completed',
      },
      { where: { id } }
    )

    // Update table status
    await db.tables.update({ status: 'available' }, { where: { id: session.table_id } })

    const updatedSession = await db.sessions.findByPk(id, {
      include: [
        { model: db.tables, attributes: ['id', 'table_number'] },
        { model: db.players, attributes: ['id', 'name'] },
        { model: db.gameTypes, attributes: ['id', 'name'] },
      ],
    })

    logger.info(`Session ended: ${id} by user: ${req.user.id}`)
    return successResponse(res, 'Session ended successfully', updatedSession)
  } catch (error) {
    logger.error('Error ending session:', error)
    return errorResponse(res, 'Failed to end session', 500)
  }
}

// Get all sessions
exports.getAllSessions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query

    const offset = (page - 1) * limit
    const whereClause = { club_id: req.user.club_id }

    if (status) {
      whereClause.status = status
    }

    const { count, rows } = await db.sessions.findAndCountAll({
      where: whereClause,
      include: [
        { model: db.tables, attributes: ['id', 'table_number'] },
        { model: db.players, attributes: ['id', 'name'] },
        { model: db.gameTypes, attributes: ['id', 'name'] },
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [['start_time', 'DESC']],
    })

    return successResponse(res, 'Sessions retrieved successfully', {
      sessions: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error('Error getting sessions:', error)
    return errorResponse(res, 'Failed to get sessions', 500)
  }
}

// Get session by ID
exports.getSessionById = async (req, res) => {
  try {
    const { id } = req.params

    const session = await db.sessions.findOne({
      where: { id, club_id: req.user.club_id },
      include: [
        { model: db.tables, attributes: ['id', 'table_number'] },
        { model: db.players, attributes: ['id', 'name'] },
        { model: db.gameTypes, attributes: ['id', 'name'] },
      ],
    })

    if (!session) {
      return errorResponse(res, 'Session not found', 404)
    }

    return successResponse(res, 'Session retrieved successfully', session)
  } catch (error) {
    logger.error('Error getting session:', error)
    return errorResponse(res, 'Failed to get session', 500)
  }
}

// Get active sessions
exports.getActiveSessions = async (req, res) => {
  try {
    let clubIds = []

    if (req.userRole === 'sub_admin') {
      // Fetch all clubs managed by this sub_admin
      const managedClubs = await db.clubs.findAll({
        where: { created_by: req.userId },
        attributes: ['id'],
      })

      clubIds = managedClubs.map(club => club.id)

      if (!clubIds.length) {
        return successResponse(res, 'No active sessions found', [])
      }
    } else {
      // For other roles, use single club_id
      clubIds = [req.user.club_id]
    }

    const sessions = await db.sessions.findAll({
      where: {
        status: 'active',
        club_id: clubIds,
      },
      include: [
        { model: db.tables, as: 'table', attributes: ['id', 'table_number'] },
        { model: db.players, as: 'player', attributes: ['id', 'first_name', 'last_name'] },
        { model: db.gameTypes, as: 'gameType', attributes: ['id', 'name'] }, // <- fixed alias
      ],
      order: [['start_time', 'ASC']],
    })

    return successResponse(res, 'Active sessions retrieved successfully', sessions)
  } catch (error) {
    logger.error('Error getting active sessions:', error)
    return errorResponse(res, 'Failed to get active sessions', 500)
  }
}
