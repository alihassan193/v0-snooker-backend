const authJwt = require('../middleware/auth')
const controller = require('../controllers/gamePricing.controller')
const { validateIdParam } = require('../middleware/validation')

module.exports = app => {
  // Game pricing routes
  app.post('/api/game-pricing', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.createGamePricing)

  app.get('/api/game-pricing', [authJwt.verifyToken], controller.getAllGamePricings)

  app.get('/api/game-pricing/:id', [authJwt.verifyToken, validateIdParam], controller.getGamePricingById)

  app.put(
    '/api/game-pricing/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam],
    controller.updateGamePricing
  )

  app.delete(
    '/api/game-pricing/:id',
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam],
    controller.deleteGamePricing
  )
  app.get('/api/game-types', [authJwt.verifyToken], controller.getGameTypes)
}
