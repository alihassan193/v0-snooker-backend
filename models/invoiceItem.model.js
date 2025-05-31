module.exports = (sequelize, Sequelize) => {
  const InvoiceItem = sequelize.define("invoice_items", {
    invoice_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "invoices",
        key: "id",
      },
    },
    item_type: {
      type: Sequelize.ENUM("table_session", "canteen_item"),
      allowNull: false,
    },
    item_id: {
      type: Sequelize.INTEGER,
    },
    description: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    quantity: {
      type: Sequelize.INTEGER,
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
  })

  return InvoiceItem
}
