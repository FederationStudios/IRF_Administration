import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { divisions, divisionsId } from './divisions.js';
import type { msgs, msgsId } from './msgs.js';

export interface ticketsAttributes {
  ticketId: string;
  status: 'Open' | 'Stale' | 'Closed' | 'Transferring';
  author: string;
  division: number;
  claimer?: string;
}

export type ticketsPk = 'ticketId';
export type ticketsId = tickets[ticketsPk];
export type ticketsOptionalAttributes = 'ticketId' | 'status' | 'claimer';
export type ticketsCreationAttributes = Optional<ticketsAttributes, ticketsOptionalAttributes>;

export class tickets extends Model<ticketsAttributes, ticketsCreationAttributes> implements ticketsAttributes {
  declare ticketId: string;
  declare status: 'Open' | 'Stale' | 'Closed' | 'Transferring';
  declare author: string;
  declare division: number;
  declare claimer?: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  // tickets belongsTo divisions via division
  declare division_division: divisions;
  declare getDivision_division: Sequelize.BelongsToGetAssociationMixin<divisions>;
  declare setDivision_division: Sequelize.BelongsToSetAssociationMixin<divisions, divisionsId>;
  declare createDivision_division: Sequelize.BelongsToCreateAssociationMixin<divisions>;
  // tickets hasMany msgs via tick
  declare msgs: msgs[];
  declare getMsgs: Sequelize.HasManyGetAssociationsMixin<msgs>;
  declare setMsgs: Sequelize.HasManySetAssociationsMixin<msgs, msgsId>;
  declare addMsg: Sequelize.HasManyAddAssociationMixin<msgs, msgsId>;
  declare addMsgs: Sequelize.HasManyAddAssociationsMixin<msgs, msgsId>;
  declare createMsg: Sequelize.HasManyCreateAssociationMixin<msgs>;
  declare removeMsg: Sequelize.HasManyRemoveAssociationMixin<msgs, msgsId>;
  declare removeMsgs: Sequelize.HasManyRemoveAssociationsMixin<msgs, msgsId>;
  declare hasMsg: Sequelize.HasManyHasAssociationMixin<msgs, msgsId>;
  declare hasMsgs: Sequelize.HasManyHasAssociationsMixin<msgs, msgsId>;
  declare countMsgs: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof tickets {
    return tickets.init(
      {
        ticketId: {
          type: DataTypes.CHAR(36),
          allowNull: false,
          primaryKey: true,
          comment: 'UUID V4'
        },
        status: {
          type: DataTypes.ENUM('Open', 'Stale', 'Closed', 'Transferring'),
          allowNull: false,
          defaultValue: 'Open'
        },
        author: {
          type: DataTypes.CHAR(20),
          allowNull: false,
          comment: 'Snowflake'
        },
        division: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'divisions',
            key: 'divId'
          }
        },
        claimer: {
          type: DataTypes.CHAR(20),
          allowNull: true,
          comment: 'Snowflake'
        }
      },
      {
        sequelize,
        tableName: 'tickets',
        timestamps: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'ticketId' }]
          },
          {
            name: 'tickets_fk_1',
            using: 'BTREE',
            fields: [{ name: 'division' }]
          }
        ]
      }
    );
  }
}
