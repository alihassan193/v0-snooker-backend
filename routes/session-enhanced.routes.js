const { authJwt } = require("../middleware/auth")
const { verifyPermissions } = require("../middleware/verifyRoles")
const controller = require("../controllers/session-enhanced.controller")

module.exports = (app) => {
  // Enhanced session management
  app.post(
    "/api/sessions/start",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables")],
    controller.startSession,
  )

  app.post(
    "/api/sessions/canteen-order",
    [authJwt.verifyToken, verifyPermissions("can_manage_canteen")],
    controller.addCanteenOrderToSession,
  )

  app.get(
    "/api/sessions/:session_id/canteen-orders",
    [authJwt.verifyToken, verifyPermissions("can_manage_canteen")],
    controller.getSessionCanteenOrders,
  )

  app.put(
    "/api/sessions/:session_id/end",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables")],
    controller.endSession,
  )

  app.get(
    "/api/sessions/active",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables")],
    controller.getActiveSessions,
  )
}
