import type { Sequelize } from 'sequelize';
import type { bansAttributes, bansCreationAttributes } from './bans.js';
import { bans as _bans } from './bans.js';
import type { toter_blockAttributes, toter_blockCreationAttributes } from './toter_block.js';
import { toter_block as _toter_block } from './toter_block.js';
import type { warnsAttributes, warnsCreationAttributes } from './warns.js';
import { warns as _warns } from './warns.js';

export { _bans as bans, _toter_block as toter_block, _warns as warns };

export type {
  bansAttributes,
  bansCreationAttributes,
  toter_blockAttributes,
  toter_blockCreationAttributes,
  warnsAttributes,
  warnsCreationAttributes
};

export function initModels(sequelize: Sequelize) {
  const bans = _bans.initModel(sequelize);
  const toter_block = _toter_block.initModel(sequelize);
  const warns = _warns.initModel(sequelize);

  return {
    bans: bans,
    toter_block: toter_block,
    warns: warns
  };
}
