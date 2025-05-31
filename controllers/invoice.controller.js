const db = require("../models")
const { successResponse, errorResponse } = require("../utils/responseHelper")
const logger = require("../utils/logger")

const Invoice = db.invoices
const InvoiceItem = db.invoiceItems
const Session = db.sessions
const Player = db.players
const ClubManager = db.club_managers

// Helper function to get user's club access
const getUserClubAccess = async (userId, userRole) => {
  if (userRole === "manager") {
    const clubManager = await ClubManager.findOne({
      where: { manager_id: userId, is_active: true },
    })
    return clubManager ? [clubManager.club_id] : []
  } else if (userRole === "sub_admin") {
    const clubManagers = await ClubManager.findAll({
      where: { admin_id: userId, is_active: true },
    })
    return clubManagers.map((cm) => cm.club_id)
  }
  return null // Super admin has access to all
}

// Create invoice
exports.createInvoice = async (req, res) => {
  try {
    const { player_id, session_id, items, tax_rate = 0, discount = 0, club_id } = req.body

    // Validate club_id
    if (!club_id) {
      return errorResponse(res, "Club ID is required", 400)
    }

    // Check if user has access to this club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(Number.parseInt(club_id))) {
      return errorResponse(res, "You can only create invoices for clubs you manage", 403)
    }

    // Calculate totals
    let subtotal = 0
    if (items && items.length > 0) {
      subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    }

    const tax_amount = subtotal * (tax_rate / 100)
    const total_amount = subtotal + tax_amount - discount

    const invoice = await Invoice.create({
      player_id,
      session_id,
      subtotal,
      tax_rate,
      tax_amount,
      discount,
      total_amount,
      status: "pending",
      club_id,
    })

    // Create invoice items if provided
    if (items && items.length > 0) {
      const invoiceItems = items.map((item) => ({
        invoice_id: invoice.id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      }))

      await InvoiceItem.bulkCreate(invoiceItems)
    }

    // Get complete invoice data
    const completeInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        {
          model: Player,
          as: "player",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: InvoiceItem,
          as: "items",
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
    })

    logger.info(`Invoice created: ${invoice.id} by user: ${req.userId}`)
    return successResponse(res, "Invoice created successfully", completeInvoice, 201)
  } catch (error) {
    logger.error("Error creating invoice:", error)
    return errorResponse(res, "Failed to create invoice", 500)
  }
}

// Get all invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const { status, player_id, page = 1, limit = 10, club_id } = req.query

    const whereClause = {}
    if (status) whereClause.status = status
    if (player_id) whereClause.player_id = player_id

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, "You can only view invoices for clubs you manage", 403)
        }
        whereClause.club_id = club_id
      } else {
        // Show invoices from all accessible clubs
        whereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause.club_id = club_id
    }

    const offset = (page - 1) * limit

    const { count, rows: invoices } = await Invoice.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Player,
          as: "player",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: InvoiceItem,
          as: "items",
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
    })

    return successResponse(res, "Invoices retrieved successfully", {
      invoices,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error("Error getting invoices:", error)
    return errorResponse(res, "Failed to get invoices", 500)
  }
}

// Get invoice by ID
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params

    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: Player,
          as: "player",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: InvoiceItem,
          as: "items",
        },
        {
          model: Session,
          as: "session",
          attributes: ["id", "start_time", "end_time", "total_amount"],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
    })

    if (!invoice) {
      return errorResponse(res, "Invoice not found", 404)
    }

    // Check if user has access to this invoice's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(invoice.club_id)) {
      return errorResponse(res, "You can only view invoices for clubs you manage", 403)
    }

    return successResponse(res, "Invoice retrieved successfully", invoice)
  } catch (error) {
    logger.error("Error getting invoice:", error)
    return errorResponse(res, "Failed to get invoice", 500)
  }
}

// Update invoice status
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, payment_method } = req.body

    if (!["pending", "paid", "cancelled"].includes(status)) {
      return errorResponse(res, "Invalid status. Must be: pending, paid, or cancelled", 400)
    }

    const invoice = await Invoice.findByPk(id)

    if (!invoice) {
      return errorResponse(res, "Invoice not found", 404)
    }

    // Check if user has access to this invoice's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(invoice.club_id)) {
      return errorResponse(res, "You can only update invoices for clubs you manage", 403)
    }

    const updateData = { status }
    if (status === "paid") {
      updateData.paid_at = new Date()
      if (payment_method) {
        updateData.payment_method = payment_method
      }
    }

    await Invoice.update(updateData, { where: { id } })

    const updatedInvoice = await Invoice.findByPk(id, {
      include: [
        {
          model: Player,
          as: "player",
          attributes: ["id", "name", "email", "phone"],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
    })

    logger.info(`Invoice status updated: ${id} to ${status} by user: ${req.userId}`)
    return successResponse(res, "Invoice status updated successfully", updatedInvoice)
  } catch (error) {
    logger.error("Error updating invoice status:", error)
    return errorResponse(res, "Failed to update invoice status", 500)
  }
}

// Delete invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params

    const invoice = await Invoice.findByPk(id)

    if (!invoice) {
      return errorResponse(res, "Invoice not found", 404)
    }

    // Check if user has access to this invoice's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(invoice.club_id)) {
      return errorResponse(res, "You can only delete invoices for clubs you manage", 403)
    }

    if (invoice.status === "paid") {
      return errorResponse(res, "Cannot delete paid invoice", 400)
    }

    await Invoice.destroy({ where: { id } })

    logger.info(`Invoice deleted: ${id} by user: ${req.userId}`)
    return successResponse(res, "Invoice deleted successfully")
  } catch (error) {
    logger.error("Error deleting invoice:", error)
    return errorResponse(res, "Failed to delete invoice", 500)
  }
}
