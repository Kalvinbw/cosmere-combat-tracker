export const SHEET_ID = '1znToovH68XfbhI5YPvEjsou3ADRslqX49Swf7UofZPA';
export const ALL_WORLDS = ['Stormlight','Mistborn','Elantris','Warbreaker','Wax','Wayne','Worldhopper'];

export const state = {
  ADVERSARIES: [],
  PC_DPR_ROUNDS: {},
  BOSS_BENCHMARK: {},
  PC_HP: {},
  partyTier: 1,
  partyPlayers: 4,
  pcs: [],
  encounter: new Map(),
  encounterAllies: new Map(),
  encounterInvestiture: new Map(),
  encounterInvEditing: new Set(),
  encounterAllyInvestiture: new Map(),
  encounterAllyInvEditing: new Set(),
  allies: [],
  combatants: [],
  combatRound: 1,
  nextCombatId: 0,
  combatInvEditing: new Set(),
  adminLocked: false,
  adminAuthed: false,
};
