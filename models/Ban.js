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
    type: DataTypes.TEXT,
    allowNull: false,
  },
  unixtime: {
    type: DataTypes.BIGINT(12),
    allowNull: false,
  }
});