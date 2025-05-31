module.exports = (sequelize, Sequelize) => {
  const SnookerTable = sequelize.define("snooker_table", {
    table_number: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    club_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "clubs",
        key: "id",
      },
    },
    status: {
      type: Sequelize.ENUM("available", "occupied", "maintenance", "reserved"),
      defaultValue: "available",
    },
    table_type: {
      type: Sequelize.ENUM("standard", "premium", "vip"),
      defaultValue: "standard",
    },
    description: {
      type: Sequelize.TEXT,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
  })

  return SnookerTable
}
