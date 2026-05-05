import { state, ALL_WORLDS } from './state.js';
import { fetchAdversaries } from './api.js';

export function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('tabBtn-' + name).classList.add('active');
}

export async function reloadAdversaries() {
  state.ADVERSARIES = await fetchAdversaries();
  renderEnemyList();
}

// ── PARTY SETUP ──────────────────────────────────────────────────────────────
export function setTier(t) {
  state.partyTier = t;
  document.querySelectorAll('.tier-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.tier) === t));
  updateBenchmark();
  updateDifficulty();
}

export function setPlayers(n) {
  state.partyPlayers = parseInt(n);
  document.getElementById('playerDisplay').textContent = state.partyPlayers;
  document.getElementById('playerCount').value = state.partyPlayers;
  syncPCCount();
  updateBenchmark();
  updateDifficulty();
}

// ── PC CONFIG ────────────────────────────────────────────────────────────────
export function syncPCCount() {
  while (state.pcs.length < state.partyPlayers) {
    state.pcs.push({ name:'', tier:state.partyTier, maxHP:0, currentHP:0, maxFocus:0, currentFocus:0, maxInvestiture:0, currentInvestiture:0, physDef:0, cogDef:0, spiDef:0, turnType:null, down:false });
  }
  state.pcs = state.pcs.slice(0, state.partyPlayers);
  renderPCList();
}

export function renderPCList() {
  const el = document.getElementById('pcList');
  if (!state.pcs.length) { el.innerHTML = ''; return; }
  el.innerHTML = state.pcs.map((p, i) => `
    <div class="pc-config-row">
      <span class="pc-num">${i + 1}</span>
      <input class="pc-input" type="text" placeholder="Name" value="${p.name.replace(/"/g, '&quot;')}"
        oninput="pcs[${i}].name=this.value">
      <select class="pc-input" onchange="pcs[${i}].tier=parseInt(this.value);updateBenchmark();updateDifficulty()">
        ${[1,2,3,4].map(t => `<option value="${t}"${p.tier===t?' selected':''}>${t}</option>`).join('')}
      </select>
      <input class="pc-input" type="number" placeholder="HP" min="0" value="${p.maxHP||''}"
        oninput="pcSetStat(${i},'maxHP',parseInt(this.value)||0)">
      <input class="pc-input" type="number" placeholder="Foc" min="0" value="${p.maxFocus||''}"
        oninput="pcSetStat(${i},'maxFocus',parseInt(this.value)||0)">
      <input class="pc-input pc-col-inv" type="number" placeholder="Inv" min="0" value="${p.maxInvestiture||''}"
        oninput="pcSetStat(${i},'maxInvestiture',parseInt(this.value)||0)">
    </div>
    <div class="pc-def-row">
      <span class="pc-def-label">Phys Def</span>
      <input class="pc-input" type="number" style="width:48px" placeholder="—" min="0" value="${p.physDef||''}"
        oninput="pcs[${i}].physDef=parseInt(this.value)||0">
      <span class="pc-def-label">Cog</span>
      <input class="pc-input" type="number" style="width:48px" placeholder="—" min="0" value="${p.cogDef||''}"
        oninput="pcs[${i}].cogDef=parseInt(this.value)||0">
      <span class="pc-def-label">Spi</span>
      <input class="pc-input" type="number" style="width:48px" placeholder="—" min="0" value="${p.spiDef||''}"
        oninput="pcs[${i}].spiDef=parseInt(this.value)||0">
    </div>`).join('');
}

export function pcSetStat(i, field, val) {
  state.pcs[i][field] = val;
  if (field === 'maxHP')          state.pcs[i].currentHP = val;
  if (field === 'maxFocus')       state.pcs[i].currentFocus = val;
  if (field === 'maxInvestiture') state.pcs[i].currentInvestiture = val;
  updateBenchmark();
  updateDifficulty();
}

export function usingActualHP() {
  return state.pcs.length === state.partyPlayers && state.pcs.every(p => p.maxHP > 0);
}

export function getEffectivePCHPAvg() {
  if (usingActualHP()) return state.pcs.reduce((s, p) => s + p.maxHP, 0) / state.partyPlayers;
  const hp = state.PC_HP[String(state.partyTier)];
  return (hp.min + hp.max) / 2;
}

// ── BENCHMARK ────────────────────────────────────────────────────────────────
export function updateBenchmark() {
  const tk = String(state.partyTier), pk = String(state.partyPlayers);
  if (!state.PC_DPR_ROUNDS[tk]) return;
  const rounds = state.PC_DPR_ROUNDS[tk][pk], bench = state.BOSS_BENCHMARK[tk];
  const el = document.getElementById('benchmarkInfo');
  if (!rounds) {
    el.innerHTML = `<span>Benchmark:</span> Tier ${state.partyTier} Boss (${bench.hp} HP) — not survivable with ${state.partyPlayers} player(s)`;
    return;
  }
  const partyDPR = (bench.hp / rounds).toFixed(1);
  let hpLine;
  if (usingActualHP()) {
    const total = state.pcs.reduce((s, p) => s + p.maxHP, 0);
    hpLine = `<br><span>Party HP (actual):</span> ${state.pcs.map(p => p.maxHP).join(' / ')} · <b>${total}</b> total`;
  } else {
    const hp = state.PC_HP[tk];
    hpLine = `<br><span>Party HP:</span> ${hp.min}–${hp.max} per PC · ${state.partyPlayers*hp.min}–${state.partyPlayers*hp.max} total`;
  }
  el.innerHTML = `<span>Benchmark (Medium):</span> Tier ${state.partyTier} Boss · ${bench.hp} HP · ${rounds} rds · ~${partyDPR} party DPR/rnd${hpLine}`;
}

// ── ENEMY LIST ───────────────────────────────────────────────────────────────
export function updateWorldDropdown() {
  const enabled = getEnabledWorlds();
  const worlds = [...new Set(state.ADVERSARIES.map(a => a.World))].filter(w => enabled.has(w)).sort();
  const sel = document.getElementById('filterWorld'), cur = sel.value;
  sel.innerHTML = '<option value="">All Worlds</option>' + worlds.map(w => `<option value="${w}"${w===cur?' selected':''}>${w}</option>`).join('');
}

function getFiltered() {
  const enabled = getEnabledWorlds();
  const world = document.getElementById('filterWorld').value,
        type  = document.getElementById('filterType').value,
        tier  = document.getElementById('filterTier').value,
        q     = document.getElementById('searchBox').value.toLowerCase();
  return state.ADVERSARIES.filter(a => {
    if (!enabled.has(a.World)) return false;
    if (world && a.World !== world) return false;
    if (type  && a.Type  !== type)  return false;
    if (tier  && a.Tier  !== parseInt(tier)) return false;
    if (q && !a['Adversary Name'].toLowerCase().includes(q)) return false;
    return true;
  });
}

export function renderEnemyList() {
  const filtered = getFiltered(), el = document.getElementById('enemyList');
  if (!filtered.length) { el.innerHTML = '<div class="no-results">No adversaries match.</div>'; return; }
  el.innerHTML = filtered.map(a => {
    const idx = state.ADVERSARIES.indexOf(a);
    const qty = state.encounter.get(idx) || 0;
    const allyQty = state.encounterAllies.get(idx) || 0;
    return `<div class="enemy-row">
      <div><div class="enemy-name">${a['Adversary Name']}</div><div class="enemy-meta">Tier ${a.Tier} · ${a.World}</div></div>
      <span class="type-badge type-${a.Type}">${a.Type}</span>
      <div class="stat-pill">HP <span>${a.Health}</span></div>
      <div class="stat-pill">DPR <span>${a['DPR (Fast)']}</span></div>
      ${qty > 0 ? `<span class="enemy-count-tag">×${qty}</span>` : '<span style="width:28px"></span>'}
      ${allyQty > 0 ? `<span class="enemy-count-tag" style="color:var(--easy);border-color:var(--easy)">A×${allyQty}</span>` : '<span style="width:28px"></span>'}
      <button class="add-btn" onclick="addEnemy(${idx})" title="Add as Enemy">+</button>
      <button class="add-btn" onclick="addAlly(${idx})" title="Add as Ally" style="color:var(--easy);border-color:var(--easy)">A</button>
    </div>`;
  }).join('');
}

export function addEnemy(idx) { state.encounter.set(idx, (state.encounter.get(idx) || 0) + 1); renderEnemyList(); renderEncounter(); updateDifficulty(); }
export function addAlly(idx)  { state.encounterAllies.set(idx, (state.encounterAllies.get(idx) || 0) + 1); renderEnemyList(); renderEncounter(); updateDifficulty(); }

// ── ENCOUNTER ────────────────────────────────────────────────────────────────
export function removeEnemy(idx) { state.encounter.delete(idx); renderEnemyList(); renderEncounter(); updateDifficulty(); }
export function removeAlly(idx)  {
  state.encounterAllies.delete(idx);
  state.encounterAllyInvestiture.delete(idx);
  state.encounterAllyInvEditing.delete(idx);
  renderEnemyList(); renderEncounter(); updateDifficulty();
}
export function changeQty(idx, delta) {
  const n = (state.encounter.get(idx) || 0) + delta;
  if (n <= 0) removeEnemy(idx);
  else { state.encounter.set(idx, n); renderEnemyList(); renderEncounter(); updateDifficulty(); }
}
export function changeAllyQty(idx, delta) {
  const n = (state.encounterAllies.get(idx) || 0) + delta;
  if (n <= 0) removeAlly(idx);
  else { state.encounterAllies.set(idx, n); renderEnemyList(); renderEncounter(); updateDifficulty(); }
}
export function clearEncounter() {
  state.encounter.clear();
  state.encounterInvestiture.clear();
  state.encounterInvEditing.clear();
  state.encounterAllies.clear();
  state.encounterAllyInvestiture.clear();
  state.encounterAllyInvEditing.clear();
  renderEnemyList(); renderEncounter(); updateDifficulty();
}

export function renderEncounter() {
  const listEl = document.getElementById('encounterList'),
        totalsEl = document.getElementById('encounterTotals'),
        startBtn = document.getElementById('startCombatBtn');
  const hasAny = state.encounter.size > 0 || state.encounterAllies.size > 0;
  if (!hasAny) {
    listEl.innerHTML = '<div class="encounter-empty">Add enemies from the list on the left.</div>';
    totalsEl.style.display = 'none';
    startBtn.style.display = 'none';
    return;
  }
  let totalHP = 0, totalDPRFast = 0, totalDPRSlow = 0, totalCount = 0, rows = '';
  for (const [idx, qty] of state.encounter) {
    const a = state.ADVERSARIES[idx];
    totalHP += a.Health * qty; totalDPRFast += a['DPR (Fast)'] * qty; totalDPRSlow += a['DPR (Slow)'] * qty; totalCount += qty;
    const invOverride = state.encounterInvestiture.get(idx);
    let invCell = '';
    if (a.Investiture === 0) {
      if (invOverride != null) {
        invCell = `<div class="stat-pill" style="display:flex;align-items:center;gap:3px">Inv <span>${invOverride}</span><button onclick="clearEncInv(${idx})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0 2px;line-height:1" title="Remove">×</button></div>`;
      } else if (state.encounterInvEditing.has(idx)) {
        invCell = `<div style="display:flex;align-items:center;gap:3px"><input type="number" id="enc-inv-${idx}" class="cc-adj-input" min="1" placeholder="Inv" style="width:44px" onkeydown="if(event.key==='Enter')setEncInv(${idx})"><button class="cc-btn" onclick="setEncInv(${idx})">✓</button><button class="cc-btn" onclick="toggleEncInvInput(${idx})">×</button></div>`;
      } else {
        invCell = `<button class="cc-btn" style="font-size:10px;padding:2px 5px;white-space:nowrap" onclick="toggleEncInvInput(${idx})">+ Inv</button>`;
      }
    }
    rows += `<div class="encounter-item" style="grid-template-columns:auto 1fr auto auto auto auto">
      <div class="qty-controls"><button class="qty-btn" onclick="changeQty(${idx},-1)">-</button><span class="qty-num">${qty}</span><button class="qty-btn" onclick="changeQty(${idx},+1)">+</button></div>
      <div><div class="enemy-name">${a['Adversary Name']}</div><div class="enemy-meta"><span class="type-badge type-${a.Type}">${a.Type}</span> T${a.Tier} ${a.World}</div></div>
      <div class="stat-pill">HP <span>${a.Health*qty}</span></div>
      <div class="stat-pill">DPR <span>${a['DPR (Fast)']*qty}</span></div>
      ${invCell}
      <button class="remove-btn" onclick="removeEnemy(${idx})">×</button>
    </div>`;
  }
  if (state.encounterAllies.size > 0) {
    rows += `<div style="font-size:10px;font-weight:700;color:var(--easy);text-transform:uppercase;letter-spacing:1px;padding:8px 10px 4px;border-top:1px solid var(--border);margin-top:2px">Friendly NPCs</div>`;
    for (const [idx, qty] of state.encounterAllies) {
      const a = state.ADVERSARIES[idx];
      const invOverride = state.encounterAllyInvestiture.get(idx);
      let invCell = '';
      if (a.Investiture === 0) {
        if (invOverride != null) {
          invCell = `<div class="stat-pill" style="display:flex;align-items:center;gap:3px">Inv <span>${invOverride}</span><button onclick="clearAllyEncInv(${idx})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0 2px;line-height:1" title="Remove">×</button></div>`;
        } else if (state.encounterAllyInvEditing.has(idx)) {
          invCell = `<div style="display:flex;align-items:center;gap:3px"><input type="number" id="enc-ally-inv-${idx}" class="cc-adj-input" min="1" placeholder="Inv" style="width:44px" onkeydown="if(event.key==='Enter')setAllyEncInv(${idx})"><button class="cc-btn" onclick="setAllyEncInv(${idx})">✓</button><button class="cc-btn" onclick="toggleAllyEncInvInput(${idx})">×</button></div>`;
        } else {
          invCell = `<button class="cc-btn" style="font-size:10px;padding:2px 5px;white-space:nowrap" onclick="toggleAllyEncInvInput(${idx})">+ Inv</button>`;
        }
      }
      rows += `<div class="encounter-item" style="grid-template-columns:auto 1fr auto auto auto auto;border-left:2px solid var(--easy)">
        <div class="qty-controls"><button class="qty-btn" onclick="changeAllyQty(${idx},-1)">-</button><span class="qty-num">${qty}</span><button class="qty-btn" onclick="changeAllyQty(${idx},+1)">+</button></div>
        <div><div class="enemy-name">${a['Adversary Name']}</div><div class="enemy-meta"><span style="color:var(--easy);font-weight:700;font-size:10px">Ally</span> · <span class="type-badge type-${a.Type}">${a.Type}</span> T${a.Tier} ${a.World}</div></div>
        <div class="stat-pill">HP <span>${a.Health*qty}</span></div>
        <div class="stat-pill">DPR <span>${a['DPR (Fast)']*qty}</span></div>
        ${invCell}
        <button class="remove-btn" onclick="removeAlly(${idx})">×</button>
      </div>`;
    }
  }
  listEl.innerHTML = rows;
  totalsEl.style.display = 'block';
  startBtn.style.display = 'inline-block';
  document.getElementById('totalHP').textContent = totalHP;
  document.getElementById('totalDPR').textContent = totalDPRFast;
  document.getElementById('totalDPRSlow').textContent = totalDPRSlow;
  document.getElementById('enemyCount').textContent = totalCount;
}

export function toggleEncInvInput(idx) {
  if (state.encounterInvEditing.has(idx)) state.encounterInvEditing.delete(idx);
  else state.encounterInvEditing.add(idx);
  renderEncounter();
}
export function setEncInv(idx) {
  const val = parseInt(document.getElementById('enc-inv-' + idx).value) || 0;
  if (val > 0) { state.encounterInvestiture.set(idx, val); state.encounterInvEditing.delete(idx); }
  renderEncounter();
}
export function clearEncInv(idx) {
  state.encounterInvestiture.delete(idx);
  state.encounterInvEditing.delete(idx);
  renderEncounter();
}
export function toggleAllyEncInvInput(idx) {
  if (state.encounterAllyInvEditing.has(idx)) state.encounterAllyInvEditing.delete(idx);
  else state.encounterAllyInvEditing.add(idx);
  renderEncounter();
}
export function setAllyEncInv(idx) {
  const val = parseInt(document.getElementById('enc-ally-inv-' + idx).value) || 0;
  if (val > 0) { state.encounterAllyInvestiture.set(idx, val); state.encounterAllyInvEditing.delete(idx); }
  renderEncounter();
}
export function clearAllyEncInv(idx) {
  state.encounterAllyInvestiture.delete(idx);
  state.encounterAllyInvEditing.delete(idx);
  renderEncounter();
}

// ── DIFFICULTY ───────────────────────────────────────────────────────────────
function computeEncounterThreat() {
  const BASE = { Minion:0.5, Rival:1.0, Boss:4.0 };
  let total = 0;
  for (const [idx, qty] of state.encounter) {
    const a = state.ADVERSARIES[idx];
    const base = BASE[a.Type] ?? 1.0;
    const tierDelta = (a.Tier || state.partyTier) - state.partyTier;
    const scaled = Math.round(base * Math.pow(2, tierDelta) * 4) / 4;
    total += scaled * qty;
  }
  return Math.round(total * 10000) / 10000;
}

function computeAllyThreat() {
  const BASE = { Minion:0.5, Rival:1.0, Boss:4.0 };
  let total = 0;
  for (const [idx, qty] of state.encounterAllies) {
    const a = state.ADVERSARIES[idx];
    const base = BASE[a.Type] ?? 1.0;
    const tierDelta = (a.Tier || state.partyTier) - state.partyTier;
    const scaled = Math.round(base * Math.pow(2, tierDelta) * 4) / 4;
    total += scaled * qty;
  }
  return Math.round(total * 10000) / 10000;
}

function getThreatRating(total, numPCs) {
  if (total < 0.5 * numPCs) return 'Trivial';
  if (total < 1.0 * numPCs) return 'Easy';
  if (total < 1.5 * numPCs) return 'Medium';
  if (total < 2.0 * numPCs) return 'Hard';
  return 'Deadly';
}

export function updateDifficulty() {
  const el = document.getElementById('difficultyOutput');
  if (state.encounter.size === 0 && state.encounterAllies.size === 0) {
    el.innerHTML = '<div class="difficulty-empty">Add enemies to see difficulty.</div>'; return;
  }
  if (state.encounter.size === 0) {
    el.innerHTML = '<div class="difficulty-empty">Add enemies to calculate difficulty.</div>'; return;
  }

  const totalThreat = computeEncounterThreat();
  const allyThreat  = computeAllyThreat();
  const netThreat   = Math.max(0, totalThreat - allyThreat);
  const thrEasy = 0.5 * state.partyPlayers, thrMed = 1.0 * state.partyPlayers,
        thrHard = 1.5 * state.partyPlayers, thrDeadly = 2.0 * state.partyPlayers;
  const threatRating = getThreatRating(netThreat, state.partyPlayers);

  let icon, cls;
  if      (threatRating === 'Trivial') { icon = '💤'; cls = 'diff-trivial'; }
  else if (threatRating === 'Easy')    { icon = '🌱'; cls = 'diff-easy'; }
  else if (threatRating === 'Medium')  { icon = '⚔️';  cls = 'diff-medium'; }
  else if (threatRating === 'Hard')    { icon = '🔥'; cls = 'diff-hard'; }
  else                                  { icon = '💀'; cls = 'diff-deadly'; }

  const barMax = Math.max(thrDeadly, netThreat);
  const threatPct = Math.min(netThreat / barMax * 100, 100);
  const easyPct = thrEasy / barMax * 100, medPct = thrMed / barMax * 100, hardPct = thrHard / barMax * 100;
  const threatBarColor = cls==='diff-trivial'?'var(--trivial)':cls==='diff-easy'?'var(--easy)':cls==='diff-medium'?'var(--medium)':cls==='diff-hard'?'var(--hard)':'var(--deadly)';

  const tk = String(state.partyTier), pk = String(state.partyPlayers);
  const benchRounds = state.PC_DPR_ROUNDS[tk]?.[pk], bench = state.BOSS_BENCHMARK[tk], pcHP = state.PC_HP[tk];
  let analysisHTML = '';
  if (benchRounds) {
    let totalHP = 0, totalDPRFast = 0;
    for (const [idx, qty] of state.encounter) { const a = state.ADVERSARIES[idx]; totalHP += a.Health * qty; totalDPRFast += a['DPR (Fast)'] * qty; }
    let allyTotalHP = 0, allyTotalDPR = 0, allyCount = 0;
    for (const [idx, qty] of state.encounterAllies) { const a = state.ADVERSARIES[idx]; allyTotalHP += a.Health * qty; allyTotalDPR += a['DPR (Fast)'] * qty; allyCount += qty; }
    const partyDPR = bench.hp / benchRounds;
    const effectivePartyDPR = partyDPR + allyTotalDPR;
    const estRounds = Math.ceil(totalHP / effectivePartyDPR);
    const hpRatio = totalHP / bench.hp, dprRatio = totalDPRFast / bench.dpr_fast;
    const actual = usingActualHP(), pcHPAvg = getEffectivePCHPAvg();
    const partyHPAvg = state.partyPlayers * pcHPAvg + allyTotalHP;
    const damageThreat = (totalDPRFast * estRounds) / partyHPAvg;
    const benchRounds4p = state.PC_DPR_ROUNDS[tk]['4'];
    const dtCalibration = bench.dpr_fast * benchRounds4p / (4 * pcHPAvg);
    const adjDamageThreat = damageThreat / dtCalibration;
    const hpBarPct = Math.min(hpRatio / 2 * 100, 100), dprBarPct = Math.min(dprRatio / 2 * 100, 100), dmgBarPct = Math.min(damageThreat / 2.5 * 100, 100);
    const hpColor    = hpRatio <= 1 ? 'var(--easy)' : hpRatio <= 1.5 ? 'var(--hard)' : 'var(--deadly)';
    const dprColor   = dprRatio <= 1 ? 'var(--medium)' : dprRatio <= 1.5 ? 'var(--hard)' : 'var(--deadly)';
    const threatColor = adjDamageThreat <= 0.6 ? 'var(--easy)' : adjDamageThreat <= 1.2 ? 'var(--medium)' : adjDamageThreat <= 2 ? 'var(--hard)' : 'var(--deadly)';
    const hpValDisplay = actual ? `${Math.round(state.partyPlayers * pcHPAvg)}` : `${state.partyPlayers*pcHP.min}–${state.partyPlayers*pcHP.max}`;
    const hpSubDisplay = actual ? `${Math.round(pcHPAvg)} avg per PC <span class="actual-badge">actual</span>` : `${pcHP.min}–${pcHP.max} per PC · Tier ${state.partyTier}`;
    const allyNote = allyCount > 0 ? `<div class="note-box" style="margin-top:8px;border-color:var(--easy)">Includes <strong style="color:var(--easy)">${allyCount} friendly NPC${allyCount > 1 ? 's' : ''}</strong>: +${allyTotalHP} HP, +${allyTotalDPR} DPR on your side.</div>` : '';
    analysisHTML = `
      <div class="analysis-header">Combat Analysis</div>
      <div class="diff-stats">
        <div class="diff-stat-card"><div class="diff-stat-label">Est. Rounds to Clear</div><div class="diff-stat-value">${estRounds}</div><div class="diff-stat-sub">Benchmark: ${benchRounds} rds</div></div>
        <div class="diff-stat-card"><div class="diff-stat-label">Damage Threat</div><div class="diff-stat-value" style="color:${threatColor}">${Math.round(damageThreat*100)}%</div><div class="diff-stat-sub">total dmg ÷ party HP</div></div>
        <div class="diff-stat-card"><div class="diff-stat-label">Party HP (${state.partyPlayers} PCs${allyCount>0?` +${allyCount} ally`:''})</div><div class="diff-stat-value">${hpValDisplay}${allyCount>0?`<span style="color:var(--easy);font-size:13px"> +${allyTotalHP}</span>`:''}</div><div class="diff-stat-sub">${hpSubDisplay}</div></div>
        <div class="diff-stat-card"><div class="diff-stat-label">DPR Pressure</div><div class="diff-stat-value">${Math.round(dprRatio*100)}%</div><div class="diff-stat-sub">vs ${bench.dpr_fast} DPR standard boss</div></div>
      </div>
      <div class="bar-section"><div class="bar-label">Enemy HP Load <span>${totalHP} HP vs ${bench.hp} benchmark</span></div><div class="bar-track"><div class="bar-fill" style="width:${hpBarPct}%;background:${hpColor}"></div><div class="bar-benchmark-marker" style="left:50%"></div></div></div>
      <div class="bar-section"><div class="bar-label">Enemy DPR Pressure <span>${totalDPRFast} DPR vs ${bench.dpr_fast} benchmark</span></div><div class="bar-track"><div class="bar-fill" style="width:${dprBarPct}%;background:${dprColor}"></div><div class="bar-benchmark-marker" style="left:50%"></div></div></div>
      <div class="bar-section"><div class="bar-label">Damage Threat <span>${Math.round(damageThreat*100)}% of ${Math.round(partyHPAvg)} effective party HP</span></div><div class="bar-track"><div class="bar-fill" style="width:${dmgBarPct}%;background:${threatColor}"></div><div class="bar-benchmark-marker" style="left:40%"></div></div></div>
      <div class="note-box">${actual ? 'Using <strong>actual PC HP</strong> from Party Members.' : `Using formula range (Tier ${state.partyTier}, STR 0→9).`}</div>
      ${allyNote}`;
  }

  const allyThreatLine = allyThreat > 0 ? ` − <span style="color:var(--easy)">${allyThreat%1===0?allyThreat:allyThreat.toFixed(2)} ally</span> = <strong>${netThreat%1===0?netThreat:netThreat.toFixed(2)} net</strong>` : '';
  el.innerHTML = `
    <div class="difficulty-rating ${cls}"><span class="rating-icon">${icon}</span><span class="rating-label">${threatRating}</span></div>
    <div class="threat-info-row">
      <span>Enemy Threat: <strong>${totalThreat%1===0?totalThreat:totalThreat.toFixed(2)}</strong>${allyThreatLine}</span>
      <span>Easy ≥${thrEasy} · Medium ≥${thrMed} · Hard ≥${thrHard}</span>
    </div>
    <div class="bar-section">
      <div class="bar-label">Net Threat Load <span>${netThreat%1===0?netThreat:netThreat.toFixed(2)} / ${thrDeadly} Deadly threshold</span></div>
      <div class="bar-track" style="height:10px">
        <div class="bar-fill" style="width:${threatPct}%;background:${threatBarColor}"></div>
        <div class="bar-benchmark-marker" style="left:${easyPct}%"></div>
        <div class="bar-benchmark-marker" style="left:${medPct}%"></div>
        <div class="bar-benchmark-marker" style="left:${hardPct}%"></div>
      </div>
      <div style="position:relative;height:16px;margin-top:2px">
        <span style="position:absolute;left:${easyPct}%;transform:translateX(-50%);font-size:10px;color:var(--easy)">Easy</span>
        <span style="position:absolute;left:${medPct}%;transform:translateX(-50%);font-size:10px;color:var(--medium)">Med</span>
        <span style="position:absolute;left:${hardPct}%;transform:translateX(-50%);font-size:10px;color:var(--hard)">Hard</span>
      </div>
    </div>
    ${analysisHTML}`;
}

// ── WORLD VISIBILITY ──────────────────────────────────────────────────────────
export function getEnabledWorlds() {
  const s = localStorage.getItem('enabledWorlds');
  return s ? new Set(JSON.parse(s)) : new Set(ALL_WORLDS);
}

export function saveEnabledWorlds(set) {
  localStorage.setItem('enabledWorlds', JSON.stringify([...set]));
}
