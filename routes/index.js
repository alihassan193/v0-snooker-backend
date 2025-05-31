// Main routes index file to organize all routes
module.exports = (app) => {
  // Authentication routes
  require("./auth.routes")(app)

  // Admin management routes
  require("./admin.routes")(app)

  // Club management routes
  require("./club.routes")(app)

  // Player management routes
  require("./player.routes")(app)

  // Table management routes
  require("./table.routes")(app)

  // Session management routes
  require("./session.routes")(app)

  // Game pricing routes
  require("./gamePricing.routes")(app)

  // Canteen management routes
  require("./canteen.routes")(app)

  // Invoice management routes
  require("./invoice.routes")(app)

  // Report routes
  require("./report.routes")(app)
}
