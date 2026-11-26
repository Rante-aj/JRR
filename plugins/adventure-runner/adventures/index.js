// Meet Cosmo is in its folder but switched off for now. The Forgotten Desert is on
// (JRR: its automation runs as plain packets from src/game/surfaces/play.js).
// Seasonal adventures (join and start only) are listed in seasonal.js.
const seasonal = require('./seasonal');

const tiki = require('./tiki');
tiki.warning = tiki.warning || seasonal.RISKY;

module.exports = [
  require('./phantoms'),
  require('./bittersweets'),
  tiki,
  require('./tfd'),
  ...seasonal.list
];
