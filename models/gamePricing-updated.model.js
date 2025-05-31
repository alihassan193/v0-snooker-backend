module.exports = (sequelize, Sequelize) => {
  const GamePricing = sequelize.define("game_pricing", {
    table_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "snooker_tables",
        key: "id",
      },
    },
    game_type_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "game_types",
        key: "id",
      },
    },
    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    // For Frame games (fixed price)
    fixed_price: {
      type: Sequelize.DECIMAL(10, 2),
    },
    // For Century games (per minute pricing)
    price_per_minute: {
      type: Sequelize.DECIMAL(10, 2),
    },
    time_limit_minutes: {
      type: Sequelize.INTEGER,
    },
    is_unlimited_time: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
  })

  return GamePricing
}
