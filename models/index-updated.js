const dbConfig = require("../config/db.config.js")
const Sequelize = require("sequelize")

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  pool: dbConfig.pool,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  },
})

const db = {}

db.Sequelize = Sequelize
db.sequelize = sequelize

// Import all models
db.users = require("./user.model.js")(sequelize, Sequelize)
db.permissions = require("./permission.model.js")(sequelize, Sequelize)
db.clubs = require("./club.model.js")(sequelize, Sequelize)
db.clubManagers = require("./clubManager.model.js")(sequelize, Sequelize)
db.managerPermissions = require("./managerPermission.model.js")(sequelize, Sequelize)
db.tables = require("./table-updated.model.js")(sequelize, Sequelize)
db.gameTypes = require("./gameType-updated.model.js")(sequelize, Sequelize)
db.gamePricing = require("./gamePricing-updated.model.js")(sequelize, Sequelize)
db.tableSessions = require("./session.model.js")(sequelize, Sequelize)
db.canteenCategories = require("./canteenCategory.model.js")(sequelize, Sequelize)
db.canteenItems = require("./canteenItem.model.js")(sequelize, Sequelize)
db.canteenOrders = require("./canteenOrder.model.js")(sequelize, Sequelize)
db.invoices = require("./invoice.model.js")(sequelize, Sequelize)
db.invoiceItems = require("./invoiceItem.model.js")(sequelize, Sequelize)

// Define all relationships
// User relationships
db.users.hasOne(db.permissions, {
  foreignKey: "user_id",
  onDelete: "CASCADE",
})
db.permissions.belongsTo(db.users, {
  foreignKey: "user_id",
})

// Club relationships
db.users.hasMany(db.clubs, {
  foreignKey: "created_by",
  as: "createdClubs",
})
db.clubs.belongsTo(db.users, {
  foreignKey: "created_by",
  as: "creator",
})

// Club Manager relationships
db.clubManagers.belongsTo(db.users, {
  foreignKey: "admin_id",
  as: "admin",
})
db.clubManagers.belongsTo(db.users, {
  foreignKey: "manager_id",
  as: "manager",
})
db.clubManagers.belongsTo(db.clubs, {
  foreignKey: "club_id",
  as: "club",
})

db.users.hasMany(db.clubManagers, {
  foreignKey: "admin_id",
  as: "managedClubs",
})
db.users.hasMany(db.clubManagers, {
  foreignKey: "manager_id",
  as: "assignedClubs",
})
db.clubs.hasMany(db.clubManagers, {
  foreignKey: "club_id",
  as: "managers",
})

// Manager Permission relationships
db.managerPermissions.belongsTo(db.users, {
  foreignKey: "manager_id",
  as: "manager",
})
db.managerPermissions.belongsTo(db.clubs, {
  foreignKey: "club_id",
  as: "club",
})

db.users.hasMany(db.managerPermissions, {
  foreignKey: "manager_id",
  as: "clubPermissions",
})
db.clubs.hasMany(db.managerPermissions, {
  foreignKey: "club_id",
  as: "managerPermissions",
})

// Table relationships
db.clubs.hasMany(db.tables, {
  foreignKey: "club_id",
  as: "tables",
})
db.tables.belongsTo(db.clubs, {
  foreignKey: "club_id",
  as: "club",
})

db.users.hasMany(db.tables, {
  foreignKey: "created_by",
  as: "createdTables",
})
db.tables.belongsTo(db.users, {
  foreignKey: "created_by",
  as: "creator",
})

// Game pricing relationships
db.tables.hasMany(db.gamePricing, {
  foreignKey: "table_id",
})
db.gamePricing.belongsTo(db.tables, {
  foreignKey: "table_id",
})

db.gameTypes.hasMany(db.gamePricing, {
  foreignKey: "game_type_id",
})
db.gamePricing.belongsTo(db.gameTypes, {
  foreignKey: "game_type_id",
})

// Session relationships
db.tables.hasMany(db.tableSessions, {
  foreignKey: "table_id",
})
db.tableSessions.belongsTo(db.tables, {
  foreignKey: "table_id",
})

db.gameTypes.hasMany(db.tableSessions, {
  foreignKey: "game_type_id",
})
db.tableSessions.belongsTo(db.gameTypes, {
  foreignKey: "game_type_id",
})

// Canteen relationships
db.clubs.hasMany(db.canteenItems, {
  foreignKey: "club_id",
  as: "canteenItems",
})
db.canteenItems.belongsTo(db.clubs, {
  foreignKey: "club_id",
  as: "club",
})

db.canteenCategories.hasMany(db.canteenItems, {
  foreignKey: "category_id",
})
db.canteenItems.belongsTo(db.canteenCategories, {
  foreignKey: "category_id",
})

db.users.hasMany(db.canteenItems, {
  foreignKey: "created_by",
  as: "createdItems",
})
db.canteenItems.belongsTo(db.users, {
  foreignKey: "created_by",
  as: "creator",
})

// Canteen order relationships
db.tableSessions.hasMany(db.canteenOrders, {
  foreignKey: "session_id",
})
db.canteenOrders.belongsTo(db.tableSessions, {
  foreignKey: "session_id",
})

db.canteenItems.hasMany(db.canteenOrders, {
  foreignKey: "item_id",
})
db.canteenOrders.belongsTo(db.canteenItems, {
  foreignKey: "item_id",
})

db.users.hasMany(db.canteenOrders, {
  foreignKey: "served_by",
  as: "servedOrders",
})
db.canteenOrders.belongsTo(db.users, {
  foreignKey: "served_by",
  as: "servedBy",
})

// Invoice relationships
db.clubs.hasMany(db.invoices, {
  foreignKey: "club_id",
})
db.invoices.belongsTo(db.clubs, {
  foreignKey: "club_id",
})

db.tableSessions.hasOne(db.invoices, {
  foreignKey: "session_id",
})
db.invoices.belongsTo(db.tableSessions, {
  foreignKey: "session_id",
})

db.users.hasMany(db.invoices, {
  foreignKey: "created_by",
  as: "createdInvoices",
})
db.invoices.belongsTo(db.users, {
  foreignKey: "created_by",
  as: "creator",
})

// Invoice item relationships
db.invoices.hasMany(db.invoiceItems, {
  foreignKey: "invoice_id",
  as: "items",
})
db.invoiceItems.belongsTo(db.invoices, {
  foreignKey: "invoice_id",
})

module.exports = db
