const API_ROOT = 'https://expiration-precious-pins-moisture.trycloudflare.com';

export const FAMILY_STATE = Object.freeze({
  game:`${API_ROOT}/game`,
  players:Object.freeze({
    eunjun:`${API_ROOT}/players/eunjun`,
    haeun:`${API_ROOT}/players/haeun`,
    yunhee:`${API_ROOT}/players/yunhee`,
    hyunshin:`${API_ROOT}/players/hyunshin`
  })
});

export const ADMIN_PIN_SHA256 = '3a481e728390d89c6843c180dc18ca8d693de5f5421e6240711c5dad483c72b3';
export const POLL_MS = 1500;
