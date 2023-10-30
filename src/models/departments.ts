import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { divisions, divisionsId } from './divisions.js';

export interface departmentsAttributes {
  name: string;
  department?: string;
  guildId: string;
  emoji: string;
  contacts: string;
}

export type departmentsPk = 'name';
export type departmentsId = departments[departmentsPk];
export type departmentsOptionalAttributes = 'department';
export type departmentsCreationAttributes = Optional<departmentsAttributes, departmentsOptionalAttributes>;

export class departments
  extends Model<departmentsAttributes, departmentsCreationAttributes>
  implements departmentsAttributes
{
  declare name: string;
  declare department?: string;
  declare guildId: string;
  declare emoji: string;
  declare contacts: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare deletedAt?: Date;

  // departments belongsTo departments via department
  declare department_department: departments;
  declare getDepartment_department: Sequelize.BelongsToGetAssociationMixin<departments>;
  declare setDepartment_department: Sequelize.BelongsToSetAssociationMixin<departments, departmentsId>;
  declare createDepartment_department: Sequelize.BelongsToCreateAssociationMixin<departments>;
  // departments hasMany divisions via division
  declare divisions: divisions[];
  declare getDivisions: Sequelize.HasManyGetAssociationsMixin<divisions>;
  declare setDivisions: Sequelize.HasManySetAssociationsMixin<divisions, divisionsId>;
  declare addDivision: Sequelize.HasManyAddAssociationMixin<divisions, divisionsId>;
  declare addDivisions: Sequelize.HasManyAddAssociationsMixin<divisions, divisionsId>;
  declare createDivision: Sequelize.HasManyCreateAssociationMixin<divisions>;
  declare removeDivision: Sequelize.HasManyRemoveAssociationMixin<divisions, divisionsId>;
  declare removeDivisions: Sequelize.HasManyRemoveAssociationsMixin<divisions, divisionsId>;
  declare hasDivision: Sequelize.HasManyHasAssociationMixin<divisions, divisionsId>;
  declare hasDivisions: Sequelize.HasManyHasAssociationsMixin<divisions, divisionsId>;
  declare countDivisions: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof departments {
    return departments.init(
      {
        name: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        department: {
          type: DataTypes.STRING(50),
          allowNull: true,
          references: {
            model: 'departments',
            key: 'name'
          }
        },
        guildId: {
          type: DataTypes.STRING(25),
          allowNull: false
        },
        emoji: {
          type: DataTypes.CHAR(36),
          allowNull: false
        },
        contacts: {
          type: DataTypes.CHAR(32),
          allowNull: false
        }
      },
      {
        sequelize,
        tableName: 'departments',
        timestamps: true,
        paranoid: true,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'name' }]
          },
          {
            name: 'departments_fk_1',
            using: 'BTREE',
            fields: [{ name: 'department' }]
          }
        ]
      }
    );
  }
}
