const db = require("../models")
const { successResponse, errorResponse } = require("../utils/responseHelper")
const logger = require("../utils/logger")

const GamePricing = db.gamePricings
const GameType = db.gameTypes

// Create game pricing
exports.createGamePricing = async (req, res) => {
  try {
    const { game_type_id, table_id, price_per_hour, price_per_game, effective_from } = req.body

    const gamePricing = await GamePricing.create({
      game_type_id,
      table_id,
      price_per_hour,
      price_per_game,
      effective_from: effective_from || new Date(),
      club_id: req.user.club_id,
    })

    logger.info(`Game pricing created: ${gamePricing.id} by user: ${req.user.id}`)
    return successResponse(res, "Game pricing created successfully", gamePricing, 201)
  } catch (error) {
    logger.error("Error creating game pricing:", error)
    return errorResponse(res, "Failed to create game pricing", 500)
  }
}

// Get all game pricings
exports.getAllGamePricings = async (req, res) => {
  try {
    const gamePricings = await GamePricing.findAll({
      where: { club_id: req.user.club_id },
      include: [
        {
          model: GameType,
          as: "gameType",
        },
      ],
      order: [["effective_from", "DESC"]],
    })

    return successResponse(res, "Game pricings retrieved successfully", gamePricings)
  } catch (error) {
    logger.error("Error getting game pricings:", error)
    return errorResponse(res, "Failed to get game pricings", 500)
  }
}

// Get game pricing by ID
exports.getGamePricingById = async (req, res) => {
  try {
    const { id } = req.params

    const gamePricing = await GamePricing.findOne({
      where: { id, club_id: req.user.club_id },
      include: [
        {
          model: GameType,
          as: "gameType",
        },
      ],
    })

    if (!gamePricing) {
      return errorResponse(res, "Game pricing not found", 404)
    }

    return successResponse(res, "Game pricing retrieved successfully", gamePricing)
  } catch (error) {
    logger.error("Error getting game pricing:", error)
    return errorResponse(res, "Failed to get game pricing", 500)
  }
}

// Update game pricing
exports.updateGamePricing = async (req, res) => {
  try {
    const { id } = req.params
    const { game_type_id, table_id, price_per_hour, price_per_game, effective_from } = req.body

    const gamePricing = await GamePricing.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!gamePricing) {
      return errorResponse(res, "Game pricing not found", 404)
    }

    await GamePricing.update(
      {
        game_type_id,
        table_id,
        price_per_hour,
        price_per_game,
        effective_from,
      },
      { where: { id, club_id: req.user.club_id } },
    )

    const updatedGamePricing = await GamePricing.findByPk(id, {
      include: [
        {
          model: GameType,
          as: "gameType",
        },
      ],
    })

    logger.info(`Game pricing updated: ${id} by user: ${req.user.id}`)
    return successResponse(res, "Game pricing updated successfully", updatedGamePricing)
  } catch (error) {
    logger.error("Error updating game pricing:", error)
    return errorResponse(res, "Failed to update game pricing", 500)
  }
}

// Delete game pricing
exports.deleteGamePricing = async (req, res) => {
  try {
    const { id } = req.params

    const gamePricing = await GamePricing.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!gamePricing) {
      return errorResponse(res, "Game pricing not found", 404)
    }

    await GamePricing.destroy({ where: { id, club_id: req.user.club_id } })

    logger.info(`Game pricing deleted: ${id} by user: ${req.user.id}`)
    return successResponse(res, "Game pricing deleted successfully")
  } catch (error) {
    logger.error("Error deleting game pricing:", error)
    return errorResponse(res, "Failed to delete game pricing", 500)
  }
}
