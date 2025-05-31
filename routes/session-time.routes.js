const { authJwt } = require("../middleware/auth")
const { verifyPermissions } = require("../middleware/verifyRoles")
const controller = require("../controllers/session-time.controller")

module.exports = (app) => {
  // Real-time session tracking
  app.get(
    "/api/sessions/:session_id/realtime",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables")],
    controller.getSessionRealTimeData,
  )

  app.put(
    "/api/sessions/:session_id/pause",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables")],
    controller.pauseSession,
  )

  app.put(
    "/api/sessions/:session_id/resume",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables")],
    controller.resumeSession,
  )
}
