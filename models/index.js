const config = require('../config/db.config.js')
const Sequelize = require('sequelize')

const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect,
  pool: {
    max: config.pool.max,
    min: config.pool.min,
    acquire: config.pool.acquire,
    idle: config.pool.idle,
  },
  logging: config.logging,
  timezone: config.timezone,
  dialectOptions: config.dialectOptions,
  define: config.define,
})

const db = {}

db.Sequelize = Sequelize
db.sequelize = sequelize

// Models
db.users = require('./user.model.js')(sequelize, Sequelize)
db.permissions = require('./permission.model.js')(sequelize, Sequelize)
db.clubs = require('./club.model.js')(sequelize, Sequelize)
db.club_managers = require('./clubManager.model.js')(sequelize, Sequelize)
db.tables = require('./table.model.js')(sequelize, Sequelize)
db.gameTypes = require('./gameType.model.js')(sequelize, Sequelize)
db.gamePricings = require('./gamePricing.model.js')(sequelize, Sequelize)
db.players = require('./player.model.js')(sequelize, Sequelize)
db.playerPreferences = require('./playerPreference.model.js')(sequelize, Sequelize)
db.sessions = require('./session.model.js')(sequelize, Sequelize)
db.canteenCategories = require('./canteenCategory.model.js')(sequelize, Sequelize)
db.canteenItems = require('./canteenItem.model.js')(sequelize, Sequelize)
db.canteenStocks = require('./canteenStock.model.js')(sequelize, Sequelize)
db.canteenOrders = require('./canteenOrder.model.js')(sequelize, Sequelize)
db.sessionCanteenOrders = require('./sessionCanteenOrder.model.js')(sequelize, Sequelize)
db.invoices = require('./invoice.model.js')(sequelize, Sequelize)
db.invoiceItems = require('./invoiceItem.model.js')(sequelize, Sequelize)

// Relationships

// User - Permission (One-to-One)
db.users.hasOne(db.permissions, { foreignKey: 'user_id', as: 'permissions' })
db.permissions.belongsTo(db.users, { foreignKey: 'user_id' })

// Club - User (Many-to-Many through ClubManager)
db.users.hasMany(db.club_managers, { foreignKey: 'manager_id', as: 'managed_clubs' })
db.club_managers.belongsTo(db.users, { foreignKey: 'manager_id', as: 'manager' })

db.users.hasMany(db.club_managers, { foreignKey: 'admin_id', as: 'administered_clubs' })
db.club_managers.belongsTo(db.users, { foreignKey: 'admin_id', as: 'admin' })

db.clubs.hasMany(db.club_managers, { foreignKey: 'club_id', as: 'club_managers' })
db.club_managers.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })

// Club - Table (One-to-Many)
db.clubs.hasMany(db.tables, { foreignKey: 'club_id', as: 'tables' })
db.tables.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })

// Table - Session (One-to-Many)
db.tables.hasMany(db.sessions, { foreignKey: 'table_id', as: 'sessions' })
db.sessions.belongsTo(db.tables, { foreignKey: 'table_id', as: 'table' })

// Player - Session (One-to-Many)
db.players.hasMany(db.sessions, { foreignKey: 'player_id', as: 'sessions' })
db.sessions.belongsTo(db.players, { foreignKey: 'player_id', as: 'player' })

// Player - PlayerPreference (One-to-One)
db.players.hasOne(db.playerPreferences, { foreignKey: 'player_id', as: 'preferences' })
db.playerPreferences.belongsTo(db.players, { foreignKey: 'player_id' })

// Club - Player (One-to-Many)
db.clubs.hasMany(db.players, { foreignKey: 'club_id', as: 'players' })
db.players.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })

// GameType - GamePricing (One-to-Many)
db.gameTypes.hasMany(db.gamePricings, { foreignKey: 'game_type_id', as: 'pricings' })
db.gamePricings.belongsTo(db.gameTypes, { foreignKey: 'game_type_id', as: 'game_type' })

// Club - GamePricing (One-to-Many)
db.clubs.hasMany(db.gamePricings, { foreignKey: 'club_id', as: 'game_pricings' })
db.gamePricings.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })

// Session - GamePricing (Many-to-One)
db.gamePricings.hasMany(db.sessions, { foreignKey: 'pricing_id', as: 'sessions' })
db.sessions.belongsTo(db.gamePricings, { foreignKey: 'pricing_id', as: 'pricing' })

// CanteenCategory - CanteenItem (One-to-Many)
db.canteenCategories.hasMany(db.canteenItems, { foreignKey: 'category_id', as: 'items' })
db.canteenItems.belongsTo(db.canteenCategories, { foreignKey: 'category_id', as: 'category' })

// Club - CanteenItem (One-to-Many)
db.clubs.hasMany(db.canteenItems, { foreignKey: 'club_id', as: 'canteen_items' })
db.canteenItems.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })

// CanteenItem - CanteenStock (One-to-One)
db.canteenItems.hasOne(db.canteenStocks, { foreignKey: 'item_id', as: 'stock' })
db.canteenStocks.belongsTo(db.canteenItems, { foreignKey: 'item_id', as: 'item' })

// Club - CanteenStock (One-to-Many)
db.clubs.hasMany(db.canteenStocks, { foreignKey: 'club_id', as: 'stocks' })
db.canteenStocks.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })

// Session - CanteenOrder (One-to-Many through SessionCanteenOrder)
db.sessions.hasMany(db.sessionCanteenOrders, { foreignKey: 'session_id', as: 'canteen_orders' })
db.sessionCanteenOrders.belongsTo(db.sessions, { foreignKey: 'session_id', as: 'session' })

db.canteenOrders.hasMany(db.sessionCanteenOrders, { foreignKey: 'order_id', as: 'session_orders' })
db.sessionCanteenOrders.belongsTo(db.canteenOrders, { foreignKey: 'order_id', as: 'order' })

// CanteenItem - CanteenOrder (Many-to-Many)
db.canteenItems.hasMany(db.canteenOrders, { foreignKey: 'item_id', as: 'orders' })
db.canteenOrders.belongsTo(db.canteenItems, { foreignKey: 'item_id', as: 'item' })

// Club - CanteenOrder (One-to-Many)
db.clubs.hasMany(db.canteenOrders, { foreignKey: 'club_id', as: 'canteen_orders' })
db.canteenOrders.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })

// Session - Invoice (One-to-One)
db.sessions.hasOne(db.invoices, { foreignKey: 'session_id', as: 'invoice' })
db.invoices.belongsTo(db.sessions, { foreignKey: 'session_id', as: 'session' })

// Invoice - InvoiceItem (One-to-Many)
db.invoices.hasMany(db.invoiceItems, { foreignKey: 'invoice_id', as: 'items' })
db.invoiceItems.belongsTo(db.invoices, { foreignKey: 'invoice_id', as: 'invoice' })

// Club - Invoice (One-to-Many)
db.clubs.hasMany(db.invoices, { foreignKey: 'club_id', as: 'invoices' })
db.invoices.belongsTo(db.clubs, { foreignKey: 'club_id', as: 'club' })
db.sessions.belongsTo(db.gameTypes, {
  foreignKey: 'game_type_id',
  as: 'gameType',
})
db.gameTypes.hasMany(db.sessions, {
  foreignKey: 'game_type_id',
})

module.exports = db
