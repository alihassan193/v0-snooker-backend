module.exports = (sequelize, Sequelize) => {
  const CanteenStock = sequelize.define("canteen_stocks", {
    item_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "canteen_items",
        key: "id",
      },
    },
    club_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "clubs",
        key: "id",
      },
    },
    quantity: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    min_stock_level: {
      type: Sequelize.INTEGER,
      defaultValue: 5,
    },
    last_restock_date: {
      type: Sequelize.DATE,
    },
    last_restock_quantity: {
      type: Sequelize.INTEGER,
    },
    restock_by: {
      type: Sequelize.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
    },
  })

  return CanteenStock
}
