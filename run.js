// Прогон модели: печатает все цифры для презентации.  node run.js
const M = require('./model.js');
const f = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);

const P = M.presets();
const runs = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, M.simulate(p)]));

console.log('=== Итоги сценариев (портфель через 1 и 2 года) ===');
for (const [k, r] of Object.entries(runs)) {
  const y = r.years;
  console.log(`${r.params.name.padEnd(36)} Г1 ${f(r.y1.total)} (Л ${f(r.y1.L)} / С ${f(r.y1.T)})  Г2 ${f(r.end.total)} (Л ${f(r.end.L)} / С ${f(r.end.T)})  ` +
    `| выручка ${f(y[0].revenue, 2)}/${f(y[1].revenue, 2)} расходы ${f(y[0].cost, 2)}/${f(y[1].cost, 2)} прибыль ${f(y[0].profit, 2)}/${f(y[1].profit, 2)} ` +
    `маржа ${f(y[0].margin, 2)}%/${f(y[1].margin, 2)}% C/I ${f(y[1].ci, 0)}% | потолок срочного ${f(r.termCap)} удержание ${f(r.rollover)}% потери ${f(r.termLoss, 2)}`);
}

console.log('\n=== Мост 100 → итог ===');
for (const s of M.bridge()) console.log(`${s.label.padEnd(70)} ${s.value >= 0 && s.key !== 'start' && s.key !== 'end' ? '+' : ''}${f(s.value)}`);

const plan = runs.plan, sq = runs.statusQuo;
console.log('\n=== Детали плана по годам ===');
plan.years.forEach((y, i) => console.log(`Год ${i + 1}: ср. портфель ${f(y.avgAUM)} | приток ${f(y.inflow)} | доход капитализ. ${f(y.yieldIn)} | отток Л ${f(y.outL)} С ${f(y.outT)} | выручка Л ${f(y.revL, 2)} С ${f(y.revT, 2)} | пост. ${f(y.fixed, 2)} привл. ${f(y.acq, 2)} | выручка/портфель ${f(y.revMargin, 2)}%`));
sq.years.forEach((y, i) => console.log(`СК Год ${i + 1}: ср. портфель ${f(y.avgAUM)} | приток ${f(y.inflow)} | доход капитализ. ${f(y.yieldIn)} | отток Л ${f(y.outL)} С ${f(y.outT)} | пост. ${f(y.fixed, 2)} привл. ${f(y.acq, 2)}`));
console.log('Run-rate выручки на конец Г2:', f(plan.runRate.revenue, 2), '→ маржа выручки', f(plan.runRate.revenue / plan.end.total * 100, 2) + '%');

console.log('\n=== Валовый приток плана по каналам / источникам / сегментам (2 года) ===');
const gt = plan.gross.total;
console.log('Всего', f(gt));
for (const [c, v] of Object.entries(plan.gross.byChannel)) console.log('  ', M.CHANNELS[c].label.padEnd(50), f(v), f(v / gt * 100, 0) + '%');
for (const [s, v] of Object.entries(plan.gross.bySource)) console.log('  ', M.SRC_LABEL[s].padEnd(50), f(v), f(v / gt * 100, 0) + '%');
for (const [s, v] of Object.entries(plan.gross.bySeg)) console.log('  ', M.SEG_LABEL[s].padEnd(50), f(v), f(v / gt * 100, 0) + '%');

console.log('\n=== Сегменты: деньги сейчас → через 2 года, проникновение (допущение: средний остаток держателя +15%) ===');
for (const s of M.SEGMENTS) {
  const mult = plan.seg[s] / M.CASE.segMoney[s];
  console.log(`  ${M.SEG_LABEL[s].padEnd(10)} ${f(M.CASE.segMoney[s])} → ${f(plan.seg[s])} (×${f(mult, 2)}) доля ${f(plan.seg[s] / plan.end.total * 100, 0)}% | проникновение ${M.CASE.segPen[s]}% → ~${f(M.CASE.segPen[s] * mult / 1.15)}%`);
}
console.log('  потенциал при 100% проникновении (у.е.):', M.SEGMENTS.map((s) => `${M.SEG_LABEL[s]} ${f(M.CASE.segMoney[s] / (M.CASE.segPen[s] / 100), 0)}`).join(', '));

console.log('\n=== Состав срочного счёта (K = 14%) ===');
for (const [a, g] of [[30, 50], [30, 35], [30, 25], [40, 30]]) {
  const c = M.termComposition(a, g, 14, 1.5, 1.5, 20);
  console.log(`  паи ${a}% / сторонние ${f(c.third, 0)}% / группа ${g}%: доходность ${f(c.gross, 2)}% клиенту ${f(c.client, 2)}% вклад ${f(c.deposit, 2)}% премия ${f(c.premium, 2)} п.п. | потолок ${f(c.cap)} (группа ${f(c.capGroup)}, сторонние ${f(c.capThird)})`);
}
const split = M.benefitSplit(1.5, 1.5);
console.log('  Пирог на 1 у.е. облигаций группы:', f(split.pie, 2), 'п.п. → клиент', f(split.client, 2), 'банк', f(split.bank, 2), 'группа', f(split.group, 2));

console.log('\n=== Переток со вкладов ===');
const can = M.cannibalization(14, 1.1, 1.5, 50);
console.log('Полная стоимость вклада для банка при K=14:', f(can.depAllIn, 2));
can.scenarios.forEach((s) => console.log(`  ${s.label.padEnd(64)} теряем ${f(s.lost, 2)} получаем 1,10 → ${s.net >= 0 ? '+' : ''}${f(s.net, 2)} п.п.`));
console.log('  смешанный для действующих вкладов (50/50):', f(can.lostActive, 2));
const cp = M.cannibalizationPortfolio(plan, 50);
console.log(`  Портфель плана: новые деньги ${f(cp.newMoney)}; со действующих вкладов ${f(cp.active)}, с непродлённых ${f(cp.nonRenew)}; комиссия ${f(cp.feeMix, 2)}%`);
console.log(`  Эффект в год: в лоб ${f(cp.naive, 2)} у.е., честно ${f(cp.fair, 2)} у.е.`);
const cpsq = M.cannibalizationPortfolio(sq, 50);
console.log(`  Доли источников статус-кво: ${Object.entries(cpsq.shares).map(([k, v]) => k + ' ' + f(v * 100, 0) + '%').join(', ')}`);
console.log(`  Доли источников план:       ${Object.entries(cp.shares).map(([k, v]) => k + ' ' + f(v * 100, 0) + '%').join(', ')}`);
// точка безубыточности: при какой ценности маргинального вклада переток в ноль
console.log('  Безубыточность для действующих вкладов: ценность вклада =', f(cp.feeMix, 2), 'п.п.');

console.log('\n=== Волна погашения (5 у.е.) ===');
const w0 = M.wave(M.STATUS_QUO), w1 = M.wave(P.plan);
console.log(`  сейчас: удержание ${f(w0.rollover)}%, остаётся ${f(w0.kept, 2)}, теряем ${f(w0.lost, 2)}`);
console.log(`  с мерами: удержание ${f(w1.rollover)}%, остаётся ${f(w1.kept, 2)}, теряем ${f(w1.lost, 2)}`);

console.log('\n=== Воронка ===');
console.log('  ликвидный', f(M.funnel(M.CASE.funnel.liquid), 2) + '% в месяц, срочный', f(M.funnel(M.CASE.funnel.term), 2) + '%');
console.log('  если охват 25%:', f(M.funnel([25, 30, 40, 80]), 2) + '%');

console.log('\n=== Эксперимент: размер выборки на группу ===');
console.log('  3% → 6% (доля денег в продуктах):', M.sampleSize(0.03, 0.06));
console.log('  3% → 5%:', M.sampleSize(0.03, 0.05));
console.log('  70% → 72% (деньги остались в банке):', M.sampleSize(0.70, 0.72));

console.log('\n=== Темп ===');
console.log('  нужно в год ×', f(Math.sqrt(3), 3), '| прошлый год ×1,8; было', f(100 / 1.8), '→ +', f(100 - 100 / 1.8));
