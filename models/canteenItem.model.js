module.exports = (sequelize, Sequelize) => {
  const CanteenItem = sequelize.define("canteen_items", {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description: {
      type: Sequelize.TEXT,
    },
    price: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    },
    stock_quantity: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    is_available: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    image_url: {
      type: Sequelize.STRING,
    },
    category_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "canteen_categories",
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
    created_by: {
      type: Sequelize.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
    },
  })

  return CanteenItem
}
