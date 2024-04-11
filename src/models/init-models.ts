import type { Sequelize } from "sequelize";
import type { bansAttributes, bansCreationAttributes } from "./bans.js";
import { bans as _bans } from "./bans.js";
import type { toter_blockAttributes, toter_blockCreationAttributes } from "./toter_block.js";
import { toter_block as _toter_block } from "./toter_block.js";

export {
  _bans as bans,
  _toter_block as toter_block
};

  export type {
    bansAttributes,
    bansCreationAttributes,
    toter_blockAttributes,
    toter_blockCreationAttributes
  };

export function initModels(sequelize: Sequelize) {
  const bans = _bans.initModel(sequelize);
  const toter_block = _toter_block.initModel(sequelize);


  return {
    bans: bans,
    toter_block: toter_block,
  };
}
