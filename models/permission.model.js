module.exports = (sequelize, Sequelize) => {
  const Permission = sequelize.define("permissions", {
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    can_manage_tables: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_manage_canteen: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_view_reports: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  })

  return Permission
}
