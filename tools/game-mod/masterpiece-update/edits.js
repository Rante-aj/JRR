// The Masterpiece Transfer buttons in src/game/surfaces/tools.js (masterpiece-update).
module.exports = [
  {
    what: 'JR menu button',
    from: "  ['masterpiece', 'Masterpiece Studio']\n]",
    to: "  ['masterpiece', 'Masterpiece Studio'],\n  ['masterpiece-user-transfer', 'Masterpiece Transfer']\n]"
  },
  {
    what: 'In-game Studio window button',
    from: "        { t: 'btn', id: 'open', label: 'Open Masterpiece Studio', style: 'primary' }\n      ]",
    to: "        { t: 'btn', id: 'open', label: 'Open Masterpiece Studio', style: 'primary' },\n        { t: 'btn', id: 'transfer', label: 'Open Masterpiece User Transfer' }\n      ]"
  },
  {
    what: 'In-game Studio window action',
    from: "  act (state, c, v, inputs, ctx) { if (c === 'open') { ctx.openPlugin('masterpiece'); ctx.surfaces.close('masterpiece') } }",
    to: "  act (state, c, v, inputs, ctx) {\n    if (c === 'open') { ctx.openPlugin('masterpiece'); ctx.surfaces.close('masterpiece') }\n    if (c === 'transfer') { ctx.openPlugin('masterpiece-user-transfer'); ctx.surfaces.close('masterpiece') }\n  }"
  }
]
