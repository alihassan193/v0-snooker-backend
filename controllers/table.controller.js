const db = require('../models')
const {
  sendError,
  sendSuccess,
  sendPaginatedResponse,
  errorResponse,
  successResponse,
} = require('../utils/responseHelper')
const logger = require('../utils/logger')

const Table = db.tables
const Session = db.sessions
const User = db.users
const Permission = db.permissions
const ClubManager = db.club_managers

const getUserWithPermissions = async userId => {
  return await User.findByPk(userId, {
    include: [{ model: Permission, as: 'permissions' }],
  })
}

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

// Create a new table
exports.createTable = async (req, res) => {
  try {
    const { table_number, table_type, description, club_id } = req.body

    // Validate club_id
    if (!club_id) {
      return sendError(res, 'Club ID is required', 400)
    }

    // Check if user has access to this club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(Number.parseInt(club_id))) {
      return sendError(res, 'You can only create tables for clubs you manage', 403)
    }

    // Check if table number exists in the club
    const existingTable = await Table.findOne({
      where: { table_number, club_id },
    })

    if (existingTable) {
      return sendError(res, 'Table number already exists in this club', 400)
    }

    const table = await Table.create({
      table_number,
      table_type: table_type || 'standard',
      description,
      status: 'available',
      club_id,
      created_by: req.userId,
      is_active: true,
    })

    // Get table with club info
    const tableWithClub = await Table.findByPk(table.id, {
      include: [
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
    })

    logger.info(`Table created: ${table.id} by user: ${req.userId}`)
    return sendSuccess(res, tableWithClub, 'Table created successfully', 201)
  } catch (error) {
    logger.error('Error creating table:', error)
    return sendError(res, 'Failed to create table', 500)
  }
}

// Get all tables
exports.getAllTables = async (req, res) => {
  try {
    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser) {
      return sendError(res, 'User not found', 404)
    }

    const { status, page = 1, limit = 10, club_id } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    if (status) {
      whereClause.status = status
    }

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, currentUser.role)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return sendError(res, 'You can only view tables for clubs you manage', 403)
        }
        whereClause.club_id = club_id
      } else {
        // Show tables from all accessible clubs
        whereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause.club_id = club_id
    }

    const offset = (page - 1) * limit

    const { count, rows: tables } = await Table.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
      order: [['table_number', 'ASC']],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
    })

    sendPaginatedResponse(
      res,
      tables,
      {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
      'Tables retrieved successfully'
    )
  } catch (error) {
    console.error('Error getting tables:', error)
    sendError(res, 'Failed to fetch tables', 500, error.message)
  }
}

// Get table by ID
exports.getTableById = async (req, res) => {
  try {
    const { id } = req.params

    const table = await Table.findByPk(id, {
      include: [
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
        {
          model: Session,
          as: 'sessions',
          where: { status: 'active' },
          required: false,
        },
      ],
    })

    if (!table) {
      return sendError(res, 'Table not found', 404)
    }

    // Check if user has access to this table's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(table.club_id)) {
      return sendError(res, 'You can only view tables from clubs you manage', 403)
    }

    return sendSuccess(res, table, 'Table retrieved successfully')
  } catch (error) {
    logger.error('Error getting table:', error)
    return sendError(res, 'Failed to get table', 500)
  }
}

// Update table
exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params
    const { table_number, table_type, description } = req.body

    const table = await Table.findByPk(id)

    if (!table) {
      return sendError(res, 'Table not found', 404)
    }

    // Check if user has access to this table's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(table.club_id)) {
      return sendError(res, 'You can only update tables from clubs you manage', 403)
    }

    // Check if new table number already exists (if changing table number)
    if (table_number && table_number !== table.table_number) {
      const existingTable = await Table.findOne({
        where: { table_number, club_id: table.club_id },
      })

      if (existingTable) {
        return sendError(res, 'Table number already exists in this club', 400)
      }
    }

    await Table.update(
      {
        table_number,
        table_type,
        description,
      },
      { where: { id } }
    )

    const updatedTable = await Table.findByPk(id, {
      include: [
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
    })

    logger.info(`Table updated: ${id} by user: ${req.userId}`)
    return sendSuccess(res, updatedTable, 'Table updated successfully')
  } catch (error) {
    logger.error('Error updating table:', error)
    return sendError(res, 'Failed to update table', 500)
  }
}

// Delete table
exports.deleteTable = async (req, res) => {
  try {
    const { id } = req.params

    const table = await Table.findByPk(id)

    if (!table) {
      return sendError(res, 'Table not found', 404)
    }

    // Check if user has access to this table's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(table.club_id)) {
      return sendError(res, 'You can only delete tables from clubs you manage', 403)
    }

    // Check if table has active sessions
    const activeSessions = await Session.findOne({
      where: { table_id: id, status: 'active' },
    })

    if (activeSessions) {
      return sendError(res, 'Cannot delete table with active sessions', 400)
    }

    await Table.destroy({ where: { id } })

    logger.info(`Table deleted: ${id} by user: ${req.userId}`)
    return sendSuccess(res, null, 'Table deleted successfully')
  } catch (error) {
    logger.error('Error deleting table:', error)
    return sendError(res, 'Failed to delete table', 500)
  }
}

// Get available tables
exports.getAvailableTables = async (req, res) => {
  try {
    const { club_id } = req.query

    // Build where clause based on user role and club access
    const whereClause = { status: 'available' }

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return sendError(res, 'You can only view tables for clubs you manage', 403)
        }
        whereClause.club_id = club_id
      } else {
        // Show tables from all accessible clubs
        whereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause.club_id = club_id
    }

    const tables = await Table.findAll({
      where: whereClause,
      include: [
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
      order: [['table_number', 'ASC']],
    })

    return sendSuccess(res, tables, 'Available tables retrieved successfully')
  } catch (error) {
    logger.error('Error getting available tables:', error)
    return sendError(res, 'Failed to get available tables', 500)
  }
}

// Update table status
exports.updateTableStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!['available', 'occupied', 'maintenance', 'reserved'].includes(status)) {
      return sendError(res, 'Invalid status. Must be: available, occupied, maintenance, or reserved', 400)
    }

    const table = await Table.findByPk(id)

    if (!table) {
      return sendError(res, 'Table not found', 404)
    }

    // Check if user has access to this table's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(table.club_id)) {
      return sendError(res, 'You can only update tables from clubs you manage', 403)
    }

    await Table.update({ status }, { where: { id } })

    const updatedTable = await Table.findByPk(id, {
      include: [
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
    })

    logger.info(`Table status updated: ${id} to ${status} by user: ${req.userId}`)
    return sendSuccess(res, updatedTable, 'Table status updated successfully')
  } catch (error) {
    logger.error('Error updating table status:', error)
    return sendError(res, 'Failed to update table status', 500)
  }
}
exports.getTablePricing = async (req, res) => {
  try {
    const { id } = req.params

    const pricing = await db.game_pricing.findAll({
      where: { table_id: id, is_active: true },
      include: [
        {
          model: db.game_types,
          attributes: ['id', 'name', 'description'],
        },
      ],
      order: [['game_type_id', 'ASC']],
    })

    return successResponse(res, 'Pricing retrieved successfully', pricing)
  } catch (error) {
    console.error('Error fetching table pricing:', error)
    return errorResponse(res, 'Failed to get table pricing', 500)
  }
}

// Bulk update pricing for a table
exports.setTablePricing = async (req, res) => {
  const transaction = await db.sequelize.transaction()
  try {
    const { id: table_id } = req.params
    const { pricing } = req.body

    // Validate input
    if (!Array.isArray(pricing)) {
      await transaction.rollback()
      return errorResponse(res, 'Pricing data should be an array', 400)
    }

    // Check if table exists - using db.tables as defined in your models
    const table = await db.tables.findByPk(table_id, { transaction })
    if (!table) {
      await transaction.rollback()
      return errorResponse(res, 'Table not found', 404)
    }

    const results = []
    const gameTypeIds = []

    for (const item of pricing) {
      const { game_type_id, price, is_unlimited, time_limit_minutes } = item

      // Validate required fields
      if (!game_type_id || price === undefined) {
        await transaction.rollback()
        return errorResponse(res, 'Each pricing item requires game_type_id and price', 400)
      }

      // Check if game type exists - using db.gameTypes as defined
      const gameType = await db.gameTypes.findByPk(game_type_id, { transaction })
      if (!gameType) {
        await transaction.rollback()
        return errorResponse(res, `Game type ${game_type_id} not found`, 400)
      }

      // Prevent duplicate game types in single request
      if (gameTypeIds.includes(game_type_id)) {
        await transaction.rollback()
        return errorResponse(res, `Duplicate game type ${game_type_id} in request`, 400)
      }
      gameTypeIds.push(game_type_id)

      // Prepare pricing data
      const pricingData = {
        table_id,
        game_type_id,
        price,
        is_active: true,
        is_unlimited_time: Boolean(is_unlimited),
        time_limit_minutes: is_unlimited ? null : time_limit_minutes || 60,
      }

      // Set pricing type specific fields
      if (gameType.name.toLowerCase() === 'frame') {
        pricingData.fixed_price = price
        pricingData.price_per_minute = null
      } else {
        pricingData.price_per_minute = price
        pricingData.fixed_price = null
      }

      // Upsert operation - using db.gamePricings as defined
      const [result] = await db.gamePricings.upsert(pricingData, {
        where: { table_id, game_type_id },
        returning: true,
        transaction,
      })

      results.push(result)
    }

    // Deactivate old pricing - using db.gamePricings
    await db.gamePricings.update(
      { is_active: false },
      {
        where: {
          table_id,
          game_type_id: { [db.Sequelize.Op.notIn]: gameTypeIds },
        },
        transaction,
      }
    )

    await transaction.commit()
    return successResponse(res, 'Pricing updated successfully', results)
  } catch (error) {
    if (transaction.finished !== 'commit') {
      await transaction.rollback()
    }
    console.error('Error setting table pricing:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    })
    return errorResponse(res, 'Failed to set table pricing', 500)
  }
}
