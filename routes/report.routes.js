const authJwt = require('../middleware/auth')
const controller = require('../controllers/report.controller')

module.exports = app => {
  // Report routes
  app.get('/api/reports/dashboard', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getDashboardStats)

  app.get('/api/reports/revenue', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getRevenueReport)

  app.get('/api/reports/sessions', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getSessionReport)

  app.get('/api/reports/players', [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.getPlayerReport)
}
