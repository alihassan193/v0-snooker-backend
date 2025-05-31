module.exports = (sequelize, Sequelize) => {
  const GameType = sequelize.define("game_types", {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    pricing_type: {
      type: Sequelize.ENUM("fixed", "per_minute"),
      allowNull: false,
      defaultValue: "fixed",
    },
    description: {
      type: Sequelize.TEXT,
    },
  })

  return GameType
}
