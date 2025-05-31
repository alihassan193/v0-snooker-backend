module.exports = (sequelize, Sequelize) => {
  const CanteenCategory = sequelize.define("canteen_categories", {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: Sequelize.TEXT,
    },
  })

  return CanteenCategory
}
