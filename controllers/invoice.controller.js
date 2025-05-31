const db = require("../models")
const { successResponse, errorResponse } = require("../utils/responseHelper")
const logger = require("../utils/logger")

const Invoice = db.invoices
const InvoiceItem = db.invoiceItems
const Session = db.sessions
const Player = db.players

// Create invoice
exports.createInvoice = async (req, res) => {
  try {
    const { player_id, session_id, items, tax_rate = 0, discount = 0 } = req.body

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
      club_id: req.user.club_id,
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

    logger.info(`Invoice created: ${invoice.id} by user: ${req.user.id}`)
    return successResponse(res, "Invoice created successfully", invoice, 201)
  } catch (error) {
    logger.error("Error creating invoice:", error)
    return errorResponse(res, "Failed to create invoice", 500)
  }
}

// Get all invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const { status, player_id, page = 1, limit = 10 } = req.query

    const whereClause = { club_id: req.user.club_id }
    if (status) whereClause.status = status
    if (player_id) whereClause.player_id = player_id

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

    const invoice = await Invoice.findOne({
      where: { id, club_id: req.user.club_id },
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
          attributes: ["id", "start_time", "end_time", "total_cost"],
        },
      ],
    })

    if (!invoice) {
      return errorResponse(res, "Invoice not found", 404)
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

    const invoice = await Invoice.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!invoice) {
      return errorResponse(res, "Invoice not found", 404)
    }

    const updateData = { status }
    if (status === "paid") {
      updateData.paid_at = new Date()
      if (payment_method) {
        updateData.payment_method = payment_method
      }
    }

    await Invoice.update(updateData, { where: { id, club_id: req.user.club_id } })

    const updatedInvoice = await Invoice.findByPk(id)

    logger.info(`Invoice status updated: ${id} to ${status} by user: ${req.user.id}`)
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

    const invoice = await Invoice.findOne({
      where: { id, club_id: req.user.club_id },
    })

    if (!invoice) {
      return errorResponse(res, "Invoice not found", 404)
    }

    if (invoice.status === "paid") {
      return errorResponse(res, "Cannot delete paid invoice", 400)
    }

    await Invoice.destroy({ where: { id, club_id: req.user.club_id } })

    logger.info(`Invoice deleted: ${id} by user: ${req.user.id}`)
    return successResponse(res, "Invoice deleted successfully")
  } catch (error) {
    logger.error("Error deleting invoice:", error)
    return errorResponse(res, "Failed to delete invoice", 500)
  }
}
