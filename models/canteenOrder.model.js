module.exports = (sequelize, Sequelize) => {
  const CanteenOrder = sequelize.define("canteen_orders", {
    session_id: {
      type: Sequelize.INTEGER,
      references: {
        model: "table_sessions",
        key: "id",
      },
    },
    item_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "canteen_items",
        key: "id",
      },
    },
    quantity: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    total_price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    served_by: {
      type: Sequelize.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
    },
  })

  return CanteenOrder
}
