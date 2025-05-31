module.exports = (sequelize, Sequelize) => {
  const Invoice = sequelize.define("invoices", {
    invoice_number: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    session_id: {
      type: Sequelize.INTEGER,
      references: {
        model: "table_sessions",
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
    customer_name: {
      type: Sequelize.STRING,
    },
    customer_phone: {
      type: Sequelize.STRING,
    },
    customer_email: {
      type: Sequelize.STRING,
    },
    subtotal: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    tax_amount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    discount_amount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total_amount: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_method: {
      type: Sequelize.ENUM("cash", "card", "upi", "bank_transfer"),
      defaultValue: "cash",
    },
    payment_status: {
      type: Sequelize.ENUM("pending", "paid", "partial", "refunded"),
      defaultValue: "pending",
    },
    notes: {
      type: Sequelize.TEXT,
    },
    created_by: {
      type: Sequelize.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
    },
  })

  return Invoice
}
