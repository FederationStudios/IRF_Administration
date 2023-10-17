import type { Sequelize } from 'sequelize';
import { bans as _bans } from './bans.js';
import type { bansAttributes, bansCreationAttributes } from './bans.js';
import { departments as _departments } from './departments.js';
import type { departmentsAttributes, departmentsCreationAttributes } from './departments.js';
import { divisions as _divisions } from './divisions.js';
import type { divisionsAttributes, divisionsCreationAttributes } from './divisions.js';
import { msgs as _msgs } from './msgs.js';
import type { msgsAttributes, msgsCreationAttributes } from './msgs.js';
import { tickets as _tickets } from '../models/tickets.js';
import type { ticketsAttributes, ticketsCreationAttributes } from '../models/tickets.js';

export { _bans as bans, _departments as departments, _divisions as divisions, _msgs as msgs, _tickets as tickets };

export type {
  bansAttributes,
  bansCreationAttributes,
  departmentsAttributes,
  departmentsCreationAttributes,
  divisionsAttributes,
  divisionsCreationAttributes,
  msgsAttributes,
  msgsCreationAttributes,
  ticketsAttributes,
  ticketsCreationAttributes
};

export function initModels(sequelize: Sequelize) {
  const departments = _departments.initModel(sequelize);
  const divisions = _divisions.initModel(sequelize);
  const msgs = _msgs.initModel(sequelize);
  const tickets = _tickets.initModel(sequelize);

  departments.belongsTo(departments, { as: 'department_department', foreignKey: 'department' });
  departments.hasMany(departments, { as: 'departments', foreignKey: 'department' });
  divisions.belongsTo(departments, { as: 'division_department', foreignKey: 'division' });
  departments.hasMany(divisions, { as: 'divisions', foreignKey: 'division' });
  tickets.belongsTo(divisions, { as: 'division_division', foreignKey: 'division' });
  divisions.hasMany(tickets, { as: 'tickets', foreignKey: 'division' });
  msgs.belongsTo(tickets, { as: 'tick_ticket', foreignKey: 'tick' });
  tickets.hasMany(msgs, { as: 'msgs', foreignKey: 'tick' });

  return {
    bans: _bans,
    departments: departments,
    divisions: divisions,
    msgs: msgs,
    tickets: tickets
  };
}
