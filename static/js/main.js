import { state } from './state.js';
import { fetchAdversaries, fetchBenchmarks, fetchConfig } from './api.js';
import {
  showTab, reloadAdversaries,
  setTier, setPlayers, syncPCCount, renderPCList, pcSetStat,
  updateBenchmark, updateWorldDropdown,
  renderEnemyList, addEnemy, addAlly,
  removeEnemy, removeAlly, changeQty, changeAllyQty, clearEncounter, renderEncounter,
  updateDifficulty,
  toggleEncInvInput, setEncInv, clearEncInv,
  toggleAllyEncInvInput, setAllyEncInv, clearAllyEncInv,
} from './encounter.js';
import {
  startCombat, endCombat, nextRound, renderCombat,
  setTurn, applyHPAdj, adjustRes, toggleDefeated, toggleCombatInvInput, setCombatInv,
  setAllyTurn, applyAllyHP, adjustAllyRes, toggleAllyDefeated, toggleAllyInvInput, setAllyInv,
  pcSetTurn, pcApplyHP, pcAdjRes, pcToggleDown,
  addMidCombat, openMidCombatModal, closeMidCombatModal, renderMidCombatList, selectMCAdversary, confirmMidCombat,
} from './combat.js';
import {
  openModal, closeModal, onOverlayClick, saveEnemy,
  doAdminLogin, doAdminLogout,
  toggleWorld, syncFromSheet, adminCreateAdversary,
  initAdminPanel,
} from './admin.js';

// Expose all functions called from inline HTML handlers
Object.assign(window, {
  // tabs
  showTab,
  // party
  setTier, setPlayers, pcSetStat,
  // enemy browser / encounter
  renderEnemyList, addEnemy, addAlly,
  removeEnemy, removeAlly, changeQty, changeAllyQty, clearEncounter,
  toggleEncInvInput, setEncInv, clearEncInv,
  toggleAllyEncInvInput, setAllyEncInv, clearAllyEncInv,
  updateBenchmark, updateDifficulty,
  // combat
  startCombat, endCombat, nextRound,
  setTurn, applyHPAdj, adjustRes, toggleDefeated, toggleCombatInvInput, setCombatInv,
  setAllyTurn, applyAllyHP, adjustAllyRes, toggleAllyDefeated, toggleAllyInvInput, setAllyInv,
  pcSetTurn, pcApplyHP, pcAdjRes, pcToggleDown,
  // mid-combat
  addMidCombat, openMidCombatModal, closeMidCombatModal, renderMidCombatList, selectMCAdversary, confirmMidCombat,
  // modal & admin
  openModal, closeModal, onOverlayClick, saveEnemy,
  doAdminLogin, doAdminLogout,
  toggleWorld, syncFromSheet, adminCreateAdversary,
  // expose pcs array for inline oninput handlers like "pcs[0].name=this.value"
  get pcs() { return state.pcs; },
});

async function init() {
  try {
    const [ar, br, cr] = await Promise.all([fetchAdversaries(), fetchBenchmarks(), fetchConfig()]);
    state.ADVERSARIES = ar;
    state.PC_DPR_ROUNDS = br.pc_dpr_rounds;
    state.BOSS_BENCHMARK = br.boss_benchmark;
    state.PC_HP = br.pc_hp;
    state.adminLocked = cr.admin_locked;
  } catch (e) {
    document.getElementById('enemyList').innerHTML = '<div class="no-results" style="color:var(--deadly)">Failed to load data.</div>';
    return;
  }
  syncPCCount(); updateBenchmark(); updateWorldDropdown(); renderEnemyList(); renderEncounter(); updateDifficulty(); initAdminPanel();
}

document.addEventListener('DOMContentLoaded', init);
