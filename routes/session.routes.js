const authJwt = require('../middleware/auth')
const controller = require('../controllers/session.controller')
const { validateIdParam } = require('../middleware/validation')
// routes/sessionRoutes.js
// module.exports = app => {
//   // Consolidated session routes
//   app
//     .route('/api/sessions')
//     .post([authJwt.verifyToken], controller.startSession)
//     .get([authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getAllSessions)

//   // Specialized routes
//   app.get('/api/sessions/active', [authJwt.verifyToken, authJwt.isManagerOrAdmin], (req, res) => {
//     req.query.status = 'active' // Automatically set status
//     controller.getAllSessions(req, res)
//   })

//   app.get('/api/sessions/:id', [authJwt.verifyToken, validateIdParam], controller.getSessionById)
//   app.put('/api/sessions/:id/end', [authJwt.verifyToken, validateIdParam], controller.endSession)
// }

module.exports = app => {
  // Session management routes
  app.post('/api/sessions', [authJwt.verifyToken], controller.startSession)

  app.get('/api/sessions', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getAllSessions)

  app.get('/api/sessions/active', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getActiveSessions)

  app.get('/api/sessions/:id', [authJwt.verifyToken, validateIdParam], controller.getSessionById)

  app.put('/api/sessions/:id/end', [authJwt.verifyToken, validateIdParam], controller.endSession)
}
