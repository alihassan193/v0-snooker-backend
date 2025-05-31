const authJwt = require("../middleware/auth")
const controller = require("../controllers/player.controller")
const { validateIdParam } = require("../middleware/validation")

module.exports = (app) => {
  // Player management routes
  app.post("/api/players", [authJwt.verifyToken], controller.createPlayer)

  app.get("/api/players", [authJwt.verifyToken], controller.getAllPlayers)

  app.get("/api/players/:id", [authJwt.verifyToken, validateIdParam], controller.getPlayerById)

  app.put("/api/players/:id", [authJwt.verifyToken, validateIdParam], controller.updatePlayer)

  app.delete("/api/players/:id", [authJwt.verifyToken, validateIdParam], controller.deletePlayer)

  app.get("/api/players/search/:query", [authJwt.verifyToken], controller.searchPlayers)

  app.get("/api/players/:id/sessions", [authJwt.verifyToken, validateIdParam], controller.getPlayerSessions)
}
