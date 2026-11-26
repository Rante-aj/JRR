/*
 * Seasonal adventures JRR can join and start for you (Rante's list).
 * No automatic steps yet: JRR gets you in and presses Start, you play it.
 * Steps can be added to any of these later, the same way as Phantoms.
 *
 * warning: shown in red when picked; Start has to be pressed twice.
 * joinPacket: Rante's own join packet. Many seasonal adventures are one big
 * shared lobby you can leave and come back to mid-adventure, not a fresh
 * room; Join game sends this packet as is, then only presses Start if the
 * game didn't take you straight in.
 */

const RISKY = 'Careful: some seasonal events and adventures can get you trade banned, banned, or even IP banned. Use this one at your own risk.'

const joinOnly = (id, name, questId, risky) => ({
  id,
  name,
  questId,
  modes: ['normal'],
  joinOnly: true,
  joinPacket: `%xt%o%qj%{room}%1#1%${questId}%0%0%`,
  warning: risky ? RISKY : null,
  steps: [],
  finishMessage: `${name} has started. Play it yourself from here.`
});

module.exports = {
  RISKY,
  list: [
    joinOnly('special-delivery', 'Special Delivery', 33),
    joinOnly('spring-festival', 'Spring Festival', 35),
    joinOnly('battle-for-the-beacon', 'Battle for the Beacon', 36),
    joinOnly('jamaaliday-rescue', 'Jamaaliday Rescue', 49),
    joinOnly('lucky-clovers', 'Lucky Clovers', 51, true),
    joinOnly('twists-and-turns', 'Twists and Turns', 62),
    joinOnly('new-years-fortune', 'New Year’s Fortune', 63),
    joinOnly('grahams-workshop', 'Graham’s Workshop', 66)
  ]
};
