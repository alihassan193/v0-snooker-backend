const db = require('../models')
const { successResponse, errorResponse } = require('../utils/responseHelper')
const logger = require('../utils/logger')

const CanteenItem = db.canteenItems
const CanteenCategory = db.canteenCategories
const CanteenStock = db.canteenStocks
const ClubManager = db.club_managers

// Helper function to get user's club access
const getUserClubAccess = async (userId, userRole) => {
  if (userRole === 'manager') {
    const clubManager = await ClubManager.findOne({
      where: { manager_id: userId, is_active: true },
    })
    return clubManager ? [clubManager.club_id] : []
  } else if (userRole === 'sub_admin') {
    const clubManagers = await ClubManager.findAll({
      where: { admin_id: userId, is_active: true },
    })
    return clubManagers.map(cm => cm.club_id)
  }
  return null // Super admin has access to all
}

// Create canteen item
exports.createCanteenItem = async (req, res) => {
  try {
    const { name, description, price, category_id, stock_quantity, is_available, club_id } = req.body

    // Validate club_id
    if (!club_id) {
      return errorResponse(res, 'Club ID is required', 400)
    }

    // Check if user has access to this club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(Number.parseInt(club_id))) {
      return errorResponse(res, 'You can only create items for clubs you manage', 403)
    }

    // Verify category exists
    const category = await CanteenCategory.findByPk(category_id)
    if (!category) {
      return errorResponse(res, 'Category not found', 404)
    }

    const canteenItem = await CanteenItem.create({
      name,
      description,
      price,
      category_id,
      stock_quantity: stock_quantity || 0,
      is_available: is_available !== undefined ? is_available : true,
      club_id,
      created_by: req.userId,
    })

    // Create initial stock record
    await CanteenStock.create({
      item_id: canteenItem.id,
      club_id,
      quantity: stock_quantity || 0,
      min_stock_level: 5, // Default minimum stock level
      last_restock_date: new Date(),
      last_restock_quantity: stock_quantity || 0,
      restock_by: req.userId,
    })

    const itemWithCategory = await CanteenItem.findByPk(canteenItem.id, {
      include: [
        {
          model: CanteenCategory,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
    })

    logger.info(`Canteen item created: ${canteenItem.id} by user: ${req.userId}`)
    return successResponse(res, 'Canteen item created successfully', itemWithCategory, 201)
  } catch (error) {
    logger.error('Error creating canteen item:', error)
    return errorResponse(res, 'Failed to create canteen item', 500)
  }
}

// Get all canteen items
exports.getAllCanteenItems = async (req, res) => {
  try {
    const { category_id, is_available, page = 1, limit = 10, club_id } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    if (category_id) whereClause.category_id = category_id
    if (is_available !== undefined) whereClause.is_available = is_available === 'true'

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, 'You can only view items for clubs you manage', 403)
        }
        whereClause.club_id = club_id
      } else {
        // Show items from all accessible clubs
        whereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause.club_id = club_id
    }

    const offset = (page - 1) * limit

    const { count, rows: items } = await CanteenItem.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: CanteenCategory,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
        {
          model: CanteenStock,
          as: 'stock',
          attributes: ['quantity', 'min_stock_level', 'last_restock_date'],
        },
      ],
      order: [['name', 'ASC']],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
    })

    return successResponse(res, 'Canteen items retrieved successfully', {
      items,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error('Error getting canteen items:', error)
    return errorResponse(res, 'Failed to get canteen items', 500)
  }
}

// Get canteen item by ID
exports.getCanteenItemById = async (req, res) => {
  try {
    const { id } = req.params

    const item = await CanteenItem.findByPk(id, {
      include: [
        {
          model: CanteenCategory,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
        {
          model: CanteenStock,
          as: 'stock',
          attributes: ['quantity', 'min_stock_level', 'last_restock_date'],
        },
      ],
    })

    if (!item) {
      return errorResponse(res, 'Canteen item not found', 404)
    }

    // Check if user has access to this item's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(item.club_id)) {
      return errorResponse(res, 'You can only view items from clubs you manage', 403)
    }

    return successResponse(res, 'Canteen item retrieved successfully', item)
  } catch (error) {
    logger.error('Error getting canteen item:', error)
    return errorResponse(res, 'Failed to get canteen item', 500)
  }
}

// Update canteen item
exports.updateCanteenItem = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, price, category_id, is_available } = req.body

    const item = await CanteenItem.findByPk(id)

    if (!item) {
      return errorResponse(res, 'Canteen item not found', 404)
    }

    // Check if user has access to this item's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(item.club_id)) {
      return errorResponse(res, 'You can only update items from clubs you manage', 403)
    }

    // Verify category exists if changing
    if (category_id && category_id !== item.category_id) {
      const category = await CanteenCategory.findByPk(category_id)
      if (!category) {
        return errorResponse(res, 'Category not found', 404)
      }
    }

    await CanteenItem.update(
      {
        name,
        description,
        price,
        category_id,
        is_available,
      },
      { where: { id } }
    )

    const updatedItem = await CanteenItem.findByPk(id, {
      include: [
        {
          model: CanteenCategory,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
        {
          model: CanteenStock,
          as: 'stock',
          attributes: ['quantity', 'min_stock_level', 'last_restock_date'],
        },
      ],
    })

    logger.info(`Canteen item updated: ${id} by user: ${req.userId}`)
    return successResponse(res, 'Canteen item updated successfully', updatedItem)
  } catch (error) {
    logger.error('Error updating canteen item:', error)
    return errorResponse(res, 'Failed to update canteen item', 500)
  }
}

// Delete canteen item
exports.deleteCanteenItem = async (req, res) => {
  try {
    const { id } = req.params

    const item = await CanteenItem.findByPk(id)

    if (!item) {
      return errorResponse(res, 'Canteen item not found', 404)
    }

    // Check if user has access to this item's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(item.club_id)) {
      return errorResponse(res, 'You can only delete items from clubs you manage', 403)
    }

    // Delete associated stock records first
    await CanteenStock.destroy({ where: { item_id: id } })

    // Then delete the item
    await CanteenItem.destroy({ where: { id } })

    logger.info(`Canteen item deleted: ${id} by user: ${req.userId}`)
    return successResponse(res, 'Canteen item deleted successfully')
  } catch (error) {
    logger.error('Error deleting canteen item:', error)
    return errorResponse(res, 'Failed to delete canteen item', 500)
  }
}

// Get all categories
exports.getAllCanteenCategories = async (req, res) => {
  try {
    const categories = await CanteenCategory.findAll({
      order: [['name', 'ASC']],
    })

    return successResponse(res, 'Categories retrieved successfully', categories)
  } catch (error) {
    logger.error('Error getting categories:', error)
    return errorResponse(res, 'Failed to get categories', 500)
  }
}

// Create canteen category
exports.createCanteenCategory = async (req, res) => {
  try {
    const { name, description } = req.body

    // Check if category already exists
    const existingCategory = await CanteenCategory.findOne({
      where: { name },
    })

    if (existingCategory) {
      return errorResponse(res, 'Category with this name already exists', 400)
    }

    const category = await CanteenCategory.create({
      name,
      description,
    })

    logger.info(`Canteen category created: ${category.id} by user: ${req.userId}`)
    return successResponse(res, 'Canteen category created successfully', category, 201)
  } catch (error) {
    logger.error('Error creating canteen category:', error)
    return errorResponse(res, 'Failed to create canteen category', 500)
  }
}

// Update stock
exports.updateStock = async (req, res) => {
  try {
    const { item_id } = req.params
    const { quantity, min_stock_level } = req.body
    console.log('item_id is = ', item_id)

    // Validate quantity
    if (quantity === undefined || quantity < 0) {
      return errorResponse(res, 'Valid quantity is required', 400)
    }

    const item = await CanteenItem.findByPk(item_id)

    if (!item) {
      return errorResponse(res, 'Canteen item not found', 404)
    }

    // Check if user has access to this item's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(item.club_id)) {
      return errorResponse(res, 'You can only update stock for items from clubs you manage', 403)
    }

    // Get current stock
    let stock = await CanteenStock.findOne({
      where: { item_id, club_id: item.club_id },
    })

    if (!stock) {
      // Create stock record if it doesn't exist
      stock = await CanteenStock.create({
        item_id,
        club_id: item.club_id,
        quantity: 0,
        min_stock_level: 5,
      })
    }

    // Calculate restock quantity (if adding stock)
    const restockQuantity = quantity > stock.quantity ? quantity - stock.quantity : 0

    // Update stock
    await CanteenStock.update(
      {
        quantity,
        min_stock_level: min_stock_level !== undefined ? min_stock_level : stock.min_stock_level,
        ...(restockQuantity > 0 && {
          last_restock_date: new Date(),
          last_restock_quantity: restockQuantity,
          restock_by: req.userId,
        }),
      },
      { where: { item_id, club_id: item.club_id } }
    )

    // Also update the stock_quantity in the item table
    await CanteenItem.update({ stock_quantity: quantity }, { where: { id: item_id } })

    const updatedItem = await CanteenItem.findByPk(item_id, {
      include: [
        {
          model: CanteenCategory,
          as: 'category',
          attributes: ['id', 'name'],
        },
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
        {
          model: CanteenStock,
          as: 'stock',
          attributes: ['quantity', 'min_stock_level', 'last_restock_date', 'last_restock_quantity'],
        },
      ],
    })

    logger.info(`Stock updated for item: ${item_id} to ${quantity} by user: ${req.userId}`)
    return successResponse(res, 'Stock updated successfully', updatedItem)
  } catch (error) {
    logger.error('Error updating stock:', error)
    return errorResponse(res, 'Failed to update stock', 500)
  }
}

// Get low stock items
exports.getLowStockItems = async (req, res) => {
  try {
    const { club_id } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, 'You can only view items for clubs you manage', 403)
        }
        whereClause.club_id = club_id
      } else {
        // Show items from all accessible clubs
        whereClause.club_id = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause.club_id = club_id
    }

    // Find all stock records where quantity is below min_stock_level
    const lowStockRecords = await CanteenStock.findAll({
      where: whereClause,
      include: [
        {
          model: CanteenItem,
          as: 'item',
          include: [
            {
              model: CanteenCategory,
              as: 'category',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: db.clubs,
          as: 'club',
          attributes: ['id', 'name'],
        },
      ],
    })

    // Filter to only include items where quantity < min_stock_level
    const lowStockItems = lowStockRecords.filter(record => record.quantity < record.min_stock_level)

    return successResponse(res, 'Low stock items retrieved successfully', lowStockItems)
  } catch (error) {
    logger.error('Error getting low stock items:', error)
    return errorResponse(res, 'Failed to get low stock items', 500)
  }
}

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const { session_id, items } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 'Order items are required', 400)
    }

    // Verify all items exist and are available
    const itemIds = items.map(item => item.item_id)
    const canteenItems = await CanteenItem.findAll({
      where: { id: itemIds },
      include: [
        {
          model: CanteenStock,
          as: 'stock',
          attributes: ['quantity'],
        },
      ],
    })

    if (canteenItems.length !== items.length) {
      return errorResponse(res, 'One or more items not found', 404)
    }

    // Check stock availability and calculate totals
    const orderItems = []
    let grandTotal = 0
    const stockUpdates = []

    for (const item of items) {
      const canteenItem = canteenItems.find(ci => ci.id === item.item_id)

      if (!canteenItem.is_available) {
        return errorResponse(res, `Item ${canteenItem.name} is not available`, 400)
      }

      if (canteenItem.stock.quantity < item.quantity) {
        return errorResponse(res, `Insufficient stock for ${canteenItem.name}`, 400)
      }

      const itemTotal = canteenItem.price * item.quantity
      grandTotal += itemTotal

      orderItems.push({
        session_id,
        item_id: item.item_id,
        quantity: item.quantity,
        total_price: itemTotal,
        served_by: req.userId,
      })

      stockUpdates.push({
        item_id: item.item_id,
        quantity: canteenItem.stock.quantity - item.quantity,
      })
    }

    // Create order records in a transaction
    const transaction = await db.sequelize.transaction()

    try {
      // Create order items
      const createdOrders = await CanteenOrder.bulkCreate(orderItems, { transaction })

      // Update stock levels
      for (const update of stockUpdates) {
        await CanteenStock.update({ quantity: update.quantity }, { where: { item_id: update.item_id }, transaction })

        // Also update the stock_quantity in the item table
        await CanteenItem.update({ stock_quantity: update.quantity }, { where: { id: update.item_id }, transaction })
      }

      await transaction.commit()

      logger.info(`Order created with ${orderItems.length} items by user: ${req.userId}`)
      return successResponse(
        res,
        'Order created successfully',
        {
          order_count: createdOrders.length,
          grand_total: grandTotal,
        },
        201
      )
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    logger.error('Error creating order:', error)
    return errorResponse(res, 'Failed to create order', 500)
  }
}

// Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const { club_id, start_date, end_date, page = 1, limit = 10 } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, 'You can only view orders for clubs you manage', 403)
        }
        whereClause['$item.club_id$'] = club_id
      } else {
        // Show orders from all accessible clubs
        whereClause['$item.club_id$'] = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause['$item.club_id$'] = club_id
    }

    // Date range filter
    if (start_date && end_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.between]: [new Date(start_date), new Date(end_date)],
      }
    } else if (start_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.gte]: new Date(start_date),
      }
    } else if (end_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.lte]: new Date(end_date),
      }
    }

    const offset = (page - 1) * limit

    const { count, rows: orders } = await CanteenOrder.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: CanteenItem,
          as: 'item',
          include: [
            {
              model: CanteenCategory,
              as: 'category',
              attributes: ['id', 'name'],
            },
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: db.users,
          as: 'served_by_user',
          attributes: ['id', 'name'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
    })

    return successResponse(res, 'Orders retrieved successfully', {
      orders,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error('Error getting orders:', error)
    return errorResponse(res, 'Failed to get orders', 500)
  }
}

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params

    const order = await CanteenOrder.findByPk(id, {
      include: [
        {
          model: CanteenItem,
          as: 'item',
          include: [
            {
              model: CanteenCategory,
              as: 'category',
              attributes: ['id', 'name'],
            },
            {
              model: db.clubs,
              as: 'club',
              attributes: ['id', 'name'],
            },
          ],
        },
        {
          model: db.users,
          as: 'served_by_user',
          attributes: ['id', 'name'],
        },
      ],
    })

    if (!order) {
      return errorResponse(res, 'Order not found', 404)
    }

    // Check if user has access to this order's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(order.item.club_id)) {
      return errorResponse(res, 'You can only view orders from clubs you manage', 403)
    }

    return successResponse(res, 'Order retrieved successfully', order)
  } catch (error) {
    logger.error('Error getting order:', error)
    return errorResponse(res, 'Failed to get order', 500)
  }
}

// Update order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params
    const { quantity } = req.body

    if (!quantity || quantity < 1) {
      return errorResponse(res, 'Valid quantity is required', 400)
    }

    const order = await CanteenOrder.findByPk(id, {
      include: [
        {
          model: CanteenItem,
          as: 'item',
          include: [
            {
              model: CanteenStock,
              as: 'stock',
              attributes: ['quantity'],
            },
          ],
        },
      ],
    })

    if (!order) {
      return errorResponse(res, 'Order not found', 404)
    }

    // Check if user has access to this order's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(order.item.club_id)) {
      return errorResponse(res, 'You can only update orders from clubs you manage', 403)
    }

    const quantityDifference = quantity - order.quantity
    const newStockQuantity = order.item.stock.quantity - quantityDifference

    if (newStockQuantity < 0) {
      return errorResponse(res, 'Insufficient stock for this update', 400)
    }

    const newTotalPrice = order.item.price * quantity

    const transaction = await db.sequelize.transaction()

    try {
      // Update the order
      await CanteenOrder.update(
        {
          quantity,
          total_price: newTotalPrice,
        },
        { where: { id }, transaction }
      )

      // Update stock levels
      await CanteenStock.update({ quantity: newStockQuantity }, { where: { item_id: order.item_id }, transaction })

      // Also update the stock_quantity in the item table
      await CanteenItem.update({ stock_quantity: newStockQuantity }, { where: { id: order.item_id }, transaction })

      await transaction.commit()

      const updatedOrder = await CanteenOrder.findByPk(id, {
        include: [
          {
            model: CanteenItem,
            as: 'item',
            include: [
              {
                model: CanteenCategory,
                as: 'category',
                attributes: ['id', 'name'],
              },
              {
                model: db.clubs,
                as: 'club',
                attributes: ['id', 'name'],
              },
            ],
          },
        ],
      })

      logger.info(`Order updated: ${id} by user: ${req.userId}`)
      return successResponse(res, 'Order updated successfully', updatedOrder)
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    logger.error('Error updating order:', error)
    return errorResponse(res, 'Failed to update order', 500)
  }
}

// Delete order
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params

    const order = await CanteenOrder.findByPk(id, {
      include: [
        {
          model: CanteenItem,
          as: 'item',
          include: [
            {
              model: CanteenStock,
              as: 'stock',
              attributes: ['quantity'],
            },
          ],
        },
      ],
    })

    if (!order) {
      return errorResponse(res, 'Order not found', 404)
    }

    // Check if user has access to this order's club
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)
    if (userClubAccess && !userClubAccess.includes(order.item.club_id)) {
      return errorResponse(res, 'You can only delete orders from clubs you manage', 403)
    }

    const transaction = await db.sequelize.transaction()

    try {
      // Delete the order
      await CanteenOrder.destroy({ where: { id }, transaction })

      // Restore stock
      const newStockQuantity = order.item.stock.quantity + order.quantity
      await CanteenStock.update({ quantity: newStockQuantity }, { where: { item_id: order.item_id }, transaction })

      // Also update the stock_quantity in the item table
      await CanteenItem.update({ stock_quantity: newStockQuantity }, { where: { id: order.item_id }, transaction })

      await transaction.commit()

      logger.info(`Order deleted: ${id} by user: ${req.userId}`)
      return successResponse(res, 'Order deleted successfully')
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    logger.error('Error deleting order:', error)
    return errorResponse(res, 'Failed to delete order', 500)
  }
}

// Get sales report
exports.getSalesReport = async (req, res) => {
  try {
    const { club_id, start_date, end_date } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, 'You can only view sales for clubs you manage', 403)
        }
        whereClause['$item.club_id$'] = club_id
      } else {
        // Show sales from all accessible clubs
        whereClause['$item.club_id$'] = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause['$item.club_id$'] = club_id
    }

    // Date range filter
    if (start_date && end_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.between]: [new Date(start_date), new Date(end_date)],
      }
    } else if (start_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.gte]: new Date(start_date),
      }
    } else if (end_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.lte]: new Date(end_date),
      }
    } else {
      // Default to last 30 days if no date range provided
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      whereClause.createdAt = {
        [db.Sequelize.Op.gte]: thirtyDaysAgo,
      }
    }

    // Get all orders in the date range
    const orders = await CanteenOrder.findAll({
      where: whereClause,
      include: [
        {
          model: CanteenItem,
          as: 'item',
          attributes: ['id', 'name', 'price', 'club_id'],
        },
      ],
    })

    // Calculate totals
    const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0)
    const totalItemsSold = orders.reduce((sum, order) => sum + order.quantity, 0)

    // Group by item for top items
    const itemSales = {}
    orders.forEach(order => {
      if (!itemSales[order.item_id]) {
        itemSales[order.item_id] = {
          item_id: order.item_id,
          name: order.item.name,
          quantity: 0,
          total: 0,
        }
      }
      itemSales[order.item_id].quantity += order.quantity
      itemSales[order.item_id].total += parseFloat(order.total_price)
    })

    // Convert to array and sort
    const topItems = Object.values(itemSales).sort((a, b) => b.quantity - a.quantity)

    // Group by day for trend analysis
    const dailySales = {}
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0]
      if (!dailySales[date]) {
        dailySales[date] = {
          date,
          total: 0,
          count: 0,
        }
      }
      dailySales[date].total += parseFloat(order.total_price)
      dailySales[date].count += 1
    })

    // Convert to array and sort by date
    const dailySalesArray = Object.values(dailySales).sort((a, b) => new Date(a.date) - new Date(b.date))

    return successResponse(res, 'Sales report retrieved successfully', {
      total_sales: totalSales,
      total_items_sold: totalItemsSold,
      order_count: orders.length,
      top_items: topItems.slice(0, 5),
      daily_sales: dailySalesArray,
    })
  } catch (error) {
    logger.error('Error getting sales report:', error)
    return errorResponse(res, 'Failed to get sales report', 500)
  }
}

// Get today's sales
exports.getTodaySales = async (req, res) => {
  try {
    const { club_id } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, 'You can only view sales for clubs you manage', 403)
        }
        whereClause['$item.club_id$'] = club_id
      } else {
        // Show sales from all accessible clubs
        whereClause['$item.club_id$'] = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause['$item.club_id$'] = club_id
    }

    // Today's date
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    whereClause.createdAt = {
      [db.Sequelize.Op.between]: [startOfDay, endOfDay],
    }

    // Get all orders for today
    const orders = await CanteenOrder.findAll({
      where: whereClause,
      include: [
        {
          model: CanteenItem,
          as: 'item',
          attributes: ['id', 'name', 'price'],
        },
      ],
    })

    // Calculate totals
    const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0)
    const totalItemsSold = orders.reduce((sum, order) => sum + order.quantity, 0)

    return successResponse(res, "Today's sales retrieved successfully", {
      total_sales: totalSales,
      total_items_sold: totalItemsSold,
      order_count: orders.length,
    })
  } catch (error) {
    logger.error('Error getting today sales:', error)
    return errorResponse(res, 'Failed to get today sales', 500)
  }
}

// Get top selling items
exports.getTopSellingItems = async (req, res) => {
  try {
    const { club_id, limit = 5, start_date, end_date } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    // Get user's club access
    const userClubAccess = await getUserClubAccess(req.userId, req.userRole)

    if (userClubAccess) {
      // Manager or sub-admin - filter by accessible clubs
      if (club_id) {
        // If specific club_id is requested, verify access
        if (!userClubAccess.includes(Number.parseInt(club_id))) {
          return errorResponse(res, 'You can only view sales for clubs you manage', 403)
        }
        whereClause['$item.club_id$'] = club_id
      } else {
        // Show sales from all accessible clubs
        whereClause['$item.club_id$'] = { [db.Sequelize.Op.in]: userClubAccess }
      }
    } else if (club_id) {
      // Super admin with specific club filter
      whereClause['$item.club_id$'] = club_id
    }

    // Date range filter
    if (start_date && end_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.between]: [new Date(start_date), new Date(end_date)],
      }
    } else if (start_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.gte]: new Date(start_date),
      }
    } else if (end_date) {
      whereClause.createdAt = {
        [db.Sequelize.Op.lte]: new Date(end_date),
      }
    } else {
      // Default to last 30 days if no date range provided
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      whereClause.createdAt = {
        [db.Sequelize.Op.gte]: thirtyDaysAgo,
      }
    }

    // Get top selling items
    const topItems = await CanteenOrder.findAll({
      where: whereClause,
      attributes: [
        'item_id',
        [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'total_quantity'],
        [db.sequelize.fn('SUM', db.sequelize.col('total_price')), 'total_sales'],
      ],
      include: [
        {
          model: CanteenItem,
          as: 'item',
          attributes: ['id', 'name', 'price', 'image_url'],
        },
      ],
      group: ['item_id', 'item.id'],
      order: [[db.sequelize.literal('total_quantity'), 'DESC']],
      limit: Number.parseInt(limit),
    })

    return successResponse(res, 'Top selling items retrieved successfully', topItems)
  } catch (error) {
    logger.error('Error getting top selling items:', error)
    return errorResponse(res, 'Failed to get top selling items', 500)
  }
}
