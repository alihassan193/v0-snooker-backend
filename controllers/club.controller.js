const db = require('../models')
const { successResponse, errorResponse } = require('../utils/responseHelper')
const logger = require('../utils/logger')

// Create a new club
exports.createClub = async (req, res) => {
  try {
    const { name, address, phone, email, description } = req.body

    const club = await db.clubs.create({
      name,
      address,
      phone,
      email,
      description,
      status: 'active',
    })

    logger.info(`Club created: ${club.id} by user: ${req.user.id}`)
    return successResponse(res, 'Club created successfully', club, 201)
  } catch (error) {
    logger.error('Error creating club:', error)
    return errorResponse(res, 'Failed to create club', 500)
  }
}

// Get all clubs
exports.getAllClubs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const offset = (page - 1) * limit

    const { count, rows } = await db.clubs.findAndCountAll({
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [['name', 'ASC']],
    })
    console.log(rows)
    return successResponse(res, 'Clubs retrieved successfully', {
      clubs: rows,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error('Error getting clubs:', error)
    return errorResponse(res, 'Failed to get clubs', 500)
  }
}

// Get club by ID
exports.getClubById = async (req, res) => {
  try {
    const { id } = req.params

    const club = await db.clubs.findByPk(id)

    if (!club) {
      return errorResponse(res, 'Club not found', 404)
    }

    return successResponse(res, 'Club retrieved successfully', club)
  } catch (error) {
    logger.error('Error getting club:', error)
    return errorResponse(res, 'Failed to get club', 500)
  }
}

// Update club
exports.updateClub = async (req, res) => {
  try {
    const { id } = req.params
    const { name, address, phone, email, description, status } = req.body

    const club = await db.clubs.findByPk(id)

    if (!club) {
      return errorResponse(res, 'Club not found', 404)
    }

    await db.clubs.update(
      {
        name,
        address,
        phone,
        email,
        description,
        status,
      },
      { where: { id } }
    )

    const updatedClub = await db.clubs.findByPk(id)

    logger.info(`Club updated: ${id} by user: ${req.user.id}`)
    return successResponse(res, 'Club updated successfully', updatedClub)
  } catch (error) {
    logger.error('Error updating club:', error)
    return errorResponse(res, 'Failed to update club', 500)
  }
}

// Delete club
exports.deleteClub = async (req, res) => {
  try {
    const { id } = req.params

    const club = await db.clubs.findByPk(id)

    if (!club) {
      return errorResponse(res, 'Club not found', 404)
    }

    await db.clubs.destroy({ where: { id } })

    logger.info(`Club deleted: ${id} by user: ${req.user.id}`)
    return successResponse(res, 'Club deleted successfully')
  } catch (error) {
    logger.error('Error deleting club:', error)
    return errorResponse(res, 'Failed to delete club', 500)
  }
}
