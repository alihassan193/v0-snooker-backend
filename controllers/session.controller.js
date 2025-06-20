const db = require('../models')
const { successResponse, errorResponse } = require('../utils/responseHelper')
const logger = require('../utils/logger')

const ClubManager = db.club_managers

// Helper function to get user's club access
const getUserClubAccess = async (userId, userRole) => {
  if (userRole === 'manager') {
    const clubManager = await ClubManager.findOne({
      where: { manager_id: userId, is_active: true },
    })
    return clubManager ? [clubManager.club_id] : []
  } else if (userRole === 'sub_admin') {
    const clubManagers = await ClubManager.findAll({
      where: { admin_id: userId, is_active: true },
    })
    return clubManagers.map(cm => cm.club_id)
  }
  return null // Super admin has access to all
}

// Start a new session
exports.startSession = async (req, res) => {
  try {
    const { table_id, player_id, game_type_id, pricing_id } = req.body

    // Validate table exists and is available
    const table = await db.tables.findByPk(table_id, {
      include: [
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
    })

    if (!table) {
      return errorResponse(res, 'Table not found', 404)
    }

    if (table.status !== 'available') {
      return errorResponse(res, 'Table is not available', 400)
    }

    // Check if user has access to this table's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(table.club_id)) {
      return errorResponse(res, 'You can only start sessions for tables in clubs you manage', 403)
    }

    // Validate player exists
    const player = await db.players.findByPk(player_id)
    if (!player) {
      return errorResponse(res, 'Player not found', 404)
    }

    // Validate game type and pricing
    const gameType = await db.gameTypes.findByPk(game_type_id)
    if (!gameType) {
      return errorResponse(res, 'Game type not found', 404)
    }

    const pricing = await db.gamePricings.findByPk(pricing_id)
    if (!pricing) {
      return errorResponse(res, 'Pricing not found', 404)
    }

    // Check if player already has an active session
    const activeSession = await db.sessions.findOne({
      where: {
        player_id,
        status: 'active',
      },
    })

    if (activeSession) {
      return errorResponse(res, 'Player already has an active session', 400)
    }

    const result = await db.sequelize.transaction(async t => {
      // Create session
      const session = await db.sessions.create(
        {
          table_id,
          player_id,
          game_type_id,
          pricing_id,
          start_time: new Date(),
          status: 'active',
          created_by: req.userId,
        },
        { transaction: t }
      )

      // Update table status to occupied
      await db.tables.update({ status: 'occupied' }, { where: { id: table_id }, transaction: t })

      return session
    })

    // Get complete session data
    const sessionWithDetails = await db.sessions.findByPk(result.id, {
      include: [
        {
          model: db.tables,
          as: 'table',
          attributes: ['id', 'table_number'],
          include: [
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: db.players,
          as: 'player',
          attributes: ['id', 'first_name', 'first_name', 'phone'],
        },
        {
          model: db.gameTypes,
          as: 'gameType',
          attributes: ['id', 'name'],
        },
        {
          model: db.gamePricings,
          as: 'pricing',
          attributes: ['id', 'price_per_minute', 'fixed_price', 'time_limit_minutes'],
        },
      ],
    })

    logger.info(`Session started: ${result.id} by user: ${req.userId}`)
    return successResponse(res, 'Session started successfully', sessionWithDetails, 201)
  } catch (error) {
    logger.error('Error starting session:', error)
    return errorResponse(res, 'Failed to start session', 500)
  }
}

// End a session
exports.endSession = async (req, res) => {
  try {
    const { id } = req.params
    const { total_amount, notes } = req.body

    const session = await db.sessions.findByPk(id, {
      include: [
        {
          model: db.tables,
          as: 'table',
          include: [
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id'],
            },
          ],
        },
      ],
    })

    if (!session) {
      return errorResponse(res, 'Session not found', 404)
    }

    if (session.status !== 'active') {
      return errorResponse(res, 'Session is not active', 400)
    }

    // Check if user has access to this session's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(session.table.club.id)) {
      return errorResponse(res, 'You can only end sessions for tables in clubs you manage', 403)
    }

    const endTime = new Date()
    const durationMinutes = Math.ceil((endTime - session.start_time) / (1000 * 60))

    const result = await db.sequelize.transaction(async t => {
      // Update session
      await db.sessions.update(
        {
          end_time: endTime,
          duration_minutes: durationMinutes,
          total_amount: total_amount || 0,
          notes,
          status: 'completed',
        },
        { where: { id }, transaction: t }
      )

      // Update table status back to available
      await db.tables.update({ status: 'available' }, { where: { id: session.table_id }, transaction: t })

      return session
    })

    // Get updated session data
    const updatedSession = await db.sessions.findByPk(id, {
      include: [
        {
          model: db.tables,
          as: 'table',
          attributes: ['id', 'table_number'],
        },
        {
          model: db.players,
          as: 'player',
          attributes: ['id', 'name', 'phone'],
        },
        {
          model: db.gameTypes,
          as: 'gameType',
          attributes: ['id', 'name'],
        },
      ],
    })

    logger.info(`Session ended: ${id} by user: ${req.userId}`)
    return successResponse(res, 'Session ended successfully', updatedSession)
  } catch (error) {
    logger.error('Error ending session:', error)
    return errorResponse(res, 'Failed to end session', 500)
  }
}

// Get all sessions
exports.getAllSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, club_id, start_date, end_date } = req.query

    // Input validation
    const pageNum = Math.max(1, parseInt(page)) || 1
    const limitNum = Math.min(parseInt(limit) || 10, 100) // Max 100 items per page

    const whereClause = {}
    if (status) {
      whereClause.status = status
    }

    // Date range filtering
    if (start_date || end_date) {
      whereClause.start_time = {}
      if (start_date) whereClause.start_time[db.Sequelize.Op.gte] = new Date(start_date)
      if (end_date) whereClause.start_time[db.Sequelize.Op.lte] = new Date(end_date)
    }

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    const tableWhereClause = {}
    if (userClubAccess) {
      if (club_id) {
        const clubIdNum = parseInt(club_id)
        if (!userClubAccess.includes(clubIdNum)) {
          return errorResponse(res, 'You can only view sessions for clubs you manage', 403)
        }
        tableWhereClause.club_id = clubIdNum
      } else {
        tableWhereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      tableWhereClause.club_id = parseInt(club_id)
    }

    const { count, rows: sessions } = await db.sessions.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.tables,
          as: 'table',
          where: tableWhereClause,
          attributes: ['id', 'table_number'],
          include: [
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'],
            },
          ],
          required: true, // Ensures INNER JOIN for access control
        },
        {
          model: db.players,
          as: 'player',
          attributes: ['id', 'first_name', 'last_name', 'phone', 'email', 'player_code'],
        },
        {
          model: db.gameTypes,
          as: 'gameType',
          attributes: ['id', 'name', 'description'],
        },
        {
          model: db.gamePricings,
          as: 'pricing',
          attributes: ['id', 'price_per_minute', 'fixed_price', 'time_limit_minutes', 'is_unlimited_time'],
        },
        {
          model: db.sessionCanteenOrders,
          as: 'canteen_orders',
          attributes: ['id', 'quantity'],
          include: [
            {
              model: db.canteenOrders,
              as: 'order',
              attributes: ['id', 'created_at'],
              include: [
                {
                  model: db.canteenItems,
                  as: 'item',
                  attributes: ['id', 'name', 'price', 'image_url'],
                },
              ],
            },
          ],
        },
      ],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
      order: [['start_time', 'DESC']],
      subQuery: false, // Better performance for complex queries
    })

    return successResponse(res, 'Sessions retrieved successfully', {
      sessions,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    })
  } catch (error) {
    logger.error('Error getting sessions:', {
      error: error.message,
      stack: error.stack,
      query: req.query,
      userId: req.userId,
    })
    return errorResponse(res, 'Failed to get sessions', 500)
  }
}

// Get session by ID
exports.getSessionById = async (req, res) => {
  try {
    const { id } = req.params

    const session = await db.sessions.findByPk(id, {
      include: [
        {
          model: db.tables,
          as: 'table',
          attributes: ['id', 'table_number'],
          include: [
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: db.players,
          as: 'player',
          attributes: ['id', 'first_name', 'last_name', 'phone', 'email'],
        },
        {
          model: db.gameTypes,
          as: 'gameType',
          attributes: ['id', 'name'],
        },
        {
          model: db.gamePricings,
          as: 'pricing',
          attributes: ['id', 'price_per_minute', 'fixed_price', 'time_limit_minutes'],
        },
        {
          model: db.sessionCanteenOrders,
          as: 'canteen_orders',
          include: [
            {
              model: db.canteenOrders,
              as: 'order',
              include: [
                {
                  model: db.canteenItems,
                  as: 'item',
                  attributes: ['id', 'name', 'price'],
                },
              ],
            },
          ],
        },
      ],
    })

    if (!session) {
      return errorResponse(res, 'Session not found', 404)
    }

    // Check if user has access to this session's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(session.table.club.id)) {
      return errorResponse(res, 'You can only view sessions for clubs you manage', 403)
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
    console.log('Session Query : ', req.query)
    const { club_id } = req.query

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    const tableWhereClause = {}
    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, 'You can only view sessions for clubs you manage', 403)
        }
        tableWhereClause.club_id = club_id
      } else {
        // Show sessions from all accessible clubs
        tableWhereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      tableWhereClause.club_id = club_id
    }

    const activeSessions = await db.sessions.findAll({
      where: { status: 'active' },
      include: [
        {
          model: db.tables,
          as: 'table',
          where: tableWhereClause,
          attributes: ['id', 'table_number'],
          include: [
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: db.players,
          as: 'player',
          attributes: ['id', 'first_name', 'phone'],
        },
        {
          model: db.gameTypes,
          as: 'gameType',
          attributes: ['id', 'name'],
        },
        {
          model: db.gamePricings,
          as: 'pricing',
          attributes: ['id', 'price_per_minute', 'fixed_price', 'time_limit_minutes'],
        },
        {
          model: db.sessionCanteenOrders,
          as: 'canteen_orders',
          include: [
            {
              model: db.canteenOrders,
              as: 'order',
              include: [
                {
                  model: db.canteenItems,
                  as: 'item',
                  attributes: ['id', 'name', 'price'],
                },
              ],
            },
          ],
        },
      ],
      order: [['start_time', 'ASC']],
    })

    return successResponse(res, 'Active sessions retrieved successfully', activeSessions)
  } catch (error) {
    logger.error('Error getting active sessions:', error)
    return errorResponse(res, 'Failed to get active sessions', 500)
  }
}
