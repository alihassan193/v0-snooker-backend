const { authJwt } = require("../middleware/auth")
const { verifyPermissions } = require("../middleware/verifyRoles")
const controller = require("../controllers/gamePricing.controller")
const { validateIdParam } = require("../middleware/validation")

module.exports = (app) => {
  // Game pricing management
  app.post(
    "/api/game-pricing/set-table-pricing",
    [authJwt.verifyToken, verifyPermissions("can_create_tables")],
    controller.setTablePricing,
  )

  app.get(
    "/api/game-pricing/table/:table_id",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables"), validateIdParam],
    controller.getTablePricing,
  )

  app.get("/api/game-types", [authJwt.verifyToken], controller.getGameTypes)

  app.post("/api/game-types", [authJwt.verifyToken, authJwt.isSuperAdmin], controller.createGameType)

  app.post(
    "/api/game-pricing/calculate-cost",
    [authJwt.verifyToken, verifyPermissions("can_manage_tables")],
    controller.calculateSessionCost,
  )
}
