module.exports = (sequelize, Sequelize) => {
  const SessionCanteenOrder = sequelize.define("session_canteen_orders", {
    session_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "table_sessions",
        key: "id",
      },
    },
    canteen_item_id: {
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
    unit_price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    total_price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    order_time: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    status: {
      type: Sequelize.ENUM("pending", "preparing", "served", "cancelled"),
      defaultValue: "pending",
    },
    served_by: {
      type: Sequelize.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
    },
    notes: {
      type: Sequelize.TEXT,
    },
  })

  return SessionCanteenOrder
}
