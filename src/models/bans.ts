import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface bansAttributes {
  banId: string;
  user: number;
  game: number;
  mod: bansModData;
  data: bansData;
  reason: string;
}

export type bansPk = 'banId';
export type bansId = bans[bansPk];
export type bansOptionalAttributes = bansPk;
export type bansCreationAttributes = Optional<bansAttributes, bansOptionalAttributes>;
export type bansModData = {
  roblox: number;
  discord: string;
};
export type bansData = {
  privacy: 'Public' | 'Restricted' | 'Private' | 'Database';
  proof: string;
};

export class bans extends Model<bansAttributes, bansCreationAttributes> implements bansAttributes {
  declare banId: string;
  declare user: number;
  declare game: number;
  declare mod: bansModData;
  declare data: bansData;
  declare reason: string;
  declare createdAt: Date;
  declare updatedAt: Date;


  static initModel(sequelize: Sequelize.Sequelize): typeof bans {
    return bans.init({
    banId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      primaryKey: true,
      comment: "UUID V4"
    },
    user: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    game: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    mod: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "{ roblox: number, discord: string }"
    },
    data: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "{ privacy: string, proof: string }"
    },
    reason: {
      type: DataTypes.CHAR(255),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'bans',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "banId" },
        ]
      },
    ]
  });
  }
}
