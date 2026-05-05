import { state } from './state.js';

export function startCombat() {
  if (state.encounter.size === 0 && state.encounterAllies.size === 0) return;
  state.combatants = [];
  state.allies = [];
  state.nextCombatId = 0;
  state.combatRound = 1;
  state.combatInvEditing.clear();

  for (const [idx, qty] of state.encounter) {
    const a = state.ADVERSARIES[idx];
    const inv = state.encounterInvestiture.get(idx) ?? a.Investiture;
    for (let i = 1; i <= qty; i++) {
      state.combatants.push({
        id: state.nextCombatId++, adv: a,
        label: qty > 1 ? `${a['Adversary Name']} #${i}` : a['Adversary Name'],
        maxHP: a.Health, currentHP: a.Health,
        maxFocus: a.Focus, currentFocus: a.Focus,
        maxInvestiture: inv, currentInvestiture: inv,
        turnType: null, defeated: false,
      });
    }
  }
  for (const [idx, qty] of state.encounterAllies) {
    const a = state.ADVERSARIES[idx];
    const inv = state.encounterAllyInvestiture.get(idx) ?? a.Investiture;
    for (let i = 1; i <= qty; i++) {
      state.allies.push({
        id: state.nextCombatId++, adv: a,
        label: qty > 1 ? `${a['Adversary Name']} #${i}` : a['Adversary Name'],
        maxHP: a.Health, currentHP: a.Health,
        maxFocus: a.Focus, currentFocus: a.Focus,
        maxInvestiture: inv, currentInvestiture: inv,
        turnType: null, defeated: false,
      });
    }
  }
  state.pcs.forEach(p => {
    p.currentHP = p.maxHP; p.currentFocus = p.maxFocus;
    p.currentInvestiture = p.maxInvestiture; p.turnType = null; p.down = false;
  });
  document.getElementById('combatWrap').classList.add('active');
  renderCombat();
  document.getElementById('combatWrap').scrollIntoView({ behavior: 'smooth' });
}

export function endCombat() {
  document.getElementById('combatWrap').classList.remove('active');
  state.combatants = [];
  state.allies = [];
}

export function nextRound() {
  state.combatRound++;
  state.combatants.forEach(c => { if (!c.defeated) c.turnType = null; });
  state.allies.forEach(c => { if (!c.defeated) c.turnType = null; });
  state.pcs.forEach(p => { if (!p.down) p.turnType = null; });
  renderCombat();
}

export function renderCombat() {
  document.getElementById('combatRound').textContent = state.combatRound;
  const saved = {};
  document.querySelectorAll('[id^="cc-hp-"]').forEach(el => { if (el.value) saved[el.id] = el.value; });

  const hasPCs = state.pcs.some(p => p.maxHP > 0);
  const hasAllies = state.allies.length > 0;
  const pcSec = document.getElementById('combatPCSection');
  pcSec.style.display = (hasPCs || hasAllies) ? 'block' : 'none';
  document.getElementById('combatEnemyLabel').style.marginTop = (hasPCs || hasAllies) ? '' : '0';
  if (hasPCs) document.getElementById('combatPCGrid').innerHTML = state.pcs.filter(p => p.maxHP > 0).map((p, i) => buildPCCard(p, i)).join('');
  const allySec = document.getElementById('combatAllySection');
  allySec.style.display = hasAllies ? 'block' : 'none';
  if (hasAllies) document.getElementById('combatAllyGrid').innerHTML = state.allies.map(c => buildAllyCard(c)).join('');
  document.getElementById('combatGrid').innerHTML = state.combatants.map(c => buildEnemyCard(c)).join('');

  Object.entries(saved).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
}

function buildPCCard(p, i) {
  const hpPct    = p.maxHP          > 0 ? Math.max(0, p.currentHP          / p.maxHP          * 100) : 0;
  const focusPct = p.maxFocus       > 0 ? Math.max(0, p.currentFocus       / p.maxFocus       * 100) : 0;
  const invPct   = p.maxInvestiture > 0 ? Math.max(0, p.currentInvestiture / p.maxInvestiture * 100) : 0;
  const hpColor  = hpPct > 60 ? 'var(--steel)' : hpPct > 25 ? 'var(--medium)' : hpPct > 0 ? 'var(--hard)' : 'var(--deadly)';
  const label = p.name || `PC ${i + 1}`;
  return `<div class="combatant-card pc-card${p.down ? ' down' : ''}">
    <div class="cc-header">
      <div><div class="cc-name">${label}</div><div class="cc-meta">Tier ${p.tier} PC</div></div>
      <div class="cc-turns">
        <button class="turn-btn${p.turnType==='fast'?' turn-fast-active':''}" onclick="pcSetTurn(${i},'fast')">Fast</button>
        <button class="turn-btn${p.turnType==='slow'?' turn-slow-active':''}" onclick="pcSetTurn(${i},'slow')">Slow</button>
      </div>
    </div>
    <div class="cc-resource">
      <div class="cc-res-header"><span class="cc-res-label">HP</span><span class="cc-res-value${p.currentHP<=0?' at-zero':''}">${p.currentHP} / ${p.maxHP}</span></div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="cc-adj-row">
        <input type="number" class="cc-adj-input" id="cc-hp-pc-${i}" placeholder="amt" min="1">
        <button class="cc-btn cc-btn-dmg"  onclick="pcApplyHP(${i},'dmg')">Dmg</button>
        <button class="cc-btn cc-btn-heal" onclick="pcApplyHP(${i},'heal')">Heal</button>
      </div>
    </div>
    ${p.maxFocus > 0 ? `<div class="cc-resource">
      <div class="cc-res-header"><span class="cc-res-label">Focus</span><span class="cc-res-value">${p.currentFocus} / ${p.maxFocus}</span></div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${focusPct}%;background:var(--steel)"></div></div>
      <div class="cc-adj-row">
        <button class="cc-btn" onclick="pcAdjRes(${i},'focus',-2)">-2</button><button class="cc-btn" onclick="pcAdjRes(${i},'focus',-1)">-1</button>
        <button class="cc-btn" onclick="pcAdjRes(${i},'focus', 1)">+1</button><button class="cc-btn" onclick="pcAdjRes(${i},'focus', 5)">+2</button>
      </div></div>` : ''}
    ${p.maxInvestiture > 0 ? `<div class="cc-resource">
      <div class="cc-res-header"><span class="cc-res-label">Investiture</span><span class="cc-res-value">${p.currentInvestiture} / ${p.maxInvestiture}</span></div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${invPct}%;background:var(--gold)"></div></div>
      <div class="cc-adj-row">
        <button class="cc-btn" onclick="pcAdjRes(${i},'investiture',-2)">-2</button><button class="cc-btn" onclick="pcAdjRes(${i},'investiture',-1)">-1</button>
        <button class="cc-btn" onclick="pcAdjRes(${i},'investiture', 1)">+1</button><button class="cc-btn" onclick="pcAdjRes(${i},'investiture', 5)">+2</button>
      </div></div>` : ''}
    ${(p.physDef || p.cogDef || p.spiDef) ? `<div class="cc-stats">
      <div class="cc-stat-row"><span class="cc-stat-key">DEF</span> Phys ${p.physDef} · Cog ${p.cogDef} · Spi ${p.spiDef}</div>
    </div>` : ''}
    <button class="cc-defeat-btn${p.down ? ' cc-revive-btn' : ' cc-down-btn'}" onclick="pcToggleDown(${i})">${p.down ? 'Revive' : 'Down'}</button>
  </div>`;
}

function buildEnemyCard(c) {
  const a = c.adv;
  const hpPct    = c.maxHP          > 0 ? Math.max(0, c.currentHP          / c.maxHP          * 100) : 0;
  const focusPct = c.maxFocus       > 0 ? Math.max(0, c.currentFocus       / c.maxFocus       * 100) : 0;
  const invPct   = c.maxInvestiture > 0 ? Math.max(0, c.currentInvestiture / c.maxInvestiture * 100) : 0;
  const hpColor  = hpPct > 60 ? 'var(--easy)' : hpPct > 25 ? 'var(--medium)' : hpPct > 0 ? 'var(--hard)' : 'var(--deadly)';
  const fastDim = c.turnType === 'slow', slowDim = c.turnType === 'fast';
  return `<div class="combatant-card${c.defeated ? ' defeated' : ''}">
    <div class="cc-header">
      <div><div class="cc-name">${c.label}</div><div class="cc-meta"><span class="type-badge type-${a.Type}">${a.Type}</span> T${a.Tier} · ${a.World}</div></div>
      <div class="cc-turns">
        <button class="turn-btn${c.turnType==='fast'?' turn-fast-active':''}" onclick="setTurn(${c.id},'fast')">Fast</button>
        <button class="turn-btn${c.turnType==='slow'?' turn-slow-active':''}" onclick="setTurn(${c.id},'slow')">Slow</button>
      </div>
    </div>
    <div class="cc-resource">
      <div class="cc-res-header"><span class="cc-res-label">HP</span><span class="cc-res-value${c.currentHP<=0?' at-zero':''}">${c.currentHP} / ${c.maxHP}</span></div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="cc-adj-row">
        <input type="number" class="cc-adj-input" id="cc-hp-${c.id}" placeholder="amt" min="1">
        <button class="cc-btn cc-btn-dmg"  onclick="applyHPAdj(${c.id},'dmg')">Dmg</button>
        <button class="cc-btn cc-btn-heal" onclick="applyHPAdj(${c.id},'heal')">Heal</button>
      </div>
    </div>
    ${c.maxFocus > 0 ? `<div class="cc-resource">
      <div class="cc-res-header"><span class="cc-res-label">Focus</span><span class="cc-res-value">${c.currentFocus} / ${c.maxFocus}</span></div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${focusPct}%;background:var(--steel)"></div></div>
      <div class="cc-adj-row">
        <button class="cc-btn" onclick="adjustRes(${c.id},'focus',-2)">-2</button><button class="cc-btn" onclick="adjustRes(${c.id},'focus',-1)">-1</button>
        <button class="cc-btn" onclick="adjustRes(${c.id},'focus', 1)">+1</button><button class="cc-btn" onclick="adjustRes(${c.id},'focus', 5)">+2</button>
      </div></div>` : ''}
    ${c.maxInvestiture > 0
      ? `<div class="cc-resource">
          <div class="cc-res-header"><span class="cc-res-label">Investiture</span><span class="cc-res-value">${c.currentInvestiture} / ${c.maxInvestiture}</span></div>
          <div class="cc-bar"><div class="cc-bar-fill" style="width:${invPct}%;background:var(--gold)"></div></div>
          <div class="cc-adj-row">
            <button class="cc-btn" onclick="adjustRes(${c.id},'investiture',-2)">-2</button><button class="cc-btn" onclick="adjustRes(${c.id},'investiture',-1)">-1</button>
            <button class="cc-btn" onclick="adjustRes(${c.id},'investiture', 1)">+1</button><button class="cc-btn" onclick="adjustRes(${c.id},'investiture', 5)">+2</button>
          </div></div>`
      : `<div style="margin-bottom:8px">${state.combatInvEditing.has(c.id)
          ? `<div class="cc-adj-row"><input type="number" class="cc-adj-input" id="cinv-${c.id}" min="1" placeholder="Max Inv" onkeydown="if(event.key==='Enter')setCombatInv(${c.id})"><button class="cc-btn" onclick="setCombatInv(${c.id})">Set</button><button class="cc-btn" onclick="toggleCombatInvInput(${c.id})">✕</button></div>`
          : `<button class="cc-btn" style="font-size:10px;padding:2px 6px;width:100%" onclick="toggleCombatInvInput(${c.id})">+ Add Investiture</button>`
        }</div>`}
    <div class="cc-stats">
      <div class="cc-stat-row"><span class="cc-stat-key">DEF</span> Phys ${a['Physical Defense']} · Cog ${a['Cognitive Defense']} · Spi ${a['Spiritual Defense']}</div>
      <div class="cc-stat-row"><span class="cc-stat-key">ATK</span> +${a['To Hit Bonus']} hit · <span class="cc-dpr-fast${fastDim?' dim':''}">Fast ${a['DPR (Fast)']}</span> · <span class="cc-dpr-slow${slowDim?' dim':''}">Slow ${a['DPR (Slow)']}</span></div>
      <div class="cc-stat-row"><span class="cc-stat-key">SKL</span> Phys ${a['Physical Skills']} · Cog ${a['Cognitive Skills']} · Spi ${a['Spiritual Skills']}${a['Invested Skills']>0?` · Inv ${a['Invested Skills']}`:''}</div>
    </div>
    <button class="cc-defeat-btn${c.defeated?' cc-revive-btn':''}" onclick="toggleDefeated(${c.id})">${c.defeated?'Revive':'Defeat'}</button>
  </div>`;
}

function buildAllyCard(c) {
  const a = c.adv;
  const hpPct    = c.maxHP          > 0 ? Math.max(0, c.currentHP          / c.maxHP          * 100) : 0;
  const focusPct = c.maxFocus       > 0 ? Math.max(0, c.currentFocus       / c.maxFocus       * 100) : 0;
  const invPct   = c.maxInvestiture > 0 ? Math.max(0, c.currentInvestiture / c.maxInvestiture * 100) : 0;
  const hpColor  = hpPct > 60 ? 'var(--easy)' : hpPct > 25 ? 'var(--medium)' : hpPct > 0 ? 'var(--hard)' : 'var(--deadly)';
  const fastDim = c.turnType === 'slow', slowDim = c.turnType === 'fast';
  return `<div class="combatant-card ally-card${c.defeated ? ' defeated' : ''}">
    <div class="cc-header">
      <div><div class="cc-name">${c.label}</div><div class="cc-meta"><span style="color:var(--easy);font-weight:700">Ally</span> · <span class="type-badge type-${a.Type}">${a.Type}</span> T${a.Tier} · ${a.World}</div></div>
      <div class="cc-turns">
        <button class="turn-btn${c.turnType==='fast'?' turn-fast-active':''}" onclick="setAllyTurn(${c.id},'fast')">Fast</button>
        <button class="turn-btn${c.turnType==='slow'?' turn-slow-active':''}" onclick="setAllyTurn(${c.id},'slow')">Slow</button>
      </div>
    </div>
    <div class="cc-resource">
      <div class="cc-res-header"><span class="cc-res-label">HP</span><span class="cc-res-value${c.currentHP<=0?' at-zero':''}">${c.currentHP} / ${c.maxHP}</span></div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>
      <div class="cc-adj-row">
        <input type="number" class="cc-adj-input" id="cc-hp-${c.id}" placeholder="amt" min="1">
        <button class="cc-btn cc-btn-dmg"  onclick="applyAllyHP(${c.id},'dmg')">Dmg</button>
        <button class="cc-btn cc-btn-heal" onclick="applyAllyHP(${c.id},'heal')">Heal</button>
      </div>
    </div>
    ${c.maxFocus > 0 ? `<div class="cc-resource">
      <div class="cc-res-header"><span class="cc-res-label">Focus</span><span class="cc-res-value">${c.currentFocus} / ${c.maxFocus}</span></div>
      <div class="cc-bar"><div class="cc-bar-fill" style="width:${focusPct}%;background:var(--steel)"></div></div>
      <div class="cc-adj-row">
        <button class="cc-btn" onclick="adjustAllyRes(${c.id},'focus',-2)">-2</button><button class="cc-btn" onclick="adjustAllyRes(${c.id},'focus',-1)">-1</button>
        <button class="cc-btn" onclick="adjustAllyRes(${c.id},'focus', 1)">+1</button><button class="cc-btn" onclick="adjustAllyRes(${c.id},'focus', 5)">+2</button>
      </div></div>` : ''}
    ${c.maxInvestiture > 0
      ? `<div class="cc-resource">
          <div class="cc-res-header"><span class="cc-res-label">Investiture</span><span class="cc-res-value">${c.currentInvestiture} / ${c.maxInvestiture}</span></div>
          <div class="cc-bar"><div class="cc-bar-fill" style="width:${invPct}%;background:var(--gold)"></div></div>
          <div class="cc-adj-row">
            <button class="cc-btn" onclick="adjustAllyRes(${c.id},'investiture',-2)">-2</button><button class="cc-btn" onclick="adjustAllyRes(${c.id},'investiture',-1)">-1</button>
            <button class="cc-btn" onclick="adjustAllyRes(${c.id},'investiture', 1)">+1</button><button class="cc-btn" onclick="adjustAllyRes(${c.id},'investiture', 5)">+2</button>
          </div></div>`
      : `<div style="margin-bottom:8px">${state.combatInvEditing.has(c.id)
          ? `<div class="cc-adj-row"><input type="number" class="cc-adj-input" id="cinv-${c.id}" min="1" placeholder="Max Inv" onkeydown="if(event.key==='Enter')setAllyInv(${c.id})"><button class="cc-btn" onclick="setAllyInv(${c.id})">Set</button><button class="cc-btn" onclick="toggleAllyInvInput(${c.id})">✕</button></div>`
          : `<button class="cc-btn" style="font-size:10px;padding:2px 6px;width:100%" onclick="toggleAllyInvInput(${c.id})">+ Add Investiture</button>`
        }</div>`}
    <div class="cc-stats">
      <div class="cc-stat-row"><span class="cc-stat-key">DEF</span> Phys ${a['Physical Defense']} · Cog ${a['Cognitive Defense']} · Spi ${a['Spiritual Defense']}</div>
      <div class="cc-stat-row"><span class="cc-stat-key">ATK</span> +${a['To Hit Bonus']} hit · <span class="cc-dpr-fast${fastDim?' dim':''}">Fast ${a['DPR (Fast)']}</span> · <span class="cc-dpr-slow${slowDim?' dim':''}">Slow ${a['DPR (Slow)']}</span></div>
      <div class="cc-stat-row"><span class="cc-stat-key">SKL</span> Phys ${a['Physical Skills']} · Cog ${a['Cognitive Skills']} · Spi ${a['Spiritual Skills']}${a['Invested Skills']>0?` · Inv ${a['Invested Skills']}`:''}</div>
    </div>
    <button class="cc-defeat-btn${c.defeated?' cc-revive-btn':''}" onclick="toggleAllyDefeated(${c.id})">${c.defeated?'Revive':'Defeat'}</button>
  </div>`;
}

// Enemy helpers
function getCombatant(id) { return state.combatants.find(c => c.id === id); }
export function setTurn(id, type) { const c = getCombatant(id); c.turnType = c.turnType === type ? null : type; renderCombat(); }
export function applyHPAdj(id, mode) { const inp = document.getElementById('cc-hp-' + id), amt = parseInt(inp.value); if (!amt || amt <= 0) return; adjustHP(id, mode === 'dmg' ? -amt : amt); inp.value = ''; }
function adjustHP(id, delta) { const c = getCombatant(id); c.currentHP = Math.min(c.maxHP, Math.max(0, c.currentHP + delta)); if (c.currentHP === 0) c.defeated = true; renderCombat(); }
export function adjustRes(id, res, delta) { const c = getCombatant(id); if (res === 'focus') c.currentFocus = Math.min(c.maxFocus, Math.max(0, c.currentFocus + delta)); else c.currentInvestiture = Math.min(c.maxInvestiture, Math.max(0, c.currentInvestiture + delta)); renderCombat(); }
export function toggleDefeated(id) { const c = getCombatant(id); c.defeated = !c.defeated; if (!c.defeated && c.currentHP === 0) c.currentHP = 1; renderCombat(); }
export function toggleCombatInvInput(id) { if (state.combatInvEditing.has(id)) state.combatInvEditing.delete(id); else state.combatInvEditing.add(id); renderCombat(); }
export function setCombatInv(id) { const val = parseInt(document.getElementById('cinv-' + id).value) || 0; if (val > 0) { const c = getCombatant(id); c.maxInvestiture = val; c.currentInvestiture = val; state.combatInvEditing.delete(id); } renderCombat(); }

// Ally helpers
function getAlly(id) { return state.allies.find(c => c.id === id); }
export function setAllyTurn(id, type) { const c = getAlly(id); c.turnType = c.turnType === type ? null : type; renderCombat(); }
export function applyAllyHP(id, mode) { const inp = document.getElementById('cc-hp-' + id), amt = parseInt(inp.value); if (!amt || amt <= 0) return; const c = getAlly(id); c.currentHP = Math.min(c.maxHP, Math.max(0, c.currentHP + (mode === 'dmg' ? -amt : amt))); if (c.currentHP === 0) c.defeated = true; inp.value = ''; renderCombat(); }
export function adjustAllyRes(id, res, delta) { const c = getAlly(id); if (res === 'focus') c.currentFocus = Math.min(c.maxFocus, Math.max(0, c.currentFocus + delta)); else c.currentInvestiture = Math.min(c.maxInvestiture, Math.max(0, c.currentInvestiture + delta)); renderCombat(); }
export function toggleAllyDefeated(id) { const c = getAlly(id); c.defeated = !c.defeated; if (!c.defeated && c.currentHP === 0) c.currentHP = 1; renderCombat(); }
export function toggleAllyInvInput(id) { if (state.combatInvEditing.has(id)) state.combatInvEditing.delete(id); else state.combatInvEditing.add(id); renderCombat(); }
export function setAllyInv(id) { const val = parseInt(document.getElementById('cinv-' + id).value) || 0; if (val > 0) { const c = getAlly(id); c.maxInvestiture = val; c.currentInvestiture = val; state.combatInvEditing.delete(id); } renderCombat(); }

// PC helpers
export function pcSetTurn(i, type) { state.pcs[i].turnType = state.pcs[i].turnType === type ? null : type; renderCombat(); }
export function pcApplyHP(i, mode) { const inp = document.getElementById('cc-hp-pc-' + i), amt = parseInt(inp.value); if (!amt || amt <= 0) return; const p = state.pcs[i]; p.currentHP = Math.min(p.maxHP, Math.max(0, p.currentHP + (mode === 'dmg' ? -amt : amt))); inp.value = ''; renderCombat(); }
export function pcAdjRes(i, res, delta) { const p = state.pcs[i]; if (res === 'focus') p.currentFocus = Math.min(p.maxFocus, Math.max(0, p.currentFocus + delta)); else p.currentInvestiture = Math.min(p.maxInvestiture, Math.max(0, p.currentInvestiture + delta)); renderCombat(); }
export function pcToggleDown(i) { state.pcs[i].down = !state.pcs[i].down; if (!state.pcs[i].down && state.pcs[i].currentHP === 0) state.pcs[i].currentHP = 1; renderCombat(); }
