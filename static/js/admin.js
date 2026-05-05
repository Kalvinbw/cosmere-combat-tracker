import { state, ALL_WORLDS, SHEET_ID } from './state.js';
import { postAdversary } from './api.js';
import { reloadAdversaries, getEnabledWorlds, saveEnabledWorlds, updateWorldDropdown, renderEnemyList } from './encounter.js';

export function getAdminKey() { return sessionStorage.getItem('adminKey') || ''; }

export function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('modalSuccess').style.display = 'none';
  const show = state.adminLocked ? 'block' : 'none';
  document.getElementById('adminKeyRow').style.display = show;
  document.getElementById('adminNote').style.display = show;
  if (state.adminLocked) document.getElementById('f-adminkey').value = sessionStorage.getItem('adminKey') || '';
  document.getElementById('f-name').focus();
}

export function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
export function onOverlayClick(e) { if (e.target === document.getElementById('modalOverlay')) closeModal(); }

export async function saveEnemy() {
  const errEl = document.getElementById('modalError'),
        okEl  = document.getElementById('modalSuccess'),
        saveBtn = document.getElementById('saveBtn');
  errEl.style.display = 'none'; okEl.style.display = 'none';
  const name  = document.getElementById('f-name').value.trim(),
        world = document.getElementById('f-world').value,
        tier  = document.getElementById('f-tier').value,
        type  = document.getElementById('f-type').value;
  if (!name || !world || !tier || !type) { errEl.textContent = 'Name, World, Tier, and Type are required.'; errEl.style.display = 'block'; return; }
  const payload = {
    'Adversary Name': name, World: world, Tier: parseInt(tier), Type: type,
    'Physical Defense':  parseInt(document.getElementById('f-physdef').value)   || 0,
    'Cognitive Defense': parseInt(document.getElementById('f-cogdef').value)    || 0,
    'Spiritual Defense': parseInt(document.getElementById('f-spidef').value)    || 0,
    'Health':            parseInt(document.getElementById('f-health').value)    || 0,
    'Focus':             parseInt(document.getElementById('f-focus').value)     || 0,
    'Investiture':       parseInt(document.getElementById('f-investiture').value) || 0,
    'Physical Skills':   parseInt(document.getElementById('f-physskill').value) || 0,
    'Cognitive Skills':  parseInt(document.getElementById('f-cogskill').value)  || 0,
    'Spiritual Skills':  parseInt(document.getElementById('f-spiskill').value)  || 0,
    'Invested Skills':   parseInt(document.getElementById('f-invskill').value)  || 0,
    'To Hit Bonus':      parseInt(document.getElementById('f-tohit').value)     || 0,
    'DPR (Fast)':        parseInt(document.getElementById('f-dprfast').value)   || 0,
    'DPR (Slow)':        parseInt(document.getElementById('f-dprslow').value)   || 0,
  };
  saveBtn.disabled = true;
  try {
    const headers = {};
    if (state.adminLocked) {
      const key = document.getElementById('f-adminkey').value.trim();
      sessionStorage.setItem('adminKey', key);
      headers['X-Admin-Key'] = key;
    }
    const res = await postAdversary(payload, headers);
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Server error'); }
    okEl.textContent = `"${name}" saved.`; okEl.style.display = 'block';
    await reloadAdversaries();
    setTimeout(closeModal, 1200);
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
  finally { saveBtn.disabled = false; }
}

export function showAdminPanel() {
  state.adminAuthed = true;
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminPanel').style.display = '';
  document.getElementById('logoutBtn').style.display = state.adminLocked ? '' : 'none';
  renderWorldToggles();
}

export function doAdminLogin() {
  const key = document.getElementById('adminKeyInput').value.trim();
  sessionStorage.setItem('adminKey', key);
  showAdminPanel();
}

export function doAdminLogout() {
  state.adminAuthed = false;
  sessionStorage.removeItem('adminKey');
  document.getElementById('adminKeyInput').value = '';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminLogin').style.display = '';
}

export function renderWorldToggles() {
  const enabled = getEnabledWorlds();
  document.getElementById('worldToggles').innerHTML = ALL_WORLDS.map(w => `
    <label class="world-toggle-label">
      <input type="checkbox" ${enabled.has(w) ? 'checked' : ''} onchange="toggleWorld('${w}',this.checked)">
      ${w}
    </label>`).join('');
}

export function toggleWorld(world, on) {
  const set = getEnabledWorlds();
  on ? set.add(world) : set.delete(world);
  saveEnabledWorlds(set);
  updateWorldDropdown();
  renderEnemyList();
}

export function parseCSV(text) {
  return text.split('\n').map(line => {
    const cells = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (line[i] === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += line[i];
    }
    cells.push(cur.trim()); return cells;
  }).filter(r => r.some(c => c));
}

export async function syncFromSheet() {
  const btn = document.getElementById('syncBtn'), statusEl = document.getElementById('syncStatus');
  btn.disabled = true; btn.textContent = 'Checking…';
  statusEl.className = 'astatus'; statusEl.style.display = 'none';

  const NUM = ['Physical Defense','Cognitive Defense','Spiritual Defense','Health','Focus',
    'Investiture','Physical Skills','Cognitive Skills','Spiritual Skills','Invested Skills',
    'To Hit Bonus','DPR (Fast)','DPR (Slow)'];
  const existingKeys = new Set(state.ADVERSARIES.map(a => `${a.World}|${a.Tier}|${a['Adversary Name']}`));
  const newOnes = [];

  for (const world of ALL_WORLDS) {
    for (const tier of [1, 2, 3, 4]) {
      const sheetName = `${world}Tier${tier}`;
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      try {
        const resp = await fetch(url); if (!resp.ok) continue;
        const rows = parseCSV(await resp.text());
        if (!rows.length || !rows[0].includes('Adversary Name')) continue;
        const header = rows[0], nameIdx = header.indexOf('Adversary Name');
        for (const row of rows.slice(1)) {
          const name = row[nameIdx]?.trim(); if (!name) continue;
          const key = `${world}|${tier}|${name}`; if (existingKeys.has(key)) continue;
          const adv = { 'Adversary Name': name, World: world, Tier: tier };
          header.forEach((h, i) => { if (!h || h === 'Adversary Name') return; adv[h] = NUM.includes(h) ? (parseInt(row[i]) || 0) : (row[i] || ''); });
          newOnes.push(adv); existingKeys.add(key);
        }
      } catch (_) {}
    }
  }

  btn.disabled = false; btn.textContent = 'Check for Updates';
  if (!newOnes.length) { setAStatus(statusEl, 'Already up to date — no new adversaries found.', true); return; }

  const headers = {}; const key = getAdminKey(); if (key) headers['X-Admin-Key'] = key;
  let added = 0, failed = [];
  for (const adv of newOnes) {
    try {
      const res = await postAdversary(adv, headers);
      if (res.ok) added++; else { const e = await res.json(); failed.push(`${adv['Adversary Name']}: ${e.error || res.status}`); }
    } catch (e) { failed.push(`${adv['Adversary Name']}: network error`); }
  }
  await reloadAdversaries();
  const msg = `Added ${added} of ${newOnes.length} adversaries.` + (failed.length ? '\nFailed:\n' + failed.join('\n') : '');
  setAStatus(statusEl, msg, !failed.length);
}

export async function adminCreateAdversary() {
  const statusEl = document.getElementById('createStatus');
  const name  = document.getElementById('ca-name').value.trim(),
        world = document.getElementById('ca-world').value,
        tier  = document.getElementById('ca-tier').value,
        type  = document.getElementById('ca-type').value;
  if (!name || !world || !tier || !type) { setAStatus(statusEl, 'Name, World, Tier, and Type are required.', false); return; }
  const payload = {
    'Adversary Name': name, World: world, Tier: parseInt(tier), Type: type,
    'Physical Defense':  parseInt(document.getElementById('ca-physdef').value)     || 0,
    'Cognitive Defense': parseInt(document.getElementById('ca-cogdef').value)      || 0,
    'Spiritual Defense': parseInt(document.getElementById('ca-spidef').value)      || 0,
    'Health':            parseInt(document.getElementById('ca-health').value)      || 0,
    'Focus':             parseInt(document.getElementById('ca-focus').value)       || 0,
    'Investiture':       parseInt(document.getElementById('ca-investiture').value) || 0,
    'Physical Skills':   parseInt(document.getElementById('ca-physskill').value)   || 0,
    'Cognitive Skills':  parseInt(document.getElementById('ca-cogskill').value)    || 0,
    'Spiritual Skills':  parseInt(document.getElementById('ca-spiskill').value)    || 0,
    'Invested Skills':   parseInt(document.getElementById('ca-invskill').value)    || 0,
    'To Hit Bonus':      parseInt(document.getElementById('ca-tohit').value)       || 0,
    'DPR (Fast)':        parseInt(document.getElementById('ca-dprfast').value)     || 0,
    'DPR (Slow)':        parseInt(document.getElementById('ca-dprslow').value)     || 0,
  };
  const headers = {}; const key = getAdminKey(); if (key) headers['X-Admin-Key'] = key;
  try {
    const res = await postAdversary(payload, headers);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || `HTTP ${res.status}`); }
    setAStatus(statusEl, `"${name}" saved.`, true);
    await reloadAdversaries();
  } catch (e) { setAStatus(statusEl, e.message, false); }
}

export function setAStatus(el, msg, ok) { el.textContent = msg; el.className = 'astatus ' + (ok ? 'ok' : 'err'); }

export function initAdminPanel() {
  if (!state.adminLocked) {
    document.getElementById('adminLoginNote').textContent = 'No admin key required — running in open mode.';
    showAdminPanel();
  }
}
