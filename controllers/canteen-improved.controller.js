const db = require("../models")
const { Op } = require("sequelize")
const { sendSuccess, sendError, sendPaginatedResponse } = require("../utils/responseHelper")

// Categories
exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body

    // Check if category already exists
    const existingCategory = await db.canteenCategories.findOne({
      where: { name: { [Op.iLike]: name } }, // Case-insensitive search
    })

    if (existingCategory) {
      return sendError(res, "Category already exists", 409)
    }

    const category = await db.canteenCategories.create({ name })
    sendSuccess(res, category, "Category created successfully", 201)
  } catch (err) {
    console.error("Create category error:", err)
    sendError(res, "Failed to create category", 500)
  }
}

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await db.canteenCategories.findAll({
      include: [
        {
          model: db.canteenItems,
          attributes: ["id"],
          required: false,
        },
      ],
      order: [["name", "ASC"]],
    })

    // Add item count to each category
    const categoriesWithCount = categories.map((category) => ({
      ...category.toJSON(),
      itemCount: category.canteen_items ? category.canteen_items.length : 0,
    }))

    sendSuccess(res, categoriesWithCount, "Categories retrieved successfully")
  } catch (err) {
    console.error("Get categories error:", err)
    sendError(res, "Failed to retrieve categories", 500)
  }
}

exports.updateCategory = async (req, res) => {
  try {
    const { name } = req.body

    const category = await db.canteenCategories.findByPk(req.params.id)
    if (!category) {
      return sendError(res, "Category not found", 404)
    }

    // Check if new name already exists (excluding current category)
    if (name && name !== category.name) {
      const existingCategory = await db.canteenCategories.findOne({
        where: {
          name: { [Op.iLike]: name },
          id: { [Op.ne]: category.id },
        },
      })

      if (existingCategory) {
        return sendError(res, "Category name already exists", 409)
      }
    }

    await category.update({ name })
    sendSuccess(res, category, "Category updated successfully")
  } catch (err) {
    console.error("Update category error:", err)
    sendError(res, "Failed to update category", 500)
  }
}

exports.deleteCategory = async (req, res) => {
  try {
    const category = await db.canteenCategories.findByPk(req.params.id)
    if (!category) {
      return sendError(res, "Category not found", 404)
    }

    // Check if category has items
    const itemCount = await db.canteenItems.count({
      where: { category_id: category.id },
    })

    if (itemCount > 0) {
      return sendError(res, "Cannot delete category with existing items", 400)
    }

    await category.destroy()
    sendSuccess(res, null, "Category deleted successfully")
  } catch (err) {
    console.error("Delete category error:", err)
    sendError(res, "Failed to delete category", 500)
  }
}

// Items
exports.createItem = async (req, res) => {
  try {
    const { name, description, price, stock_quantity = 0, category_id, image_url, is_available = true } = req.body

    // Validate category exists
    const category = await db.canteenCategories.findByPk(category_id)
    if (!category) {
      return sendError(res, "Category not found", 404)
    }

    // Check if item name already exists in the same category
    const existingItem = await db.canteenItems.findOne({
      where: {
        name: { [Op.iLike]: name },
        category_id,
      },
    })

    if (existingItem) {
      return sendError(res, "Item already exists in this category", 409)
    }

    const item = await db.canteenItems.create({
      name,
      description,
      price,
      stock_quantity,
      category_id,
      image_url,
      is_available,
      created_by: req.userId,
    })

    // Include category information in response
    const itemWithCategory = await db.canteenItems.findByPk(item.id, {
      include: [
        {
          model: db.canteenCategories,
          attributes: ["id", "name"],
        },
      ],
    })

    sendSuccess(res, itemWithCategory, "Item created successfully", 201)
  } catch (err) {
    console.error("Create item error:", err)
    sendError(res, "Failed to create item", 500)
  }
}

exports.getAllItems = async (req, res) => {
  try {
    const { page = 1, limit = 10, category_id, is_available, search, low_stock } = req.query

    const whereCondition = {}
    if (category_id) whereCondition.category_id = category_id
    if (is_available !== undefined) whereCondition.is_available = is_available === "true"
    if (search) {
      whereCondition[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { description: { [Op.iLike]: `%${search}%` } }]
    }
    if (low_stock === "true") {
      whereCondition.stock_quantity = { [Op.lt]: 10 }
    }

    const offset = (page - 1) * limit

    const { count, rows: items } = await db.canteenItems.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: db.canteenCategories,
          attributes: ["id", "name"],
        },
        {
          model: db.users,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["name", "ASC"]],
    })

    sendPaginatedResponse(
      res,
      items,
      {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total: count,
      },
      "Items retrieved successfully",
    )
  } catch (err) {
    console.error("Get items error:", err)
    sendError(res, "Failed to retrieve items", 500)
  }
}

exports.getItemById = async (req, res) => {
  try {
    const item = await db.canteenItems.findByPk(req.params.id, {
      include: [
        {
          model: db.canteenCategories,
          attributes: ["id", "name"],
        },
        {
          model: db.users,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
    })

    if (!item) {
      return sendError(res, "Item not found", 404)
    }

    sendSuccess(res, item, "Item retrieved successfully")
  } catch (err) {
    console.error("Get item by ID error:", err)
    sendError(res, "Failed to retrieve item", 500)
  }
}

exports.updateItem = async (req, res) => {
  try {
    const { name, description, price, stock_quantity, category_id, image_url, is_available } = req.body

    const item = await db.canteenItems.findByPk(req.params.id)
    if (!item) {
      return sendError(res, "Item not found", 404)
    }

    // Validate category if provided
    if (category_id && category_id !== item.category_id) {
      const category = await db.canteenCategories.findByPk(category_id)
      if (!category) {
        return sendError(res, "Category not found", 404)
      }

      // Check if item name already exists in the new category
      if (name && name !== item.name) {
        const existingItem = await db.canteenItems.findOne({
          where: {
            name: { [Op.iLike]: name },
            category_id,
            id: { [Op.ne]: item.id },
          },
        })

        if (existingItem) {
          return sendError(res, "Item already exists in this category", 409)
        }
      }
    }

    const updateData = {}
    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price) updateData.price = price
    if (stock_quantity !== undefined) updateData.stock_quantity = stock_quantity
    if (category_id) updateData.category_id = category_id
    if (image_url !== undefined) updateData.image_url = image_url
    if (is_available !== undefined) updateData.is_available = is_available

    await item.update(updateData)

    // Return updated item with category information
    const updatedItem = await db.canteenItems.findByPk(item.id, {
      include: [
        {
          model: db.canteenCategories,
          attributes: ["id", "name"],
        },
      ],
    })

    sendSuccess(res, updatedItem, "Item updated successfully")
  } catch (err) {
    console.error("Update item error:", err)
    sendError(res, "Failed to update item", 500)
  }
}

exports.updateStock = async (req, res) => {
  try {
    const { stock_quantity, operation = "set" } = req.body // operation: 'set', 'add', 'subtract'

    const item = await db.canteenItems.findByPk(req.params.id)
    if (!item) {
      return sendError(res, "Item not found", 404)
    }

    let newStock = stock_quantity
    if (operation === "add") {
      newStock = item.stock_quantity + stock_quantity
    } else if (operation === "subtract") {
      newStock = item.stock_quantity - stock_quantity
    }

    if (newStock < 0) {
      return sendError(res, "Stock quantity cannot be negative", 400)
    }

    await item.update({ stock_quantity: newStock })
    sendSuccess(res, { stock_quantity: newStock }, "Stock updated successfully")
  } catch (err) {
    console.error("Update stock error:", err)
    sendError(res, "Failed to update stock", 500)
  }
}

exports.deleteItem = async (req, res) => {
  try {
    const item = await db.canteenItems.findByPk(req.params.id)
    if (!item) {
      return sendError(res, "Item not found", 404)
    }

    // Check if item has pending orders
    const pendingOrders = await db.canteenOrders.count({
      where: { item_id: item.id },
      include: [
        {
          model: db.tableSessions,
          where: { status: "active" },
        },
      ],
    })

    if (pendingOrders > 0) {
      return sendError(res, "Cannot delete item with pending orders", 400)
    }

    await item.destroy()
    sendSuccess(res, null, "Item deleted successfully")
  } catch (err) {
    console.error("Delete item error:", err)
    sendError(res, "Failed to delete item", 500)
  }
}

// Orders
exports.createOrder = async (req, res) => {
  try {
    const { session_id, item_id, quantity } = req.body

    // Validate session if provided
    if (session_id) {
      const session = await db.tableSessions.findByPk(session_id)
      if (!session || session.status !== "active") {
        return sendError(res, "Invalid or inactive session", 400)
      }
    }

    // Validate item and check stock
    const item = await db.canteenItems.findByPk(item_id)
    if (!item) {
      return sendError(res, "Item not found", 404)
    }

    if (!item.is_available) {
      return sendError(res, "Item is not available", 400)
    }

    if (item.stock_quantity < quantity) {
      return sendError(res, `Insufficient stock. Available: ${item.stock_quantity}`, 400)
    }

    const result = await db.sequelize.transaction(async (t) => {
      // Calculate total price
      const totalPrice = Number.parseFloat(item.price) * quantity

      // Create order
      const order = await db.canteenOrders.create(
        {
          session_id: session_id || null,
          item_id,
          quantity,
          total_price: totalPrice,
          served_by: req.userId,
        },
        { transaction: t },
      )

      // Update stock
      await item.update({ stock_quantity: item.stock_quantity - quantity }, { transaction: t })

      return order
    })

    // Return order with item information
    const orderWithDetails = await db.canteenOrders.findByPk(result.id, {
      include: [
        {
          model: db.canteenItems,
          attributes: ["id", "name", "price"],
        },
        {
          model: db.tableSessions,
          attributes: ["id"],
          include: [
            {
              model: db.tables,
              attributes: ["id", "table_number"],
            },
          ],
        },
      ],
    })

    sendSuccess(res, orderWithDetails, "Order created successfully", 201)
  } catch (err) {
    console.error("Create order error:", err)
    sendError(res, "Failed to create order", 500)
  }
}

exports.getOrdersBySession = async (req, res) => {
  try {
    const orders = await db.canteenOrders.findAll({
      where: { session_id: req.params.sessionId },
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
      order: [["created_at", "DESC"]],
    })

    // Calculate total amount for the session
    const totalAmount = orders.reduce((sum, order) => sum + Number.parseFloat(order.total_price), 0)

    sendSuccess(
      res,
      {
        orders,
        summary: {
          totalOrders: orders.length,
          totalAmount,
        },
      },
      "Session orders retrieved successfully",
    )
  } catch (err) {
    console.error("Get orders by session error:", err)
    sendError(res, "Failed to retrieve session orders", 500)
  }
}

exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, session_id } = req.query

    const whereCondition = {}
    if (session_id) whereCondition.session_id = session_id
    if (startDate && endDate) {
      whereCondition.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      }
    }

    const offset = (page - 1) * limit

    const { count, rows: orders } = await db.canteenOrders.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: db.canteenItems,
          attributes: ["id", "name", "price"],
        },
        {
          model: db.tableSessions,
          attributes: ["id"],
          include: [
            {
              model: db.tables,
              attributes: ["id", "table_number"],
            },
          ],
        },
        {
          model: db.users,
          as: "servedBy",
          attributes: ["id", "username"],
        },
      ],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
      order: [["created_at", "DESC"]],
    })

    sendPaginatedResponse(
      res,
      orders,
      {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total: count,
      },
      "Orders retrieved successfully",
    )
  } catch (err) {
    console.error("Get all orders error:", err)
    sendError(res, "Failed to retrieve orders", 500)
  }
}
