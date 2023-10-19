import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { tickets, ticketsId } from './tickets.js';

export interface msgsAttributes {
  mId: string;
  author: string;
  tick: string;
  content: string;
  link?: string;
}

export type msgsPk = 'mId';
export type msgsId = msgs[msgsPk];
export type msgsOptionalAttributes = 'link';
export type msgsCreationAttributes = Optional<msgsAttributes, msgsOptionalAttributes>;

export class msgs extends Model<msgsAttributes, msgsCreationAttributes> implements msgsAttributes {
  declare mId: string;
  declare author: string;
  declare tick: string;
  declare content: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare link?: string;

  // msgs belongsTo tickets via tick
  declare tick_ticket: tickets;
  declare getTick_ticket: Sequelize.BelongsToGetAssociationMixin<tickets>;
  declare setTick_ticket: Sequelize.BelongsToSetAssociationMixin<tickets, ticketsId>;
  declare createTick_ticket: Sequelize.BelongsToCreateAssociationMixin<tickets>;

  static initModel(sequelize: Sequelize.Sequelize): typeof msgs {
    return msgs.init(
      {
        mId: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          comment: 'UUID V4',
          defaultValue: Sequelize.UUIDV4
        },
        author: {
          type: DataTypes.CHAR(20),
          allowNull: false,
          comment: 'Snowflake'
        },
        tick: {
          type: DataTypes.UUID,
          allowNull: false,
          comment: 'Associated ticket',
          references: {
            model: 'tickets',
            key: 'ticketId'
          }
        },
        content: {
          type: DataTypes.STRING(2048),
          allowNull: false
        },
        link: {
          type: DataTypes.CHAR(100),
          allowNull: true,
          comment: 'Snowflake'
        }
      },
      {
        sequelize,
        tableName: 'msgs',
        timestamps: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'mId' }]
          },
          {
            name: 'messages_fk_1',
            using: 'BTREE',
            fields: [{ name: 'tick' }]
          }
        ]
      }
    );
  }
}
