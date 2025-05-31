const db = require("../models")
const { Op } = require("sequelize")
const { sendSuccess, sendError } = require("../utils/responseHelper")

// Generate invoice number for canteen-only invoices
const generateCanteenInvoiceNumber = async (club_id) => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")

  const prefix = `CAN-${year}${month}`

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

// Create canteen-only invoice
exports.createCanteenInvoice = async (req, res) => {
  try {
    const {
      club_id,
      customer_name,
      customer_phone,
      customer_email,
      items, // Array of {canteen_item_id, quantity}
      payment_method = "cash",
      discount_amount = 0,
      notes,
      is_guest = true,
      player_id, // Optional: if customer is a registered player
    } = req.body

    // Validate club access
    if (req.userRole === "sub_admin") {
      const club = await db.clubs.findByPk(club_id)
      if (!club || club.created_by !== req.userId) {
        return sendError(res, "Access denied to this club", 403)
      }
    } else if (req.userRole === "manager") {
      const managerPermission = await db.managerPermissions.findOne({
        where: {
          manager_id: req.userId,
          club_id,
          can_manage_canteen: true,
        },
      })

      if (!managerPermission) {
        return sendError(res, "Insufficient permissions for canteen management", 403)
      }
    }

    // Validate items and check stock
    if (!items || items.length === 0) {
      return sendError(res, "At least one item is required", 400)
    }

    const itemDetails = []
    let subtotal = 0

    for (const item of items) {
      const canteenItem = await db.canteenItems.findOne({
        where: {
          id: item.canteen_item_id,
          club_id,
          is_available: true,
        },
      })

      if (!canteenItem) {
        return sendError(res, `Item with ID ${item.canteen_item_id} not found or not available`, 404)
      }

      if (canteenItem.stock_quantity < item.quantity) {
        return sendError(
          res,
          `Insufficient stock for ${canteenItem.name}. Available: ${canteenItem.stock_quantity}`,
          400,
        )
      }

      const itemTotal = Number.parseFloat(canteenItem.price) * item.quantity
      subtotal += itemTotal

      itemDetails.push({
        canteen_item: canteenItem,
        quantity: item.quantity,
        unit_price: canteenItem.price,
        total_price: itemTotal,
      })
    }

    // Validate player if provided
    let player = null
    if (!is_guest && player_id) {
      player = await db.players.findOne({
        where: { id: player_id, club_id, is_active: true },
      })
      if (!player) {
        return sendError(res, "Player not found in this club", 404)
      }
    }

    const result = await db.sequelize.transaction(async (t) => {
      // Generate invoice number
      const invoice_number = await generateCanteenInvoiceNumber(club_id)

      // Calculate totals
      const tax_rate = 0.18 // 18% GST
      const tax_amount = subtotal * tax_rate
      const total_amount = subtotal + tax_amount - Number.parseFloat(discount_amount)

      // Create invoice
      const invoice = await db.invoices.create(
        {
          invoice_number,
          session_id: null, // No session for canteen-only invoice
          club_id,
          customer_name: is_guest ? customer_name : `${player.first_name} ${player.last_name || ""}`.trim(),
          customer_phone: is_guest ? customer_phone : player.phone,
          customer_email: is_guest ? customer_email : player.email,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          payment_method,
          payment_status: "pending",
          notes,
          created_by: req.userId,
        },
        { transaction: t },
      )

      // Create invoice items and update stock
      const invoiceItems = []
      for (const itemDetail of itemDetails) {
        // Create invoice item
        invoiceItems.push({
          invoice_id: invoice.id,
          item_type: "canteen_item",
          item_id: itemDetail.canteen_item.id,
          description: itemDetail.canteen_item.name,
          quantity: itemDetail.quantity,
          unit_price: itemDetail.unit_price,
          total_price: itemDetail.total_price,
        })

        // Update stock
        await itemDetail.canteen_item.update(
          {
            stock_quantity: itemDetail.canteen_item.stock_quantity - itemDetail.quantity,
          },
          { transaction: t },
        )
      }

      await db.invoiceItems.bulkCreate(invoiceItems, { transaction: t })

      // Update player total spent if registered player
      if (player) {
        await player.update(
          {
            total_spent: Number.parseFloat(player.total_spent) + total_amount,
            total_visits: player.total_visits + 1,
          },
          { transaction: t },
        )
      }

      return invoice
    })

    // Return complete invoice data
    const completeInvoice = await db.invoices.findByPk(result.id, {
      include: [
        {
          model: db.invoiceItems,
          as: "items",
        },
        {
          model: db.clubs,
          attributes: ["id", "name", "address", "phone", "email"],
        },
      ],
    })

    sendSuccess(res, completeInvoice, "Canteen invoice created successfully", 201)
  } catch (err) {
    console.error("Create canteen invoice error:", err)
    sendError(res, "Failed to create canteen invoice", 500)
  }
}

// Quick sale - simplified canteen invoice for single item
exports.createQuickSale = async (req, res) => {
  try {
    const {
      club_id,
      canteen_item_id,
      quantity = 1,
      customer_name = "Walk-in Customer",
      payment_method = "cash",
    } = req.body

    // Validate permissions (same as above)
    if (req.userRole === "manager") {
      const managerPermission = await db.managerPermissions.findOne({
        where: {
          manager_id: req.userId,
          club_id,
          can_manage_canteen: true,
        },
      })

      if (!managerPermission) {
        return sendError(res, "Insufficient permissions for canteen management", 403)
      }
    }

    // Get item details
    const canteenItem = await db.canteenItems.findOne({
      where: {
        id: canteen_item_id,
        club_id,
        is_available: true,
      },
    })

    if (!canteenItem) {
      return sendError(res, "Item not found or not available", 404)
    }

    if (canteenItem.stock_quantity < quantity) {
      return sendError(res, `Insufficient stock. Available: ${canteenItem.stock_quantity}`, 400)
    }

    const result = await db.sequelize.transaction(async (t) => {
      // Generate invoice number
      const invoice_number = await generateCanteenInvoiceNumber(club_id)

      // Calculate totals
      const subtotal = Number.parseFloat(canteenItem.price) * quantity
      const tax_rate = 0.18
      const tax_amount = subtotal * tax_rate
      const total_amount = subtotal + tax_amount

      // Create invoice
      const invoice = await db.invoices.create(
        {
          invoice_number,
          session_id: null,
          club_id,
          customer_name,
          subtotal,
          tax_amount,
          total_amount,
          payment_method,
          payment_status: "paid", // Quick sales are usually paid immediately
          created_by: req.userId,
        },
        { transaction: t },
      )

      // Create invoice item
      await db.invoiceItems.create(
        {
          invoice_id: invoice.id,
          item_type: "canteen_item",
          item_id: canteenItem.id,
          description: canteenItem.name,
          quantity,
          unit_price: canteenItem.price,
          total_price: subtotal,
        },
        { transaction: t },
      )

      // Update stock
      await canteenItem.update(
        {
          stock_quantity: canteenItem.stock_quantity - quantity,
        },
        { transaction: t },
      )

      return invoice
    })

    sendSuccess(res, result, "Quick sale completed successfully", 201)
  } catch (err) {
    console.error("Create quick sale error:", err)
    sendError(res, "Failed to create quick sale", 500)
  }
}

// Get canteen sales report
exports.getCanteenSalesReport = async (req, res) => {
  try {
    const { club_id } = req.params
    const { startDate, endDate, item_id } = req.query

    // Validate permissions
    if (req.userRole === "manager") {
      const managerPermission = await db.managerPermissions.findOne({
        where: {
          manager_id: req.userId,
          club_id,
          can_view_reports: true,
        },
      })

      if (!managerPermission) {
        return sendError(res, "Insufficient permissions for reports", 403)
      }
    }

    const whereCondition = {
      club_id,
      session_id: null, // Only canteen-only invoices
    }

    if (startDate && endDate) {
      whereCondition.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      }
    }

    // Get invoice items for canteen-only sales
    const itemWhereCondition = { item_type: "canteen_item" }
    if (item_id) {
      itemWhereCondition.item_id = item_id
    }

    const salesData = await db.invoiceItems.findAll({
      where: itemWhereCondition,
      include: [
        {
          model: db.invoices,
          where: whereCondition,
          attributes: ["id", "invoice_number", "created_at", "payment_status"],
        },
      ],
      attributes: [
        "item_id",
        "description",
        [db.sequelize.fn("SUM", db.sequelize.col("quantity")), "total_quantity"],
        [db.sequelize.fn("SUM", db.sequelize.col("total_price")), "total_revenue"],
        [db.sequelize.fn("COUNT", db.sequelize.col("invoice_items.id")), "total_orders"],
      ],
      group: ["item_id", "description"],
      order: [[db.sequelize.fn("SUM", db.sequelize.col("total_price")), "DESC"]],
    })

    // Get overall summary
    const summary = await db.invoices.findOne({
      where: whereCondition,
      attributes: [
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "total_invoices"],
        [db.sequelize.fn("SUM", db.sequelize.col("total_amount")), "total_revenue"],
        [db.sequelize.fn("SUM", db.sequelize.col("tax_amount")), "total_tax"],
      ],
    })

    sendSuccess(
      res,
      {
        sales_by_item: salesData,
        summary,
      },
      "Canteen sales report retrieved successfully",
    )
  } catch (err) {
    console.error("Get canteen sales report error:", err)
    sendError(res, "Failed to retrieve canteen sales report", 500)
  }
}
