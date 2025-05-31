module.exports = (sequelize, Sequelize) => {
  const ClubManager = sequelize.define("club_managers", {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    admin_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
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
    is_active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
  })

  return ClubManager
}
