const db = require('../models')
const { successResponse, errorResponse, sendSuccess } = require('../utils/responseHelper')
const logger = require('../utils/logger')
const { Op } = require('sequelize')

const Session = db.sessions
const Player = db.players
const Invoice = db.invoices
const CanteenOrder = db.canteenOrders

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const userId = req.userId
    const userRole = req.userRole // Assuming this is available from your auth middleware

    const dateFilter = {}
    if (start_date && end_date) {
      dateFilter.created_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      }
    }

    let whereCondition = {}

    // For sub-admin, get their club automatically
    if (userRole === 'sub_admin') {
      const club = await db.clubs.findOne({
        where: { created_by: userId },
        attributes: ['id'],
      })

      if (!club) {
        return errorResponse(res, 'No club assigned to this sub-admin', 400)
      }
      whereCondition.club_id = club.id
    }
    // For others (super_admin, etc.) use provided club_id if available
    else if (req.user.club_id) {
      whereCondition.club_id = req.user.club_id
    }

    // Total sessions
    const totalSessions = await Session.count({
      where: { ...whereCondition, ...dateFilter },
    })

    // Active sessions
    const activeSessions = await Session.count({
      where: { ...whereCondition, status: 'active' },
    })

    // Total players
    const totalPlayers = await Player.count({
      where: whereCondition,
    })

    // Total revenue
    const revenueResult = await Invoice.findOne({
      where: { ...whereCondition, status: 'paid', ...dateFilter },
      attributes: [[db.sequelize.fn('SUM', db.sequelize.col('total_amount')), 'total_revenue']],
    })

    const totalRevenue = revenueResult?.dataValues?.total_revenue || 0

    const stats = {
      totalSessions,
      activeSessions,
      totalPlayers,
      totalRevenue: Number.parseFloat(totalRevenue),
    }

    return successResponse(res, 'Dashboard statistics retrieved successfully', stats)
  } catch (error) {
    logger.error('Error getting dashboard stats:', error)
    return errorResponse(res, 'Failed to get dashboard statistics', 500)
  }
}

// Get revenue report
exports.getRevenueReport = async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query
    const clubId = req.user.club_id

    const dateFilter = {
      club_id: clubId,
      status: 'paid',
    }

    if (start_date && end_date) {
      dateFilter.created_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      }
    }

    let dateFormat
    switch (group_by) {
      case 'month':
        dateFormat = '%Y-%m'
        break
      case 'week':
        dateFormat = '%Y-%u'
        break
      default:
        dateFormat = '%Y-%m-%d'
    }

    const revenueData = await Invoice.findAll({
      where: dateFilter,
      attributes: [
        [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('created_at'), dateFormat), 'period'],
        [db.sequelize.fn('SUM', db.sequelize.col('total_amount')), 'revenue'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'invoice_count'],
      ],
      group: [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('created_at'), dateFormat)],
      order: [[db.sequelize.fn('DATE_FORMAT', db.sequelize.col('created_at'), dateFormat), 'ASC']],
    })

    return successResponse(res, 'Revenue report retrieved successfully', revenueData)
  } catch (error) {
    logger.error('Error getting revenue report:', error)
    return errorResponse(res, 'Failed to get revenue report', 500)
  }
}

// Get session report
exports.getSessionReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const clubId = req.user.club_id

    const dateFilter = { club_id: clubId }
    if (start_date && end_date) {
      dateFilter.created_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      }
    }

    const sessionData = await Session.findAll({
      where: dateFilter,
      attributes: [
        [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('created_at'), '%Y-%m-%d'), 'date'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'session_count'],
        [db.sequelize.fn('AVG', db.sequelize.col('duration_minutes')), 'avg_duration'],
        [db.sequelize.fn('SUM', db.sequelize.col('total_cost')), 'total_revenue'],
      ],
      group: [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('created_at'), '%Y-%m-%d')],
      order: [[db.sequelize.fn('DATE_FORMAT', db.sequelize.col('created_at'), '%Y-%m-%d'), 'ASC']],
    })

    return successResponse(res, 'Session report retrieved successfully', sessionData)
  } catch (error) {
    logger.error('Error getting session report:', error)
    return errorResponse(res, 'Failed to get session report', 500)
  }
}

// Get player report
exports.getPlayerReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const clubId = req.user.club_id

    const dateFilter = { club_id: clubId }
    if (start_date && end_date) {
      dateFilter.created_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      }
    }

    const playerData = await Player.findAll({
      where: { club_id: clubId },
      include: [
        {
          model: Session,
          as: 'sessions',
          where: dateFilter,
          required: false,
          attributes: [],
        },
      ],
      attributes: [
        'id',
        'name',
        'email',
        [db.sequelize.fn('COUNT', db.sequelize.col('sessions.id')), 'session_count'],
        [db.sequelize.fn('SUM', db.sequelize.col('sessions.total_cost')), 'total_spent'],
      ],
      group: ['Player.id'],
      order: [[db.sequelize.fn('COUNT', db.sequelize.col('sessions.id')), 'DESC']],
    })

    return successResponse(res, 'Player report retrieved successfully', playerData)
  } catch (error) {
    logger.error('Error getting player report:', error)
    return errorResponse(res, 'Failed to get player report', 500)
  }
}
