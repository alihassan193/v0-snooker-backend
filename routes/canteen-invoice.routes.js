const { authJwt } = require("../middleware/auth")
const { verifyPermissions } = require("../middleware/verifyRoles")
const controller = require("../controllers/canteen-invoice.controller")

module.exports = (app) => {
  // Canteen-only invoicing
  app.post(
    "/api/canteen/invoice",
    [authJwt.verifyToken, verifyPermissions("can_manage_canteen")],
    controller.createCanteenInvoice,
  )

  app.post(
    "/api/canteen/quick-sale",
    [authJwt.verifyToken, verifyPermissions("can_manage_canteen")],
    controller.createQuickSale,
  )

  app.get(
    "/api/canteen/:club_id/sales-report",
    [authJwt.verifyToken, verifyPermissions("can_view_reports")],
    controller.getCanteenSalesReport,
  )
}
