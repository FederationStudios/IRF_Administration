const { DataTypes } = require("sequelize");

module.exports.import = (sequelize) => sequelize.define("Ban", {
  banId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userID: {
    type: DataTypes.BIGINT(11),
    allowNull: false
  },
  gameID: {
    type: DataTypes.BIGINT(11),
    allowNull: false,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  proof: {
    type: DataTypes.CHAR(100),
    allowNull: false,
    defaultValue: "https://discord.com/channels/989558770801737778/1059784888603127898/1063318255265120396"
  },
  unixtime: {
    type: DataTypes.BIGINT(12),
    allowNull: false,
  }
});