const db = require("../models")
const { Op } = require("sequelize")
const { sendSuccess, sendError } = require("../utils/responseHelper")

// Generate session code
const generateSessionCode = async () => {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "")

  const lastSession = await db.tableSessions.findOne({
    where: {
      session_code: {
        [Op.like]: `SES-${dateStr}%`,
      },
    },
    order: [["created_at", "DESC"]],
  })

  let sequence = 1
  if (lastSession) {
    const lastSequence = Number.parseInt(lastSession.session_code.split("-").pop())
    sequence = lastSequence + 1
  }

  return `SES-${dateStr}-${String(sequence).padStart(3, "0")}`
}

// Start session with player
exports.startSession = async (req, res) => {
  try {
    const {
      table_id,
      game_type_id,
      player_id,
      guest_player_name,
      guest_player_phone,
      is_guest = true,
      notes,
    } = req.body

    // Validate table
    const table = await db.tables.findByPk(table_id, {
      include: [
        {
          model: db.clubs,
          attributes: ["id", "name"],
        },
      ],
    })

    if (!table) {
      return sendError(res, "Table not found", 404)
    }

    if (table.status !== "available") {
      return sendError(res, "Table is not available", 400)
    }

    // Validate game type and pricing
    const gamePricing = await db.gamePricing.findOne({
      where: { table_id, game_type_id, is_active: true },
      include: [
        {
          model: db.gameTypes,
          attributes: ["id", "name", "pricing_type"],
        },
      ],
    })

    if (!gamePricing) {
      return sendError(res, "Game type not available for this table", 400)
    }

    // Validate player if not guest
    let player = null
    if (!is_guest && player_id) {
      player = await db.players.findByPk(player_id)
      if (!player || !player.is_active) {
        return sendError(res, "Invalid or inactive player", 400)
      }
    }

    const result = await db.sequelize.transaction(async (t) => {
      // Generate session code
      const session_code = await generateSessionCode()

      // Create session
      const session = await db.tableSessions.create(
        {
          session_code,
          table_id,
          game_type_id,
          player_id: is_guest ? null : player_id,
          guest_player_name,
          guest_player_phone,
          is_guest,
          start_time: new Date(),
          status: "active",
          notes,
          created_by: req.userId,
        },
        { transaction: t },
      )

      // Update table status
      await table.update({ status: "occupied" }, { transaction: t })

      // Update player visit count if registered player
      if (player) {
        await player.update({ total_visits: player.total_visits + 1 }, { transaction: t })
      }

      return session
    })

    // Return session with related data
    const sessionWithData = await db.tableSessions.findByPk(result.id, {
      include: [
        {
          model: db.tables,
          attributes: ["id", "table_number"],
          include: [
            {
              model: db.clubs,
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: db.gameTypes,
          attributes: ["id", "name", "pricing_type"],
        },
        {
          model: db.players,
          attributes: ["id", "player_code", "first_name", "last_name"],
          required: false,
        },
      ],
    })

    sendSuccess(res, sessionWithData, "Session started successfully", 201)
  } catch (err) {
    console.error("Start session error:", err)
    sendError(res, "Failed to start session", 500)
  }
}

// Add canteen order to session
exports.addCanteenOrderToSession = async (req, res) => {
  try {
    const { session_id, canteen_item_id, quantity, notes } = req.body

    // Validate session
    const session = await db.tableSessions.findByPk(session_id)
    if (!session || session.status !== "active") {
      return sendError(res, "Invalid or inactive session", 400)
    }

    // Validate canteen item
    const canteenItem = await db.canteenItems.findByPk(canteen_item_id)
    if (!canteenItem || !canteenItem.is_available) {
      return sendError(res, "Canteen item not available", 400)
    }

    // Check stock
    if (canteenItem.stock_quantity < quantity) {
      return sendError(res, `Insufficient stock. Available: ${canteenItem.stock_quantity}`, 400)
    }

    const result = await db.sequelize.transaction(async (t) => {
      const unit_price = Number.parseFloat(canteenItem.price)
      const total_price = unit_price * quantity

      // Create session canteen order
      const order = await db.sessionCanteenOrders.create(
        {
          session_id,
          canteen_item_id,
          quantity,
          unit_price,
          total_price,
          served_by: req.userId,
          notes,
        },
        { transaction: t },
      )

      // Update canteen item stock
      await canteenItem.update({ stock_quantity: canteenItem.stock_quantity - quantity }, { transaction: t })

      // Update session canteen amount
      const currentCanteenAmount = Number.parseFloat(session.canteen_amount || 0)
      const newCanteenAmount = currentCanteenAmount + total_price
      const newTotalAmount = Number.parseFloat(session.game_amount || 0) + newCanteenAmount

      await session.update(
        {
          canteen_amount: newCanteenAmount,
          total_amount: newTotalAmount,
        },
        { transaction: t },
      )

      return order
    })

    // Return order with item details
    const orderWithDetails = await db.sessionCanteenOrders.findByPk(result.id, {
      include: [
        {
          model: db.canteenItems,
          attributes: ["id", "name", "price"],
        },
      ],
    })

    sendSuccess(res, orderWithDetails, "Canteen order added to session successfully", 201)
  } catch (err) {
    console.error("Add canteen order error:", err)
    sendError(res, "Failed to add canteen order to session", 500)
  }
}

// Get session canteen orders
exports.getSessionCanteenOrders = async (req, res) => {
  try {
    const { session_id } = req.params

    const orders = await db.sessionCanteenOrders.findAll({
      where: { session_id },
      include: [
        {
          model: db.canteenItems,
          attributes: ["id", "name", "price"],
          include: [
            {
              model: db.canteenCategories,
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: db.users,
          as: "servedBy",
          attributes: ["id", "username"],
        },
      ],
      order: [["order_time", "ASC"]],
    })

    const totalAmount = orders.reduce((sum, order) => sum + Number.parseFloat(order.total_price), 0)

    sendSuccess(
      res,
      {
        orders,
        summary: {
          total_items: orders.length,
          total_amount: totalAmount,
        },
      },
      "Session canteen orders retrieved successfully",
    )
  } catch (err) {
    console.error("Get session canteen orders error:", err)
    sendError(res, "Failed to retrieve session canteen orders", 500)
  }
}

// End session with combined billing
exports.endSession = async (req, res) => {
  try {
    const { session_id } = req.params
    const { payment_method = "cash", create_invoice = true } = req.body

    const session = await db.tableSessions.findByPk(session_id, {
      include: [
        {
          model: db.tables,
          include: [
            {
              model: db.clubs,
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: db.gameTypes,
          attributes: ["id", "name", "pricing_type"],
        },
        {
          model: db.players,
          attributes: ["id", "player_code", "first_name", "last_name", "total_spent"],
          required: false,
        },
        {
          model: db.sessionCanteenOrders,
          as: "canteenOrders",
          include: [
            {
              model: db.canteenItems,
              attributes: ["id", "name", "price"],
            },
          ],
        },
      ],
    })

    if (!session) {
      return sendError(res, "Session not found", 404)
    }

    if (session.status !== "active") {
      return sendError(res, "Session is not active", 400)
    }

    const result = await db.sequelize.transaction(async (t) => {
      const now = new Date()
      const durationMinutes = Math.ceil((now - session.start_time) / (1000 * 60))

      // Calculate game amount based on pricing
      const gamePricing = await db.gamePricing.findOne({
        where: { table_id: session.table_id, game_type_id: session.game_type_id },
      })

      let gameAmount = 0
      if (gamePricing) {
        if (session.gameType.pricing_type === "fixed") {
          gameAmount = Number.parseFloat(gamePricing.fixed_price || gamePricing.price)
        } else if (session.gameType.pricing_type === "per_minute") {
          const pricePerMinute = Number.parseFloat(gamePricing.price_per_minute || gamePricing.price)
          let billableMinutes = durationMinutes

          if (!gamePricing.is_unlimited_time && gamePricing.time_limit_minutes) {
            billableMinutes = Math.min(durationMinutes, gamePricing.time_limit_minutes)
          }

          gameAmount = pricePerMinute * billableMinutes
        }
      }

      const canteenAmount = Number.parseFloat(session.canteen_amount || 0)
      const totalAmount = gameAmount + canteenAmount

      // Update session
      await session.update(
        {
          end_time: now,
          duration_minutes: durationMinutes,
          game_amount: gameAmount,
          total_amount: totalAmount,
          status: "completed",
          payment_status: create_invoice ? "pending" : "paid",
        },
        { transaction: t },
      )

      // Update table status
      await session.table.update({ status: "available" }, { transaction: t })

      // Update player total spent if registered player
      if (session.player) {
        await session.player.update(
          { total_spent: Number.parseFloat(session.player.total_spent) + totalAmount },
          { transaction: t },
        )
      }

      return session
    })

    // Create invoice if requested
    let invoice = null
    if (create_invoice && result.total_amount > 0) {
      try {
        // Generate invoice
        const invoiceData = await createSessionInvoice(result, payment_method, req.userId)
        invoice = invoiceData
      } catch (invoiceError) {
        console.error("Invoice creation error:", invoiceError)
        // Don't fail the session end if invoice creation fails
      }
    }

    sendSuccess(
      res,
      {
        session: result,
        invoice,
      },
      "Session ended successfully",
    )
  } catch (err) {
    console.error("End session error:", err)
    sendError(res, "Failed to end session", 500)
  }
}

// Helper function to create invoice from session
const createSessionInvoice = async (session, payment_method, created_by) => {
  const invoiceNumber = await generateInvoiceNumber(session.table.club.id)

  const subtotal = Number.parseFloat(session.total_amount)
  const tax_rate = 0.18 // 18% GST
  const tax_amount = subtotal * tax_rate
  const total_amount = subtotal + tax_amount

  const invoice = await db.invoices.create({
    invoice_number: invoiceNumber,
    session_id: session.id,
    club_id: session.table.club.id,
    customer_name: session.is_guest
      ? session.guest_player_name
      : `${session.player.first_name} ${session.player.last_name || ""}`.trim(),
    customer_phone: session.is_guest ? session.guest_player_phone : null,
    subtotal,
    tax_amount,
    total_amount,
    payment_method,
    payment_status: "pending",
    created_by,
  })

  // Create invoice items
  const invoiceItems = []

  // Add game session item
  if (session.game_amount > 0) {
    invoiceItems.push({
      invoice_id: invoice.id,
      item_type: "table_session",
      item_id: session.id,
      description: `${session.gameType.name} - Table ${session.table.table_number} (${session.duration_minutes} min)`,
      quantity: 1,
      unit_price: session.game_amount,
      total_price: session.game_amount,
    })
  }

  // Add canteen items
  for (const order of session.canteenOrders) {
    invoiceItems.push({
      invoice_id: invoice.id,
      item_type: "canteen_item",
      item_id: order.canteen_item_id,
      description: order.canteen_item.name,
      quantity: order.quantity,
      unit_price: order.unit_price,
      total_price: order.total_price,
    })
  }

  if (invoiceItems.length > 0) {
    await db.invoiceItems.bulkCreate(invoiceItems)
  }

  return invoice
}

// Helper function to generate invoice number (reuse from invoice controller)
const generateInvoiceNumber = async (club_id) => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")

  const prefix = `INV-${year}${month}`

  const lastInvoice = await db.invoices.findOne({
    where: {
      club_id,
      invoice_number: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["created_at", "DESC"]],
  })

  let sequence = 1
  if (lastInvoice) {
    const lastSequence = Number.parseInt(lastInvoice.invoice_number.split("-").pop())
    sequence = lastSequence + 1
  }

  return `${prefix}-${String(sequence).padStart(4, "0")}`
}

// Get active sessions with canteen orders
exports.getActiveSessions = async (req, res) => {
  try {
    const { club_id } = req.query

    const whereCondition = { status: "active" }

    const sessions = await db.tableSessions.findAll({
      where: whereCondition,
      include: [
        {
          model: db.tables,
          attributes: ["id", "table_number"],
          include: [
            {
              model: db.clubs,
              attributes: ["id", "name"],
              ...(club_id && { where: { id: club_id } }),
            },
          ],
        },
        {
          model: db.gameTypes,
          attributes: ["id", "name", "pricing_type"],
        },
        {
          model: db.players,
          attributes: ["id", "player_code", "first_name", "last_name"],
          required: false,
        },
        {
          model: db.sessionCanteenOrders,
          as: "canteenOrders",
          attributes: ["id", "quantity", "total_price", "status"],
          include: [
            {
              model: db.canteenItems,
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["start_time", "ASC"]],
    })

    // Add calculated duration and estimated cost
    const sessionsWithCalculations = sessions.map((session) => {
      const now = new Date()
      const currentDuration = Math.ceil((now - session.start_time) / (1000 * 60))
      const canteenTotal = session.canteenOrders.reduce((sum, order) => sum + Number.parseFloat(order.total_price), 0)

      return {
        ...session.toJSON(),
        current_duration_minutes: currentDuration,
        current_canteen_amount: canteenTotal,
        pending_canteen_orders: session.canteenOrders.filter((order) => order.status === "pending").length,
      }
    })

    sendSuccess(res, sessionsWithCalculations, "Active sessions retrieved successfully")
  } catch (err) {
    console.error("Get active sessions error:", err)
    sendError(res, "Failed to retrieve active sessions", 500)
  }
}
