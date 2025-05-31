const authJwt = require("../middleware/auth")
const controller = require("../controllers/invoice.controller")
const { validateIdParam } = require("../middleware/validation")

module.exports = (app) => {
  // Invoice routes
  app.post("/api/invoices", [authJwt.verifyToken, authJwt.isManagerOrAdmin], controller.createInvoice)

  app.get("/api/invoices", [authJwt.verifyToken], controller.getAllInvoices)

  app.get("/api/invoices/:id", [authJwt.verifyToken, validateIdParam], controller.getInvoiceById)

  app.put(
    "/api/invoices/:id/status",
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam],
    controller.updateInvoiceStatus,
  )

  app.delete(
    "/api/invoices/:id",
    [authJwt.verifyToken, authJwt.isManagerOrAdmin, validateIdParam],
    controller.deleteInvoice,
  )
}
