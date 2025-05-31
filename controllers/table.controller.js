const db = require('../models')
const { sendError, sendSuccess, sendPaginatedResponse, errorResponse } = require('../utils/responseHelper')
const logger = require('../utils/logger')

const Table = db.tables
const Session = db.sessions
const User = db.users
const Permission = db.permissions

const getUserWithPermissions = async userId => {
  return await User.findByPk(userId, {
    include: [{ model: Permission, as: 'permissions' }],
  })
}

// Create a new table
exports.createTable = async (req, res) => {
  try {
    const { table_number, table_type, hourly_rate, status } = req.body

    // Check if table number exists in the club
    const existingTable = await Table.findOne({
      where: { table_number, club_id: req.user.club_id },
    })

    if (existingTable) {
      return errorResponse(res, 'Table number already exists in this club', 400)
    }

    const table = await Table.create({
      table_number,
      table_type: table_type || 'standard',
      hourly_rate,
      status: status || 'available',
      club_id: req.user.club_id,
    })

    logger.info(`Table created: ${table.id} by user: ${req.user.id}`)
    return sendSuccess(res, 'Table created successfully', table, 201)
  } catch (error) {
    logger.error('Error creating table:', error)
    return errorResponse(res, 'Failed to create table', 500)
  }
}

// Get all tables
exports.getAllTables = async (req, res) => {
  try {
    console.log('User Id: ', req.userId)
    req.userId = 1
    const currentUser = await getUserWithPermissions(req.userId)
    if (!currentUser) {
      return sendError(res, 'User not found', 404)
    }
    console.log('Request query:', currentUser.role)

    const { status, page = 1, limit = 10 } = req.query

    // Initialize whereClause based on user role
    let whereClause = {}

    // Managers can only access their club's tables
    if (currentUser.role === 'manager') {
      whereClause.club_id = req.user.club_id
    }
    // Admins can access all tables (no club_id restriction)

    // Apply status filter if provided
    if (status) {
      whereClause.status = status
    }

    const offset = (page - 1) * limit

    const { count, rows: tables } = await Table.findAndCountAll({
      where: whereClause,
      order: [['table_number', 'ASC']],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
    })

    if (!tables || tables.length === 0) {
      return sendError(res, 'No tables found', 404)
    }

    // Success response with pagination
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

    const table = await Table.findOne({
      where: { id, club_id: req.user.club_id },
      include: [
        {
          model: Session,
          as: 'sessions',
          where: { status: 'active' },
          required: false,
        },
      ],
    })

    if (!table) {
      return errorResponse(res, 'Table not found', 404)
    }

    return sendSuccess(res, 'Table retrieved successfully', table)
  } catch (error) {
    logger.error('Error getting table:', error)
    return errorResponse(res, 'Failed to get table', 500)
  }
}

// Update table
exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params
    const { table_number, table_type, hourly_rate, status } = req.body

    const table = await Table.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!table) {
      return errorResponse(res, 'Table not found', 404)
    }

    // Check if new table number already exists (if changing table number)
    if (table_number && table_number !== table.table_number) {
      const existingTable = await Table.findOne({
        where: { table_number, club_id: req.user.club_id },
      })

      if (existingTable) {
        return errorResponse(res, 'Table number already exists in this club', 400)
      }
    }

    await Table.update(
      {
        table_number,
        table_type,
        hourly_rate,
        status,
      },
      { where: { id, club_id: req.user.club_id } }
    )

    const updatedTable = await Table.findByPk(id)

    logger.info(`Table updated: ${id} by user: ${req.user.id}`)
    return sendSuccess(res, 'Table updated successfully', updatedTable)
  } catch (error) {
    logger.error('Error updating table:', error)
    return errorResponse(res, 'Failed to update table', 500)
  }
}

// Delete table
exports.deleteTable = async (req, res) => {
  try {
    const { id } = req.params

    const table = await Table.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!table) {
      return errorResponse(res, 'Table not found', 404)
    }

    // Check if table has active sessions
    const activeSessions = await Session.findOne({
      where: { table_id: id, status: 'active' },
    })

    if (activeSessions) {
      return errorResponse(res, 'Cannot delete table with active sessions', 400)
    }

    await Table.destroy({ where: { id, club_id: req.user.club_id } })

    logger.info(`Table deleted: ${id} by user: ${req.user.id}`)
    return sendSuccess(res, 'Table deleted successfully')
  } catch (error) {
    logger.error('Error deleting table:', error)
    return errorResponse(res, 'Failed to delete table', 500)
  }
}

// Get available tables
exports.getAvailableTables = async (req, res) => {
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

    const tables = await Table.findAll({
      where: {
        club_id: clubIds,
        status: 'available',
      },
      order: [['table_number', 'ASC']],
    })

    return sendSuccess(res, tables, 'Available tables retrieved successfully')
  } catch (error) {
    logger.error('Error getting available tables:', error)
    return errorResponse(res, 'Failed to get available tables', 500)
  }
}

// Update table status
exports.updateTableStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!['available', 'occupied', 'maintenance', 'reserved'].includes(status)) {
      return errorResponse(res, 'Invalid status. Must be: available, occupied, maintenance, or reserved', 400)
    }

    const table = await Table.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!table) {
      return errorResponse(res, 'Table not found', 404)
    }

    await Table.update({ status }, { where: { id, club_id: req.user.club_id } })

    const updatedTable = await Table.findByPk(id)

    logger.info(`Table status updated: ${id} to ${status} by user: ${req.user.id}`)
    return sendSuccess(res, 'Table status updated successfully', updatedTable)
  } catch (error) {
    logger.error('Error updating table status:', error)
    return errorResponse(res, 'Failed to update table status', 500)
  }
}
