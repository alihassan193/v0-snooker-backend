const authJwt = require("../middleware/auth")
const controller = require("../controllers/club.controller")
const { validateIdParam } = require("../middleware/validation")

module.exports = (app) => {
  // Club management routes (Super Admin only)
  app.post("/api/clubs", [authJwt.verifyToken, authJwt.isSuperAdmin], controller.createClub)

  app.get("/api/clubs", [authJwt.verifyToken], controller.getAllClubs)

  app.get("/api/clubs/:id", [authJwt.verifyToken, validateIdParam], controller.getClubById)

  app.put("/api/clubs/:id", [authJwt.verifyToken, authJwt.isSuperAdmin, validateIdParam], controller.updateClub)

  app.delete("/api/clubs/:id", [authJwt.verifyToken, authJwt.isSuperAdmin, validateIdParam], controller.deleteClub)
}
