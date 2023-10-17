import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { departments, departmentsId } from './departments.js';
import type { tickets, ticketsId } from '../models/tickets.js';

export interface divisionsAttributes {
  divId: number;
  name: string;
  guildId: string;
  division: string;
  emoji: string;
  contacts: string;
}

export type divisionsPk = 'divId';
export type divisionsId = divisions[divisionsPk];
export type divisionsOptionalAttributes = 'divId';
export type divisionsCreationAttributes = Optional<divisionsAttributes, divisionsOptionalAttributes>;

export class divisions extends Model<divisionsAttributes, divisionsCreationAttributes> implements divisionsAttributes {
  declare divId: number;
  declare name: string;
  declare guildId: string;
  declare division: string;
  declare emoji: string;
  declare contacts: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt?: Date;

  // divisions belongsTo departments via division
  declare division_department: departments;
  declare getDivision_department: Sequelize.BelongsToGetAssociationMixin<departments>;
  declare setDivision_department: Sequelize.BelongsToSetAssociationMixin<departments, departmentsId>;
  declare createDivision_department: Sequelize.BelongsToCreateAssociationMixin<departments>;
  // divisions hasMany tickets via division
  declare tickets: tickets[];
  declare getTickets: Sequelize.HasManyGetAssociationsMixin<tickets>;
  declare setTickets: Sequelize.HasManySetAssociationsMixin<tickets, ticketsId>;
  declare addTicket: Sequelize.HasManyAddAssociationMixin<tickets, ticketsId>;
  declare addTickets: Sequelize.HasManyAddAssociationsMixin<tickets, ticketsId>;
  declare createTicket: Sequelize.HasManyCreateAssociationMixin<tickets>;
  declare removeTicket: Sequelize.HasManyRemoveAssociationMixin<tickets, ticketsId>;
  declare removeTickets: Sequelize.HasManyRemoveAssociationsMixin<tickets, ticketsId>;
  declare hasTicket: Sequelize.HasManyHasAssociationMixin<tickets, ticketsId>;
  declare hasTickets: Sequelize.HasManyHasAssociationsMixin<tickets, ticketsId>;
  declare countTickets: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof divisions {
    return divisions.init(
      {
        divId: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        guildId: {
          type: DataTypes.STRING(25),
          allowNull: false
        },
        division: {
          type: DataTypes.STRING(50),
          allowNull: false,
          references: {
            model: 'departments',
            key: 'name'
          }
        },
        emoji: {
          type: DataTypes.CHAR(36),
          allowNull: false
        },
        contacts: {
          type: DataTypes.CHAR(20),
          allowNull: false,
          unique: 'contacts_2'
        }
      },
      {
        sequelize,
        tableName: 'divisions',
        timestamps: true,
        paranoid: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'divId' }]
          },
          {
            name: 'contacts',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'contacts' }]
          },
          {
            name: 'contacts_2',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'contacts' }]
          },
          {
            name: 'divisions_fk_1',
            using: 'BTREE',
            fields: [{ name: 'division' }]
          }
        ]
      }
    );
  }
}
