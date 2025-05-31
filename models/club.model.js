module.exports = (sequelize, Sequelize) => {
  const Club = sequelize.define("clubs", {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    address: {
      type: Sequelize.TEXT,
    },
    phone: {
      type: Sequelize.STRING,
    },
    email: {
      type: Sequelize.STRING,
      validate: {
        isEmail: true,
      },
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    opening_hours: {
      type: Sequelize.JSON,
    },
    description: {
      type: Sequelize.TEXT,
    },
    created_by: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
  })

  return Club
}
