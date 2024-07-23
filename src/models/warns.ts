import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface warnsAttributes {
  warnId: string;
  user: number;
  game: number;
  mod: warnsModData;
  data: warnsData;
  reason: string;
}

export type warnsPk = 'warnId';
export type warnsId = warns[warnsPk];
export type warnsOptionalAttributes = warnsPk;
export type warnsCreationAttributes = Optional<warnsAttributes, warnsOptionalAttributes>;
export type warnsModData = {
  roblox: number;
  discord: string;
};
export type warnsData = {
  privacy: 'Public' | 'Restricted' | 'Private' | 'Database';
  proof: string;
};

export class warns extends Model<warnsAttributes, warnsCreationAttributes> implements warnsAttributes {
  declare warnId: string;
  declare user: number;
  declare game: number;
  declare mod: warnsModData;
  declare data: warnsData;
  declare reason: string;
  declare unwarnReason?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof warns {
    return warns.init(
      {
        warnId: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          comment: 'UUID V4',
          defaultValue: DataTypes.UUIDV4
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
          comment: '{ roblox: number, discord: string }'
        },
        data: {
          type: DataTypes.JSON,
          allowNull: false,
          comment: '{ privacy: string, proof: string }'
        },
        reason: {
          type: DataTypes.CHAR(255),
          allowNull: false
        }
      },
      {
        sequelize,
        tableName: 'warns',
        timestamps: true,
        paranoid: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'warnId' }]
          }
        ]
      }
    );
  }
}
