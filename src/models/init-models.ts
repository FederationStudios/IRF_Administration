import type { Sequelize } from 'sequelize';
import { bans as _bans } from './bans.js';
import type { bansAttributes, bansCreationAttributes } from './bans.js';

export { _bans as Ban };

export type {
  bansAttributes as BanAttributes,
  bansCreationAttributes as BanCreationAttributes
};

export function initModels(sequelize: Sequelize) {
  const bans = _bans.initModel(sequelize)

  return {
    Ban: bans
  };
}
