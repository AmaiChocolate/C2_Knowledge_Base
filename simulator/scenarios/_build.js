/**
 * Regenerate scenarios/*.json from the embedded bank (src/scenarios_data.js), which is
 * what the simulator actually loads. Run after editing the bank so the JSON copies
 * cannot drift:
 *
 *     node simulator/scenarios/_build.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'scenarios_data.js'), 'utf8'), sandbox);

Object.entries(sandbox.SCENARIO_BANK).forEach(([id, scenario]) => {
  fs.writeFileSync(path.join(__dirname, `${id}.json`), JSON.stringify(scenario, null, 2) + '\n');
  console.log(id, scenario.tracks.length, 'tracks');
});
