const authJwt = require('../middleware/auth')
const controller = require('../controllers/table.controller')
const { validateIdParam } = require('../middleware/validation')

module.exports = app => {
  // Table management routes
  app.post('/api/tables', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.createTable)

  app.get('/api/tables', [authJwt.verifyToken], controller.getAllTables)

  app.get('/api/tables/available', [authJwt.verifyToken], controller.getAvailableTables)

  app.get('/api/tables/:id', [authJwt.verifyToken, validateIdParam], controller.getTableById)

  app.put('/api/tables/:id', [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam], controller.updateTable)

  app.delete(
    '/api/tables/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam],
    controller.deleteTable
  )

  app.put(
    '/api/tables/:id/status',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam],
    controller.updateTableStatus
  )
  app.put(
    '/api/tables/:id/pricing',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam],
    controller.setTablePricing
  )
}
