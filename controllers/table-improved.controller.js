const db = require("../models")
const { Op } = require("sequelize")
const { sendSuccess, sendError, sendPaginatedResponse } = require("../utils/responseHelper")

exports.createTable = async (req, res) => {
  try {
    const { table_number, status = "available", manager_id } = req.body

    // Check if table number already exists
    const existingTable = await db.tables.findOne({
      where: { table_number },
    })

    if (existingTable) {
      return sendError(res, "Table number already exists", 409)
    }

    // If manager_id is provided, verify the manager exists and is active
    if (manager_id) {
      const manager = await db.users.findByPk(manager_id)
      if (!manager || manager.role !== "manager" || !manager.is_active) {
        return sendError(res, "Invalid or inactive manager", 400)
      }
    }

    const table = await db.tables.create({
      table_number,
      status,
      manager_id,
      created_by: req.userId,
    })

    sendSuccess(res, table, "Table created successfully", 201)
  } catch (err) {
    console.error("Create table error:", err)
    sendError(res, "Failed to create table", 500)
  }
}

exports.getAllTables = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, manager_id } = req.query

    const whereCondition = {}
    if (status) whereCondition.status = status
    if (manager_id) whereCondition.manager_id = manager_id

    const offset = (page - 1) * limit

    const { count, rows: tables } = await db.tables.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: db.users,
          as: "manager",
          attributes: ["id", "username"],
        },
        {
          model: db.users,
          as: "creator",
          attributes: ["id", "username"],
        },
        {
          model: db.gamePricing,
          include: [
            {
              model: db.gameTypes,
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: db.tableSessions,
          where: { status: "active" },
          required: false,
          include: [
            {
              model: db.gameTypes,
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["table_number", "ASC"]],
    })

    sendPaginatedResponse(
      res,
      tables,
      {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total: count,
      },
      "Tables retrieved successfully",
    )
  } catch (err) {
    console.error("Get all tables error:", err)
    sendError(res, "Failed to retrieve tables", 500)
  }
}

exports.getAvailableTables = async (req, res) => {
  try {
    const tables = await db.tables.findAll({
      where: { status: "available" },
      include: [
        {
          model: db.gamePricing,
          include: [db.gameTypes],
        },
      ],
      order: [["table_number", "ASC"]],
    })

    sendSuccess(res, tables, "Available tables retrieved successfully")
  } catch (err) {
    console.error("Get available tables error:", err)
    sendError(res, "Failed to retrieve available tables", 500)
  }
}

exports.getTableById = async (req, res) => {
  try {
    const table = await db.tables.findByPk(req.params.id, {
      include: [
        {
          model: db.users,
          as: "manager",
          attributes: ["id", "username"],
        },
        {
          model: db.users,
          as: "creator",
          attributes: ["id", "username"],
        },
        {
          model: db.gamePricing,
          include: [db.gameTypes],
        },
        {
          model: db.tableSessions,
          where: { status: "active" },
          required: false,
          include: [
            {
              model: db.gameTypes,
              attributes: ["id", "name"],
            },
          ],
        },
      ],
    })

    if (!table) {
      return sendError(res, "Table not found", 404)
    }

    sendSuccess(res, table, "Table retrieved successfully")
  } catch (err) {
    console.error("Get table by ID error:", err)
    sendError(res, "Failed to retrieve table", 500)
  }
}

exports.updateTable = async (req, res) => {
  try {
    const { table_number, status, manager_id } = req.body

    const table = await db.tables.findByPk(req.params.id)
    if (!table) {
      return sendError(res, "Table not found", 404)
    }

    // Check if new table number already exists (if changing)
    if (table_number && table_number !== table.table_number) {
      const existingTable = await db.tables.findOne({
        where: { table_number, id: { [Op.ne]: table.id } },
      })
      if (existingTable) {
        return sendError(res, "Table number already exists", 409)
      }
    }

    // Validate manager if provided
    if (manager_id) {
      const manager = await db.users.findByPk(manager_id)
      if (!manager || manager.role !== "manager" || !manager.is_active) {
        return sendError(res, "Invalid or inactive manager", 400)
      }
    }

    // Don't allow status change if there's an active session
    if (status && status !== table.status) {
      const activeSession = await db.tableSessions.findOne({
        where: { table_id: table.id, status: "active" },
      })
      if (activeSession && status === "maintenance") {
        return sendError(res, "Cannot change status while session is active", 400)
      }
    }

    const updateData = {}
    if (table_number) updateData.table_number = table_number
    if (status) updateData.status = status
    if (manager_id !== undefined) updateData.manager_id = manager_id

    await table.update(updateData)

    sendSuccess(res, table, "Table updated successfully")
  } catch (err) {
    console.error("Update table error:", err)
    sendError(res, "Failed to update table", 500)
  }
}

exports.deleteTable = async (req, res) => {
  try {
    const table = await db.tables.findByPk(req.params.id)
    if (!table) {
      return sendError(res, "Table not found", 404)
    }

    // Check for active sessions
    const activeSession = await db.tableSessions.findOne({
      where: { table_id: table.id, status: "active" },
    })
    if (activeSession) {
      return sendError(res, "Cannot delete table with active session", 400)
    }

    await table.destroy()
    sendSuccess(res, null, "Table deleted successfully")
  } catch (err) {
    console.error("Delete table error:", err)
    sendError(res, "Failed to delete table", 500)
  }
}

exports.updateTablePricing = async (req, res) => {
  try {
    const { pricing } = req.body

    if (!Array.isArray(pricing) || pricing.length === 0) {
      return sendError(res, "Pricing array is required", 400)
    }

    const table = await db.tables.findByPk(req.params.id)
    if (!table) {
      return sendError(res, "Table not found", 404)
    }

    await db.sequelize.transaction(async (t) => {
      for (const priceData of pricing) {
        const { game_type_id, price, time_limit_minutes, is_unlimited = false } = priceData

        // Validate game type exists
        const gameType = await db.gameTypes.findByPk(game_type_id)
        if (!gameType) {
          throw new Error(`Game type ${game_type_id} not found`)
        }

        const [gamePricing, created] = await db.gamePricing.findOrCreate({
          where: {
            table_id: table.id,
            game_type_id,
          },
          defaults: {
            price,
            time_limit_minutes,
            is_unlimited,
          },
          transaction: t,
        })

        if (!created) {
          await gamePricing.update(
            {
              price,
              time_limit_minutes,
              is_unlimited,
            },
            { transaction: t },
          )
        }
      }
    })

    sendSuccess(res, null, "Table pricing updated successfully")
  } catch (err) {
    console.error("Update table pricing error:", err)
    sendError(res, err.message || "Failed to update table pricing", 500)
  }
}

exports.startSession = async (req, res) => {
  try {
    const { game_type_id, player_name, is_guest = true } = req.body

    const table = await db.tables.findByPk(req.params.id)
    if (!table) {
      return sendError(res, "Table not found", 404)
    }

    if (table.status !== "available") {
      return sendError(res, "Table is not available", 400)
    }

    // Check if game type exists and has pricing for this table
    const gamePricing = await db.gamePricing.findOne({
      where: {
        table_id: table.id,
        game_type_id,
      },
      include: [db.gameTypes],
    })

    if (!gamePricing) {
      return sendError(res, "Game type not available for this table", 400)
    }

    const result = await db.sequelize.transaction(async (t) => {
      // Create session
      const session = await db.tableSessions.create(
        {
          table_id: table.id,
          game_type_id,
          player_name,
          is_guest,
          status: "active",
          start_time: new Date(),
        },
        { transaction: t },
      )

      // Update table status
      await table.update({ status: "occupied" }, { transaction: t })

      return session
    })

    sendSuccess(res, result, "Session started successfully", 201)
  } catch (err) {
    console.error("Start session error:", err)
    sendError(res, "Failed to start session", 500)
  }
}

exports.endSession = async (req, res) => {
  try {
    const session = await db.tableSessions.findByPk(req.params.sessionId, {
      include: [
        {
          model: db.tables,
        },
        {
          model: db.gameTypes,
        },
      ],
    })

    if (!session) {
      return sendError(res, "Session not found", 404)
    }

    if (session.status !== "active") {
      return sendError(res, "Session is not active", 400)
    }

    // Get pricing information
    const gamePricing = await db.gamePricing.findOne({
      where: {
        table_id: session.table_id,
        game_type_id: session.game_type_id,
      },
    })

    if (!gamePricing) {
      return sendError(res, "Pricing information not found", 404)
    }

    const result = await db.sequelize.transaction(async (t) => {
      const now = new Date()
      const durationMinutes = Math.ceil((now - session.start_time) / (1000 * 60))

      let totalAmount = 0

      // Calculate amount based on game type
      if (session.gameType.name === "Frames") {
        // For frames, charge fixed price per game
        totalAmount = Number.parseFloat(gamePricing.price)
      } else if (session.gameType.name === "Century") {
        // For century/time-based games
        if (gamePricing.is_unlimited) {
          totalAmount = Number.parseFloat(gamePricing.price) * durationMinutes
        } else {
          const timeUsed = Math.min(durationMinutes, gamePricing.time_limit_minutes || durationMinutes)
          totalAmount = Number.parseFloat(gamePricing.price) * timeUsed
        }
      }

      // Update session
      await session.update(
        {
          end_time: now,
          total_amount: totalAmount,
          status: "completed",
        },
        { transaction: t },
      )

      // Update table status
      await session.table.update({ status: "available" }, { transaction: t })

      return session
    })

    sendSuccess(res, result, "Session ended successfully")
  } catch (err) {
    console.error("End session error:", err)
    sendError(res, "Failed to end session", 500)
  }
}

exports.getActiveSessions = async (req, res) => {
  try {
    const sessions = await db.tableSessions.findAll({
      where: { status: "active" },
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
      order: [["start_time", "ASC"]],
    })

    sendSuccess(res, sessions, "Active sessions retrieved successfully")
  } catch (err) {
    console.error("Get active sessions error:", err)
    sendError(res, "Failed to retrieve active sessions", 500)
  }
}
