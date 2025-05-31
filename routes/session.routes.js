const authJwt = require('../middleware/auth')
const controller = require('../controllers/session.controller')
const { validateIdParam } = require('../middleware/validation')

module.exports = app => {
  // Session management routes
  app.post('/api/sessions', [authJwt.verifyToken], controller.startSession)

  app.get('/api/sessions', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getAllSessions)

  app.get('/api/sessions/active', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getActiveSessions)

  app.get('/api/sessions/:id', [authJwt.verifyToken, validateIdParam], controller.getSessionById)

  app.put('/api/sessions/:id/end', [authJwt.verifyToken, validateIdParam], controller.endSession)
}
