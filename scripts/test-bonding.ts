// Unit tests for the "結合の手" rule.
import { tryCovalent, explainFailure } from '../src/chem/bonding';
import { element } from '../src/data/elements';

const hands = (s: string) => element(s).hands;
let failed = 0;
function check(name: string, cond: boolean, info?: unknown) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.error(`  NG  ${name}`, info ?? '');
  }
}

const hh = tryCovalent(['H', 'H'], hands);
check('H+H → ok (H₂, single bond)', hh.ok && hh.bonds.length === 1 && hh.bonds[0][2] === 1, hh);

const oo = tryCovalent(['O', 'O'], hands);
check('O+O → ok (O₂, double bond)', oo.ok && oo.bonds[0][2] === 2, oo);

const ho = tryCovalent(['H', 'O'], hands);
check('H+O → fails', !ho.ok, ho);
check('H+O → O has 1 free hand', ho.free[1] === 1 && ho.free[0] === 0, ho);
const msg = explainFailure(['H', 'O'], ho);
check('H+O message mentions Oの手が1本', msg.includes('Oの手が1本'), msg);

const hho = tryCovalent(['H', 'H', 'O'], hands);
check('H+H+O → ok (H₂O)', hho.ok && hho.bonds.length === 2, hho);
const ohh = tryCovalent(['O', 'H', 'H'], hands);
check('order does not matter (O+H+H)', ohh.ok);

const hhh = tryCovalent(['H', 'H', 'H'], hands);
check('H+H+H → fails (one H left)', !hhh.ok && explainFailure(['H', 'H', 'H'], hhh).includes('Hの手が1本'), hhh);

const ooo = tryCovalent(['O', 'O', 'O'], hands);
check('O+O+O → fails (no rings in this rule)', !ooo.ok, ooo);

const hoo = tryCovalent(['H', 'O', 'O'], hands);
check('H+O+O → fails', !hoo.ok, hoo);

const coo = tryCovalent(['C', 'O', 'O'], hands);
check('C+O+O → ok (CO₂, two double bonds)', coo.ok && coo.bonds.every((b) => b[2] === 2), coo);

const co = tryCovalent(['C', 'O'], hands);
check('C+O → fails under the simple hands rule', !co.ok, co);

check('single atom → too_few', tryCovalent(['H'], hands).reason === 'too_few');

if (failed) {
  console.error(`${failed} bonding test(s) failed`);
  process.exit(1);
}
console.log('bonding tests passed');
