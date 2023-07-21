import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import { default as config } from "../config.json" assert { type: "json" };
const { discord } = config;

export interface bansAttributes {
  banId: number;
  userID: number;
  gameID: number;
  reason: string;
  proof: string;
  unixtime: number;
  createdAt: Date;
  updatedAt: Date;
}

export type bansPk = 'banId';
export type bansId = bans[bansPk];
export type bansOptionalAttributes = 'banId' | 'proof' | 'createdAt' | 'updatedAt';
export type bansCreationAttributes = Optional<bansAttributes, bansOptionalAttributes>;

export class bans extends Model<bansAttributes, bansCreationAttributes> implements bansAttributes {
  declare banId: number;
  declare userID: number;
  declare gameID: number;
  declare reason: string;
  declare proof: string;
  declare unixtime: number;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof bans {
    return bans.init(
      {
        banId: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        userID: {
          type: DataTypes.BIGINT,
          allowNull: false
        },
        gameID: {
          type: DataTypes.BIGINT,
          allowNull: false
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        proof: {
          type: DataTypes.CHAR(100),
          allowNull: false,
          defaultValue: discord.defaultProofURL
        },
        unixtime: {
          type: DataTypes.BIGINT,
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
        }
      },
      {
        sequelize,
        tableName: 'bans',
        timestamps: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'banId' }]
          }
        ]
      }
    );
  }
}
