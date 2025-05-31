module.exports = (sequelize, Sequelize) => {
  const PlayerPreference = sequelize.define("player_preferences", {
    player_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "players",
        key: "id",
      },
    },
    preference_type: {
      type: Sequelize.ENUM("favorite_table", "favorite_canteen_item", "preferred_time", "special_request"),
      allowNull: false,
    },
    preference_value: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    preference_data: {
      type: Sequelize.JSON,
    },
  })

  return PlayerPreference
}
