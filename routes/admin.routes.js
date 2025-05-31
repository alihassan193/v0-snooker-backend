const authJwt = require("../middleware/auth")
const controller = require("../controllers/admin.controller")
const { validateIdParam } = require("../middleware/validation")

module.exports = (app) => {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Headers", "x-access-token, Origin, Content-Type, Accept")
    next()
  })

  // Admin management routes (Super admin only)
  app.post("/api/admin/create-admin", [authJwt.verifyToken, authJwt.isSuperAdmin], controller.createAdmin)
  app.get("/api/admin/users", [authJwt.verifyToken, authJwt.isAdmin], controller.getUsers)
  app.post("/api/admin/create-manager", [authJwt.verifyToken, authJwt.isAdmin], controller.createManager)
  app.put("/api/admin/users/:id", [authJwt.verifyToken, authJwt.isAdmin, validateIdParam], controller.updateUser)
  app.get("/api/admin/admins", [authJwt.verifyToken, authJwt.isSuperAdmin], controller.getAllAdmins)
  app.get(
    "/api/admin/admins/:id",
    [authJwt.verifyToken, authJwt.isSuperAdmin, validateIdParam],
    controller.getAdminById,
  )
  app.put("/api/admin/admins/:id", [authJwt.verifyToken, authJwt.isSuperAdmin, validateIdParam], controller.updateAdmin)
  app.delete(
    "/api/admin/admins/:id",
    [authJwt.verifyToken, authJwt.isSuperAdmin, validateIdParam],
    controller.deleteAdmin,
  )

  // Get clubs managed by current sub-admin
  app.get("/api/admin/managed-clubs", [authJwt.verifyToken, authJwt.isAdmin], controller.getManagedClubs)
}
