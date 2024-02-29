import type { Sequelize } from 'sequelize';
import { bans as _bans } from './bans.js';
import type { bansAttributes, bansCreationAttributes } from './bans.js';

export { _bans as bans };

export type { bansAttributes, bansCreationAttributes };

export function initModels(sequelize: Sequelize) {
  const bans = _bans.initModel(sequelize);

  return {
    bans: bans
  };
}
