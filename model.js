// Расчётная модель кейса «Стратегия роста квази-накопительных продуктов».
// Единый источник цифр для презентации и симулятора.
// Все величины — в условных единицах (у.е.) и % годовых.
// Всё, чего нет в кейсе, — допущения; они собраны в STATUS_QUO / PLAN и помечены комментариями.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CaseModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SEGMENTS = ['uhnwi', 'hnwi', 'prem', 'mass'];
  const SEG_LABEL = { uhnwi: 'UHNWI', hnwi: 'HNWI', prem: 'Премиум', mass: 'Массовые' };
  const SOURCES = ['depNonRenew', 'depActive', 'broker', 'otherBanks'];
  const SRC_LABEL = {
    depNonRenew: 'Непродлённые вклады банка',
    depActive: 'Действующие вклады и накопительные счета банка',
    broker: 'Брокерские счета и фонды банка',
    otherBanks: 'Другие банки',
  };

  // ---------- Данные кейса ----------
  const CASE = {
    L0: 75, T0: 25,                    // портфель: ликвидный / срочный
    revenueNow: 1.1, costNow: 0.9,
    segMoney: { uhnwi: 25, hnwi: 35, prem: 30, mass: 10 }, // доля денег, % = у.е. при портфеле 100
    segClients: { uhnwi: 1, hnwi: 9, prem: 30, mass: 60 }, // доля клиентов продуктов, %
    segPen: { uhnwi: 10, hnwi: 15, prem: 5, mass: 0.7 },  // проникновение ликвидного счёта, % (масс: «меньше 1%» → допущение 0,7)
    groupBondsNow: 12.5,               // 50% от 25
    groupBondsMax: 20,                 // лимит: срочный +60% при текущем составе → 12,5 × 1,6
    depMargin: 2.0,                    // маржа вкладов
    lastYearMult: 1.8,
    funnel: {
      liquid: [10, 30, 40, 80],
      term: [10, 40, 25, 80],
    },
  };

  // ---------- Каналы привлечения ----------
  // seg — откуда (сегменты), src — из каких денег. Все доли — допущения.
  const CHANNELS = {
    base: {
      label: 'Текущие каналы (баннеры в приложении)',
      seg: { uhnwi: 0.2, hnwi: 0.3, prem: 0.35, mass: 0.15 },
      // кейс: 50% со вкладов, 25% брокерские/фонды, 25% другие банки; из 50% — 20 п.п. с непродлённых вкладов (допущение)
      src: { depNonRenew: 0.2, depActive: 0.3, broker: 0.25, otherBanks: 0.25 },
    },
    depTrig: {
      label: 'Предложение при погашении вклада',
      seg: { uhnwi: 0.1, hnwi: 0.25, prem: 0.5, mass: 0.15 },
      src: { depNonRenew: 0.8, depActive: 0.2, broker: 0, otherBanks: 0 },
    },
    mgr: {
      label: 'Персональные менеджеры',
      seg: { uhnwi: 0.35, hnwi: 0.45, prem: 0.2, mass: 0 },
      src: { depNonRenew: 0.1, depActive: 0.25, broker: 0.15, otherBanks: 0.5 },
    },
    appTrig: {
      label: 'Триггеры: крупный входящий перевод, зарплата',
      seg: { uhnwi: 0.05, hnwi: 0.2, prem: 0.5, mass: 0.25 },
      src: { depNonRenew: 0, depActive: 0.3, broker: 0.2, otherBanks: 0.5 },
    },
    biz: {
      label: 'Собственники бизнеса',
      seg: { uhnwi: 0.4, hnwi: 0.6, prem: 0, mass: 0 },
      src: { depNonRenew: 0, depActive: 0.4, broker: 0.1, otherBanks: 0.5 },
    },
    uhnwi: {
      label: 'UHNWI: менеджер каждому + индивидуальные выпуски',
      seg: { uhnwi: 1, hnwi: 0, prem: 0, mass: 0 },
      src: { depNonRenew: 0, depActive: 0.2, broker: 0.1, otherBanks: 0.7 },
    },
  };
  const CHANNEL_KEYS = Object.keys(CHANNELS);

  // ---------- Сценарий «статус-кво»: всё как сейчас ----------
  const STATUS_QUO = {
    name: 'Статус-кво',
    kStart: 14, kEnd: 10, fastDrop: 0, // ключевая ставка: сейчас 14% → допущение 10% через 2 года
    liqSpread: 1.25,                   // ликвидный: ключевая − 1–1,5 п.п.
    depSpread: 1.5,                    // ставка вклада на срок ≈ ключевая − 1,5 (допущение)
    churnL: 15,                        // % портфеля ликвидного в год, уходящий из продукта (допущение)
    avgTermM: 8,                       // средний срок срочного, мес (допущение; за год гасится ~1,5 портфеля)
    rollSmall: 40, rollLarge: 70,      // кейс: удержание при погашении
    largeShare: 70,                    // % денег срочного у крупных клиентов (допущение: у 10% клиентов 70% денег)
    toLiquid: 5,                       // % непереложенных денег, оставшихся в ликвидном (допущение)
    issueMonths: 10,                   // кейс: ~2 мес в году без выпусков
    mmfShare: 30, groupShare: 50,      // состав срочного (кейс)
    thirdCap: 8,                       // ёмкость рынка сторонних рейтинговых облигаций для продукта, у.е. (допущение)
    termShare: 40,                     // доля новых денег, идущих в срочный (калибровка: срочный теряет ~60% в год на погашениях, но вырос до 25)
    spill: 60,                         // % неудовлетворённого спроса на срочный, уходящий в ликвидный (допущение)
    inflow: { base: 50, depTrig: 0, mgr: 0, appTrig: 0, biz: 0, uhnwi: 0 }, // у.е./год при полном разгоне
    ramp: { base: 0, depTrig: 3, mgr: 9, appTrig: 6, biz: 9, uhnwi: 6 },   // мес до полного эффекта
    cac: { base: 1.1, depTrig: 0.2, mgr: 0.5, appTrig: 0.3, biz: 0.5, uhnwi: 0.3 }, // % от привлечённых денег
    fixedCost: [0.35, 0.35],           // команда + ИТ, у.е./год (допущение: из 0,9 → 0,35 пост., 0,55 привлечение)
    feeL: 1.0, feeT: 1.5,
    shock: null,                       // стресс-событие
  };

  // Рычаги плана в порядке приоритета (для моста 100 → 300)
  const LEVERS = [
    {
      key: 'funding',
      label: 'Непрерывные выпуски срочного, доля группы 50→30%',
      short: 'Выпуски без пауз',
      apply: (p) => { p.issueMonths = 12; p.groupShare = 30; p.thirdCap = 25; p.termShare = 45; },
      cost: 'низкие: календарь с казначейством группы, банк — организатор для сторонних эмитентов',
    },
    {
      key: 'rollover',
      label: 'Удержание при погашении 61→73% + остаток по умолчанию в ликвидный',
      short: 'Удержание при погашении',
      apply: (p) => { p.rollSmall = 50; p.rollLarge = 82.5; p.toLiquid = 30; },
      cost: 'низкие: звонки менеджеров крупным, сценарий погашения в приложении',
    },
    {
      key: 'depTrig',
      label: 'Погашаемые вклады: захват 3→8%',
      short: 'Погашение вклада',
      apply: (p) => { p.inflow.depTrig = 16.7; }, // ~333 у.е. непродлённых вкладов в год × 5 п.п.
      cost: 'низкие: экран в сценарии погашения + пуш',
    },
    {
      key: 'mgr',
      label: 'Менеджеры: мотивация за инкрементальные деньги',
      short: 'Менеджеры',
      apply: (p) => { p.inflow.mgr = 26; },
      cost: 'средние: бонус 0,5% от внешних денег, обучение, скрипты',
    },
    {
      key: 'uhnwi',
      label: 'UHNWI: менеджер каждому + индивидуальные выпуски',
      short: 'UHNWI',
      apply: (p) => { p.inflow.uhnwi = 10; },
      cost: 'низкие: закрепить ~50% UHNWI без менеджера (ресурс Private), выпуски под чек',
    },
    {
      key: 'appTrig',
      label: 'Триггеры в приложении (входящий перевод, зарплата)',
      short: 'Триггеры',
      apply: (p) => { p.inflow.appTrig = 20; },
      cost: 'средние: CRM-сценарии, разработка',
    },
    {
      key: 'biz',
      label: 'Собственники бизнеса: «резерв бизнеса»',
      short: 'Бизнес',
      apply: (p) => { p.inflow.biz = 10; },
      cost: 'средние: совместно с МСБ-блоком',
    },
    {
      key: 'churn',
      label: 'Отток ликвидного 15→12%: мгновенный вывод, понятная доходность',
      short: 'Меньше оттока',
      apply: (p) => { p.churnL = 12; },
      cost: 'средние: ИТ (вывод T+0), коммуникация',
    },
    {
      key: 'bonus',
      label: 'Отказ от массовых бонусов за пополнение',
      short: 'Без бонусов',
      apply: (p) => { p.inflow.base = 45; p.cac.base = 0.6; },
      cost: 'экономия: стоимость привлечения 1,1% → 0,6%',
    },
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function buildPlan() {
    const p = clone(STATUS_QUO);
    LEVERS.forEach((l) => l.apply(p));
    p.name = 'Наш план';
    p.fixedCost = [0.55, 0.6]; // команда до 10 человек + ИТ-доработки (допущение)
    return p;
  }

  // ---------- Состав срочного счёта ----------
  // Доходности активов относительно ключевой ставки K (допущения):
  // паи фонда ДР ≈ K − 0,25; сторонние облигации AA+ ≈ K + 1,0; облигации группы ≈ K + 2,5
  // публичное размещение группы стоит ≈ K + 3,25 (на 0,75 п.п. дороже — середина диапазона 0,5–1 из кейса)
  const ASSET_SPREAD = { mmf: -0.25, third: 1.0, group: 2.5, groupPublic: 3.25 };

  function termComposition(mmfShare, groupShare, K, feeT, depSpread, thirdCap) {
    const a = mmfShare / 100, g = groupShare / 100, b = Math.max(0, 1 - a - g);
    const gross = K + a * ASSET_SPREAD.mmf + b * ASSET_SPREAD.third + g * ASSET_SPREAD.group;
    const client = gross - feeT;
    const deposit = K - depSpread;
    const capGroup = g > 0 ? CASE.groupBondsMax / g : Infinity;
    const capThird = b > 0 ? thirdCap / b : Infinity;
    return {
      mmf: a * 100, third: b * 100, group: g * 100,
      gross, client, deposit, premium: client - deposit,
      cap: Math.min(capGroup, capThird), capGroup, capThird,
      groupSavingPerUnit: ASSET_SPREAD.groupPublic - ASSET_SPREAD.group,
    };
  }

  // Раздел «пирога» на 1 у.е. облигаций группы: публичная ставка − ставка вклада
  function benefitSplit(feeT, depSpread) {
    const pie = ASSET_SPREAD.groupPublic + depSpread; // (K+3,25) − (K−1,5)
    const group = ASSET_SPREAD.groupPublic - ASSET_SPREAD.group;
    const bank = feeT;
    const client = pie - group - bank;
    return { pie, client, bank, group };
  }

  // ---------- Ключевая ставка по месяцам ----------
  function keyRate(p, m) {
    const lin = p.kStart + (p.kEnd - p.kStart) * (m / 24);
    if (!p.fastDrop) return lin;
    const fast = p.kStart - p.fastDrop * Math.min(m, 3) / 3;
    return Math.min(lin, fast);
  }

  // ---------- Месячная симуляция на 24 месяца ----------
  function simulate(pIn) {
    const p = clone(pIn);
    let L = CASE.L0, T = CASE.T0;
    const seg = clone(CASE.segMoney);
    const months = [];
    const gross = { total: 0, byChannel: {}, bySource: {}, bySeg: {} };
    CHANNEL_KEYS.forEach((c) => (gross.byChannel[c] = 0));
    SOURCES.forEach((s) => (gross.bySource[s] = 0));
    SEGMENTS.forEach((s) => (gross.bySeg[s] = 0));
    const years = [0, 1].map(() => ({ revenue: 0, revL: 0, revT: 0, fixed: 0, acq: 0, avgAUM: 0, inflow: 0, yieldIn: 0, outL: 0, outT: 0, matT: 0, rolledT: 0, toLiq: 0, lostDemand: 0, newT: 0 }));
    const comp = termComposition(p.mmfShare, p.groupShare, p.kStart, p.feeT, p.depSpread, p.thirdCap);
    const cap = comp.cap;
    const rollover = (p.largeShare * p.rollLarge + (100 - p.largeShare) * p.rollSmall) / 100;
    let termLoss = 0;

    for (let m = 1; m <= 24; m++) {
      const y = m <= 12 ? 0 : 1;
      const K = keyRate(p, m - 0.5);
      const sh = p.shock && m >= p.shock.month && m < p.shock.month + p.shock.duration ? p.shock : null;
      const churn = p.churnL + (sh ? sh.churnBoost || 0 : 0);
      const inflowMult = sh ? (sh.inflowMult != null ? sh.inflowMult : 1) : 1;
      const total0 = L + T;

      // 1) доходность капитализируется
      const yL = L * (K - p.liqSpread) / 1200;
      const yT = T * (K - p.depSpread + comp.premium) / 1200;
      L += yL; T += yT;

      // 2) отток из ликвидного
      const outL = L * churn / 1200;
      L -= outL;

      // 3) погашения срочного
      const issueOpen = ((m - 1) % 12) < p.issueMonths;
      const mat = T / p.avgTermM;
      T -= mat;
      const rolled = issueOpen ? mat * rollover / 100 : 0;
      const notRolled = mat - rolled;
      T += rolled;
      L += notRolled * p.toLiquid / 100;
      const outT = notRolled * (1 - p.toLiquid / 100);

      // разовый стресс: потери в срочном счёте
      if (p.shock && m === p.shock.month && p.shock.termLossPct) {
        termLoss = T * p.shock.termLossPct / 100;
        T -= termLoss;
      }

      // 4) новые деньги по каналам
      let G = 0;
      const gSeg = {}; SEGMENTS.forEach((s) => (gSeg[s] = 0));
      CHANNEL_KEYS.forEach((c) => {
        const r = p.ramp[c] ? Math.min(1, m / p.ramp[c]) : 1;
        const g = (p.inflow[c] || 0) * r * inflowMult / 12;
        if (g <= 0) return;
        G += g;
        gross.byChannel[c] += g;
        SOURCES.forEach((s) => (gross.bySource[s] += g * CHANNELS[c].src[s]));
        SEGMENTS.forEach((s) => { gSeg[s] += g * CHANNELS[c].seg[s]; gross.bySeg[s] += g * CHANNELS[c].seg[s]; });
        years[y].acq += g * p.cac[c] / 100;
      });
      gross.total += G;
      const termDemand = issueOpen ? G * p.termShare / 100 : 0;
      const termRoom = Math.max(0, cap - T);
      const termNew = Math.min(termDemand, termRoom);
      const unmet = G * p.termShare / 100 - termNew;
      T += termNew;
      L += G * (1 - p.termShare / 100) + unmet * p.spill / 100;
      const lostDemand = unmet * (1 - p.spill / 100);

      // сегменты: органическое изменение пропорционально, новые деньги — по каналам
      const total1 = L + T;
      const organic = total1 - (G - lostDemand) - total0; // всё, кроме новых денег
      SEGMENTS.forEach((s) => {
        seg[s] += seg[s] / total0 * organic + gSeg[s] / (G || 1) * (G - lostDemand);
      });

      // 5) экономика
      const revL = L * p.feeL / 1200, revT = T * p.feeT / 1200;
      years[y].revL += revL; years[y].revT += revT;
      years[y].revenue += revL + revT;
      years[y].fixed += p.fixedCost[y] / 12;
      years[y].avgAUM += (L + T) / 12;
      years[y].inflow += G;
      years[y].yieldIn += yL + yT;
      years[y].outL += outL; years[y].outT += outT;
      years[y].matT += mat; years[y].rolledT += rolled; years[y].toLiq += notRolled * p.toLiquid / 100;
      years[y].lostDemand += lostDemand; years[y].newT += termNew;

      months.push({ m, K, L, T, total: L + T, issueOpen });
    }

    years.forEach((yr) => {
      yr.cost = yr.fixed + yr.acq;
      yr.profit = yr.revenue - yr.cost;
      yr.margin = yr.profit / yr.avgAUM * 100;      // чистая маржа, % от среднего портфеля
      yr.revMargin = yr.revenue / yr.avgAUM * 100;
      yr.ci = yr.cost / yr.revenue * 100;
    });

    const end = months[23];
    const y1 = months[11];
    return {
      params: p, months, years, gross, seg, termCap: cap, rollover, comp, termLoss,
      end: { L: end.L, T: end.T, total: end.total },
      y1: { L: y1.L, T: y1.T, total: y1.total },
      runRate: {
        revenue: end.L * p.feeL / 100 + end.T * p.feeT / 100,
      },
    };
  }

  // ---------- Мост 100 → итог по рычагам (накопительно, в порядке LEVERS) ----------
  function bridge(enabled) {
    const on = enabled || LEVERS.map((l) => l.key);
    const p = clone(STATUS_QUO);
    const base = simulate(p);
    const steps = [{ key: 'start', label: 'Сейчас', value: CASE.L0 + CASE.T0 }];
    steps.push({ key: 'sq', label: 'Статус-кво за 2 года', value: base.end.total - 100 });
    let prev = base.end.total;
    LEVERS.forEach((l) => {
      if (!on.includes(l.key)) return;
      l.apply(p);
      const r = simulate(p);
      steps.push({ key: l.key, label: l.label, short: l.short, value: r.end.total - prev, cost: l.cost });
      prev = r.end.total;
    });
    steps.push({ key: 'end', label: 'Итог', value: prev });
    return steps;
  }

  // ---------- Переток со вкладов: эффект на доход банка ----------
  // На 1 у.е., перешедшую со вклада. ASV и ФОР — упрощённые допущения.
  const DEP = { asv: 0.4, forRatio: 4, replacePremium: 0.5, excessPlacement: 0 };
  function cannibalization(K, feeMix, depSpread, shareNeedFunding) {
    const depAllIn = K - depSpread + DEP.asv + DEP.forRatio / 100 * K;   // полная стоимость вклада для банка
    const lostNeed = (K + DEP.replacePremium) - depAllIn;                // заменить рыночным фондированием
    const lostExcess = (K + DEP.excessPlacement) - depAllIn;             // разместить негде, кроме ЦБ/ОФЗ под ≈K
    const lostActive = shareNeedFunding / 100 * lostNeed + (1 - shareNeedFunding / 100) * lostExcess;
    return {
      depAllIn, feeMix,
      scenarios: [
        { key: 'naive', label: 'В лоб: теряем всю маржу вклада 2%', lost: CASE.depMargin, net: feeMix - CASE.depMargin },
        { key: 'need', label: 'Банку нужны деньги: замещаем рынком (+0,5 п.п. к ключевой)', lost: lostNeed, net: feeMix - lostNeed },
        { key: 'excess', label: 'Банку некуда разместить: маргинальный вклад ≈ ставка ЦБ', lost: lostExcess, net: feeMix - lostExcess },
        { key: 'leave', label: 'Деньги ушли бы из банка всё равно', lost: 0, net: feeMix },
      ],
      lostActive,
    };
  }

  function cannibalizationPortfolio(sim, shareNeedFunding) {
    const p = sim.params;
    const yr = sim.years[1];
    const feeMix = yr.revenue / yr.avgAUM * 100;
    const K = keyRate(p, 18);
    const c = cannibalization(K, feeMix, p.depSpread, shareNeedFunding);
    // упрощение: доля портфеля по источнику ≈ доля в валовом притоке за 2 года
    const gt = sim.gross.total || 1;
    const sh = {}; SOURCES.forEach((s) => (sh[s] = sim.gross.bySource[s] / gt));
    const newMoney = sim.end.total - 100 > 0 ? sim.end.total - 100 : 0;
    const active = newMoney * sh.depActive, nonRenew = newMoney * sh.depNonRenew;
    const naive = (active + nonRenew) * (feeMix - CASE.depMargin) / 100;
    const fair = (active * (feeMix - c.lostActive) + nonRenew * feeMix) / 100;
    // эффект для банка целиком = прибыль направления − упущенная ценность вкладов
    const bankNaive = yr.profit - (active + nonRenew) * CASE.depMargin / 100;
    const bankFair = yr.profit - active * c.lostActive / 100;
    return { ...c, shares: sh, newMoney, active, nonRenew, naive, fair, bankNaive, bankFair, profit: yr.profit };
  }

  // ---------- Волна погашения через 2 месяца ----------
  function wave(p) {
    const vol = CASE.T0 * 0.2;
    const r = (p.largeShare * p.rollLarge + (100 - p.largeShare) * p.rollSmall) / 100;
    const kept = vol * r / 100 + vol * (1 - r / 100) * p.toLiquid / 100;
    return { vol, rollover: r, kept, lost: vol - kept };
  }

  // ---------- Размер выборки для A/B (две доли, α=5% двусторонний, мощность 80%) ----------
  function sampleSize(p1, p2) {
    const za = 1.96, zb = 0.8416;
    const pb = (p1 + p2) / 2;
    const n = Math.pow(za * Math.sqrt(2 * pb * (1 - pb)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) / Math.pow(p2 - p1, 2);
    return Math.ceil(n);
  }

  // ---------- Воронка ----------
  function funnel(steps) { return steps.reduce((a, s) => a * s / 100, 100); }

  // ---------- Пресеты ----------
  function presets() {
    const plan = buildPlan();
    const mk = (name, f) => { const p = clone(plan); p.name = name; f(p); return p; };
    return {
      statusQuo: clone(STATUS_QUO),
      plan,
      rateDrop: mk('Стресс: ставка −4 п.п. за квартал', (p) => {
        p.fastDrop = 4; p.kEnd = 9;
        p.shock = { month: 1, duration: 6, churnBoost: 10, inflowMult: 0.85 };
        p.termShare = 55;       // клиенты хотят зафиксировать ставку
        p.issueMonths = 9;      // группа откладывает займы в ожидании дешёвых денег
        p.rollSmall -= 5; p.rollLarge -= 5;
      }),
      competitor: mk('Стресс: конкурент +1 п.п.', (p) => {
        p.shock = { month: 1, duration: 24, churnBoost: 6, inflowMult: 0.8 };
        p.feeL = 0.9;           // точечная скидка по комиссии крупным клиентам под угрозой ухода
      }),
      issuer: mk('Стресс: проблемы у эмитента', (p) => {
        p.shock = { month: 6, duration: 6, churnBoost: 15, inflowMult: 0.7, termLossPct: 5 };
      }),
      tax: mk('Стресс: налоги в пользу вкладов', (p) => {
        p.shock = { month: 6, duration: 19, churnBoost: 3, inflowMult: 0.85 };
      }),
    };
  }

  return {
    CASE, CHANNELS, CHANNEL_KEYS, SEGMENTS, SEG_LABEL, SOURCES, SRC_LABEL, LEVERS, STATUS_QUO, ASSET_SPREAD, DEP,
    clone, buildPlan, simulate, bridge, termComposition, benefitSplit, cannibalization, cannibalizationPortfolio,
    wave, sampleSize, funnel, keyRate, presets,
  };
});
