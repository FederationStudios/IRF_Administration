import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface toter_blockAttributes {
  pId: string;
  targetRoblox: number;
  targetDiscord?: string;
  mod: string;
  reason?: string;
  end: Date;
}

export type toter_blockOptionalAttributes = 'targetDiscord' | 'reason';
export type toter_blockCreationAttributes = Optional<toter_blockAttributes, toter_blockOptionalAttributes>;

export class toter_block
  extends Model<toter_blockAttributes, toter_blockCreationAttributes>
  implements toter_blockAttributes
{
  declare pId: string;
  declare targetRoblox: number;
  declare targetDiscord?: string;
  declare mod: string;
  declare reason?: string;
  declare end: Date;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof toter_block {
    return toter_block.init(
      {
        pId: {
          type: DataTypes.CHAR(36),
          allowNull: false
        },
        targetRoblox: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        targetDiscord: {
          type: DataTypes.STRING(25),
          allowNull: true
        },
        mod: {
          type: DataTypes.STRING(25),
          allowNull: false
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        end: {
          type: DataTypes.DATE,
          allowNull: false
        }
      },
      {
        sequelize,
        tableName: 'toter_block',
        timestamps: true
      }
    );
  }
}
