module.exports = (sequelize, Sequelize) => {
  const Player = sequelize.define("players", {
    player_code: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    first_name: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    last_name: {
      type: Sequelize.STRING,
    },
    phone: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    email: {
      type: Sequelize.STRING,
      validate: {
        isEmail: true,
      },
    },
    date_of_birth: {
      type: Sequelize.DATEONLY,
    },
    address: {
      type: Sequelize.TEXT,
    },
    membership_type: {
      type: Sequelize.ENUM("regular", "premium", "vip"),
      defaultValue: "regular",
    },
    membership_expiry: {
      type: Sequelize.DATEONLY,
    },
    total_visits: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    total_spent: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    preferred_game_type: {
      type: Sequelize.INTEGER,
      references: {
        model: "game_types",
        key: "id",
      },
    },
    notes: {
      type: Sequelize.TEXT,
    },
    is_active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    club_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "clubs",
        key: "id",
      },
    },
  })

  return Player
}
