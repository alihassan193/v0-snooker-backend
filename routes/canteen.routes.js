const authJwt = require('../middleware/auth')
const controller = require('../controllers/canteen.controller')
const { validateIdParam } = require('../middleware/validation')

module.exports = app => {
  // Canteen item routes
  app.post(
    '/api/canteen/items',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.createCanteenItem
  )

  app.get('/api/canteen/items', [authJwt.verifyToken], controller.getAllCanteenItems)

  app.get('/api/canteen/items/:id', [authJwt.verifyToken, validateIdParam], controller.getCanteenItemById)

  app.put(
    '/api/canteen/items/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen, validateIdParam],
    controller.updateCanteenItem
  )

  app.delete(
    '/api/canteen/items/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen, validateIdParam],
    controller.deleteCanteenItem
  )

  // Category routes
  app.get('/api/canteen/categories', [authJwt.verifyToken], controller.getAllCanteenCategories)

  app.post(
    '/api/canteen/categories',
    [authJwt.verifyToken, authJwt.isAdmin, authJwt.canManageCanteen],
    controller.createCanteenCategory
  )

  // Stock management routes
  app.put(
    '/api/canteen/stock/:item_id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.updateStock
  )

  app.get(
    '/api/canteen/low-stock',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.getLowStockItems
  )
  // POS routes
  app.post(
    '/api/canteen/orders',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.createOrder
  )

  app.get(
    '/api/canteen/orders',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.getAllOrders
  )

  app.get(
    '/api/canteen/orders/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen, validateIdParam],
    controller.getOrderById
  )

  app.put(
    '/api/canteen/orders/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen, validateIdParam],
    controller.updateOrder
  )

  app.delete(
    '/api/canteen/orders/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen, validateIdParam],
    controller.deleteOrder
  )

  // Sales reporting routes
  app.get(
    '/api/canteen/sales',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.getSalesReport
  )

  app.get(
    '/api/canteen/sales/today',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.getTodaySales
  )

  app.get(
    '/api/canteen/sales/top-items',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, authJwt.canManageCanteen],
    controller.getTopSellingItems
  )
}
