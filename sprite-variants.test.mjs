import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const files = [
  'soldado-sheet.png', 'soldado-attack01.png', 'soldado-attack02.png',
  'soldado-idle.png', 'soldado-death.png', 'Knight_Walk.png',
  'Knight_Attack01.png', 'Knight_Attack02.png', 'Knight_Attack03.png',
  'Knight_Idle.png', 'Knight_Death.png', 'Knight_Hurt.png', 'Knight_Block.png'
];

const pngSize = buffer => ({width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)});
for (const file of files) {
  const [jade, coral] = await Promise.all([
    readFile(new URL(`./public/assets/variants/jade/${file}`, import.meta.url)),
    readFile(new URL(`./public/assets/variants/coral/${file}`, import.meta.url))
  ]);
  assert.equal(jade.subarray(1,4).toString(), 'PNG', `${file}: Jade debe ser PNG`);
  assert.equal(coral.subarray(1,4).toString(), 'PNG', `${file}: Coral debe ser PNG`);
  assert.deepEqual(pngSize(jade), pngSize(coral), `${file}: ambas paletas conservan el lienzo`);
  assert.notDeepEqual(jade, coral, `${file}: las paletas deben ser distintas`);
}

const app = await readFile(new URL('./public/app.mjs', import.meta.url), 'utf8');
assert.ok(!app.includes('processSheetColors'), 'El navegador no debe recolorear sprites en tiempo real');
assert.ok(app.includes('assets/variants/jade/') && app.includes('assets/variants/coral/'));
console.log(`OK: ${files.length * 2} hojas nativas Jade/Coral sin filtro de color en el navegador.`);
