const db = require("../models")
const { successResponse, errorResponse } = require("../utils/responseHelper")
const logger = require("../utils/logger")

const CanteenItem = db.canteenItems
const CanteenCategory = db.canteenCategories
const CanteenStock = db.canteenStocks
const ClubManager = db.club_managers

// Helper function to get user's club ID
const getUserClubId = async (userId, userRole) => {
  // If user is a manager, their club ID is already set in auth middleware
  if (userRole === "manager") {
    return null // Will use req.userClubId from auth middleware
  }

  // If user is sub_admin, get all clubs they manage
  if (userRole === "sub_admin") {
    const clubManagers = await ClubManager.findAll({
      where: { admin_id: userId, is_active: true },
    })
    return clubManagers.map((cm) => cm.club_id)
  }

  // Super admin can access all clubs
  return null
}

// Create canteen item
exports.createCanteenItem = async (req, res) => {
  try {
    const { name, description, price, category_id, stock_quantity, is_available, club_id } = req.body

    // Validate club_id
    if (!club_id) {
      return errorResponse(res, "Club ID is required", 400)
    }

    // Check if user has access to this club
    if (req.userRole === "manager") {
      if (req.userClubId !== Number.parseInt(club_id)) {
        return errorResponse(res, "You can only create items for your assigned club", 403)
      }
    } else if (req.userRole === "sub_admin") {
      const managedClubs = await getUserClubId(req.userId, req.userRole)
      if (!managedClubs.includes(Number.parseInt(club_id))) {
        return errorResponse(res, "You can only create items for clubs you manage", 403)
      }
    }

    // Verify category exists
    const category = await CanteenCategory.findByPk(category_id)
    if (!category) {
      return errorResponse(res, "Category not found", 404)
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
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
    })

    logger.info(`Canteen item created: ${canteenItem.id} by user: ${req.userId}`)
    return successResponse(res, "Canteen item created successfully", itemWithCategory, 201)
  } catch (error) {
    logger.error("Error creating canteen item:", error)
    return errorResponse(res, "Failed to create canteen item", 500)
  }
}

// Get all canteen items
exports.getAllCanteenItems = async (req, res) => {
  try {
    const { category_id, is_available, page = 1, limit = 10, club_id } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    if (category_id) whereClause.category_id = category_id
    if (is_available !== undefined) whereClause.is_available = is_available === "true"

    // Filter by club_id based on user role
    if (req.userRole === "manager") {
      // Managers can only see items from their assigned club
      whereClause.club_id = req.userClubId
    } else if (req.userRole === "sub_admin") {
      // Sub-admins can see items from clubs they manage
      if (club_id) {
        // If specific club_id is requested, verify access
        const managedClubs = await getUserClubId(req.userId, req.userRole)
        if (!managedClubs.includes(Number.parseInt(club_id))) {
          return errorResponse(res, "You can only view items for clubs you manage", 403)
        }
        whereClause.club_id = club_id
      } else {
        // Otherwise, show items from all managed clubs
        const managedClubs = await getUserClubId(req.userId, req.userRole)
        whereClause.club_id = { [db.Sequelize.Op.in]: managedClubs }
      }
    } else if (req.userRole === "super_admin") {
      // Super admin can see all items, optionally filtered by club_id
      if (club_id) {
        whereClause.club_id = club_id
      }
    }

    const offset = (page - 1) * limit

    const { count, rows: items } = await CanteenItem.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: CanteenCategory,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
        {
          model: CanteenStock,
          as: "stock",
          attributes: ["quantity", "min_stock_level", "last_restock_date"],
        },
      ],
      order: [["name", "ASC"]],
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset),
    })

    return successResponse(res, "Canteen items retrieved successfully", {
      items,
      pagination: {
        total: count,
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    })
  } catch (error) {
    logger.error("Error getting canteen items:", error)
    return errorResponse(res, "Failed to get canteen items", 500)
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
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
        {
          model: CanteenStock,
          as: "stock",
          attributes: ["quantity", "min_stock_level", "last_restock_date"],
        },
      ],
    })

    if (!item) {
      return errorResponse(res, "Canteen item not found", 404)
    }

    // Check if user has access to this item's club
    if (req.userRole === "manager") {
      if (item.club_id !== req.userClubId) {
        return errorResponse(res, "You can only view items from your assigned club", 403)
      }
    } else if (req.userRole === "sub_admin") {
      const managedClubs = await getUserClubId(req.userId, req.userRole)
      if (!managedClubs.includes(item.club_id)) {
        return errorResponse(res, "You can only view items from clubs you manage", 403)
      }
    }

    return successResponse(res, "Canteen item retrieved successfully", item)
  } catch (error) {
    logger.error("Error getting canteen item:", error)
    return errorResponse(res, "Failed to get canteen item", 500)
  }
}

// Update canteen item
exports.updateCanteenItem = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, price, category_id, is_available } = req.body

    const item = await CanteenItem.findByPk(id)

    if (!item) {
      return errorResponse(res, "Canteen item not found", 404)
    }

    // Check if user has access to this item's club
    if (req.userRole === "manager") {
      if (item.club_id !== req.userClubId) {
        return errorResponse(res, "You can only update items from your assigned club", 403)
      }
    } else if (req.userRole === "sub_admin") {
      const managedClubs = await getUserClubId(req.userId, req.userRole)
      if (!managedClubs.includes(item.club_id)) {
        return errorResponse(res, "You can only update items from clubs you manage", 403)
      }
    }

    // Verify category exists if changing
    if (category_id && category_id !== item.category_id) {
      const category = await CanteenCategory.findByPk(category_id)
      if (!category) {
        return errorResponse(res, "Category not found", 404)
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
      { where: { id } },
    )

    const updatedItem = await CanteenItem.findByPk(id, {
      include: [
        {
          model: CanteenCategory,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
        {
          model: CanteenStock,
          as: "stock",
          attributes: ["quantity", "min_stock_level", "last_restock_date"],
        },
      ],
    })

    logger.info(`Canteen item updated: ${id} by user: ${req.userId}`)
    return successResponse(res, "Canteen item updated successfully", updatedItem)
  } catch (error) {
    logger.error("Error updating canteen item:", error)
    return errorResponse(res, "Failed to update canteen item", 500)
  }
}

// Delete canteen item
exports.deleteCanteenItem = async (req, res) => {
  try {
    const { id } = req.params

    const item = await CanteenItem.findByPk(id)

    if (!item) {
      return errorResponse(res, "Canteen item not found", 404)
    }

    // Check if user has access to this item's club
    if (req.userRole === "manager") {
      if (item.club_id !== req.userClubId) {
        return errorResponse(res, "You can only delete items from your assigned club", 403)
      }
    } else if (req.userRole === "sub_admin") {
      const managedClubs = await getUserClubId(req.userId, req.userRole)
      if (!managedClubs.includes(item.club_id)) {
        return errorResponse(res, "You can only delete items from clubs you manage", 403)
      }
    }

    // Delete associated stock records first
    await CanteenStock.destroy({ where: { item_id: id } })

    // Then delete the item
    await CanteenItem.destroy({ where: { id } })

    logger.info(`Canteen item deleted: ${id} by user: ${req.userId}`)
    return successResponse(res, "Canteen item deleted successfully")
  } catch (error) {
    logger.error("Error deleting canteen item:", error)
    return errorResponse(res, "Failed to delete canteen item", 500)
  }
}

// Get all categories
exports.getAllCanteenCategories = async (req, res) => {
  try {
    const categories = await CanteenCategory.findAll({
      order: [["name", "ASC"]],
    })

    return successResponse(res, "Categories retrieved successfully", categories)
  } catch (error) {
    logger.error("Error getting categories:", error)
    return errorResponse(res, "Failed to get categories", 500)
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
      return errorResponse(res, "Category with this name already exists", 400)
    }

    const category = await CanteenCategory.create({
      name,
      description,
    })

    logger.info(`Canteen category created: ${category.id} by user: ${req.userId}`)
    return successResponse(res, "Canteen category created successfully", category, 201)
  } catch (error) {
    logger.error("Error creating canteen category:", error)
    return errorResponse(res, "Failed to create canteen category", 500)
  }
}

// Update stock
exports.updateStock = async (req, res) => {
  try {
    const { item_id } = req.params
    const { quantity, min_stock_level } = req.body

    // Validate quantity
    if (quantity === undefined || quantity < 0) {
      return errorResponse(res, "Valid quantity is required", 400)
    }

    const item = await CanteenItem.findByPk(item_id)

    if (!item) {
      return errorResponse(res, "Canteen item not found", 404)
    }

    // Check if user has access to this item's club
    if (req.userRole === "manager") {
      if (item.club_id !== req.userClubId) {
        return errorResponse(res, "You can only update stock for items from your assigned club", 403)
      }
    } else if (req.userRole === "sub_admin") {
      const managedClubs = await getUserClubId(req.userId, req.userRole)
      if (!managedClubs.includes(item.club_id)) {
        return errorResponse(res, "You can only update stock for items from clubs you manage", 403)
      }
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
      { where: { item_id, club_id: item.club_id } },
    )

    // Also update the stock_quantity in the item table
    await CanteenItem.update({ stock_quantity: quantity }, { where: { id: item_id } })

    const updatedItem = await CanteenItem.findByPk(item_id, {
      include: [
        {
          model: CanteenCategory,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
        {
          model: CanteenStock,
          as: "stock",
          attributes: ["quantity", "min_stock_level", "last_restock_date", "last_restock_quantity"],
        },
      ],
    })

    logger.info(`Stock updated for item: ${item_id} to ${quantity} by user: ${req.userId}`)
    return successResponse(res, "Stock updated successfully", updatedItem)
  } catch (error) {
    logger.error("Error updating stock:", error)
    return errorResponse(res, "Failed to update stock", 500)
  }
}

// Get low stock items
exports.getLowStockItems = async (req, res) => {
  try {
    const { club_id } = req.query

    // Build where clause based on user role and club access
    const whereClause = {}

    // Filter by club_id based on user role
    if (req.userRole === "manager") {
      // Managers can only see items from their assigned club
      whereClause.club_id = req.userClubId
    } else if (req.userRole === "sub_admin") {
      // Sub-admins can see items from clubs they manage
      if (club_id) {
        // If specific club_id is requested, verify access
        const managedClubs = await getUserClubId(req.userId, req.userRole)
        if (!managedClubs.includes(Number.parseInt(club_id))) {
          return errorResponse(res, "You can only view items for clubs you manage", 403)
        }
        whereClause.club_id = club_id
      } else {
        // Otherwise, show items from all managed clubs
        const managedClubs = await getUserClubId(req.userId, req.userRole)
        whereClause.club_id = { [db.Sequelize.Op.in]: managedClubs }
      }
    } else if (req.userRole === "super_admin") {
      // Super admin can see all items, optionally filtered by club_id
      if (club_id) {
        whereClause.club_id = club_id
      }
    }

    // Find all stock records where quantity is below min_stock_level
    const lowStockRecords = await CanteenStock.findAll({
      where: whereClause,
      include: [
        {
          model: CanteenItem,
          as: "item",
          include: [
            {
              model: CanteenCategory,
              as: "category",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: db.clubs,
          as: "club",
          attributes: ["id", "name"],
        },
      ],
    })

    // Filter to only include items where quantity < min_stock_level
    const lowStockItems = lowStockRecords.filter((record) => record.quantity < record.min_stock_level)

    return successResponse(res, "Low stock items retrieved successfully", lowStockItems)
  } catch (error) {
    logger.error("Error getting low stock items:", error)
    return errorResponse(res, "Failed to get low stock items", 500)
  }
}
