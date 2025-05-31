module.exports = (sequelize, Sequelize) => {
  const TableSession = sequelize.define("table_sessions", {
    session_code: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    table_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "snooker_tables",
        key: "id",
      },
    },
    game_type_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "game_types",
        key: "id",
      },
    },
    player_id: {
      type: Sequelize.INTEGER,
      references: {
        model: "players",
        key: "id",
      },
    },
    guest_player_name: {
      type: Sequelize.STRING,
    },
    guest_player_phone: {
      type: Sequelize.STRING,
    },
    is_guest: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    start_time: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
    end_time: {
      type: Sequelize.DATE,
    },
    paused_at: {
      type: Sequelize.DATE,
    },
    paused_duration: {
      type: Sequelize.INTEGER,
    },
    duration_minutes: {
      type: Sequelize.INTEGER,
    },
    game_amount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    canteen_amount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    total_amount: {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
    },
    status: {
      type: Sequelize.ENUM("active", "paused", "completed", "cancelled"),
      defaultValue: "active",
    },
    payment_status: {
      type: Sequelize.ENUM("pending", "paid", "partial"),
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

  return TableSession
}
