// Import the necessary modules
const db = require("./db") // Assuming db is imported from a db module

// Add these relationships to your existing index.js

// Player relationships
db.clubs.hasMany(db.players, {
  foreignKey: "club_id",
  as: "players",
})
db.players.belongsTo(db.clubs, {
  foreignKey: "club_id",
  as: "club",
})

db.gameTypes.hasMany(db.players, {
  foreignKey: "preferred_game_type",
  as: "playersWithPreference",
})
db.players.belongsTo(db.gameTypes, {
  foreignKey: "preferred_game_type",
  as: "preferredGameType",
})

// Player preference relationships
db.players.hasMany(db.playerPreferences, {
  foreignKey: "player_id",
  as: "preferences",
})
db.playerPreferences.belongsTo(db.players, {
  foreignKey: "player_id",
  as: "player",
})

// Enhanced session relationships
db.players.hasMany(db.tableSessions, {
  foreignKey: "player_id",
  as: "sessions",
})
db.tableSessions.belongsTo(db.players, {
  foreignKey: "player_id",
  as: "player",
})

// Session canteen order relationships
db.tableSessions.hasMany(db.sessionCanteenOrders, {
  foreignKey: "session_id",
  as: "canteenOrders",
})
db.sessionCanteenOrders.belongsTo(db.tableSessions, {
  foreignKey: "session_id",
  as: "session",
})

db.canteenItems.hasMany(db.sessionCanteenOrders, {
  foreignKey: "canteen_item_id",
})
db.sessionCanteenOrders.belongsTo(db.canteenItems, {
  foreignKey: "canteen_item_id",
  as: "canteenItem",
})

db.users.hasMany(db.sessionCanteenOrders, {
  foreignKey: "served_by",
  as: "servedCanteenOrders",
})
db.sessionCanteenOrders.belongsTo(db.users, {
  foreignKey: "served_by",
  as: "servedBy",
})

// Update canteen items to include club relationship
db.canteenItems.belongsTo(db.clubs, {
  foreignKey: "club_id",
  as: "club",
})
