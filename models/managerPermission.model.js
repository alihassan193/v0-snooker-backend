module.exports = (sequelize, Sequelize) => {
  const ManagerPermission = sequelize.define("manager_permissions", {
    manager_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users",
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
    can_manage_tables: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_manage_canteen: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_manage_stock: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_create_tables: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_manage_invoices: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
    can_view_reports: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  })

  return ManagerPermission
}
