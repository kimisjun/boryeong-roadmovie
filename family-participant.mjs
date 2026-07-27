import {PLAYERS, TMI_QUESTIONS, POINTING_QUESTIONS} from './family-data.mjs?v=20260727-6';
import {FAMILY_STATE, POLL_MS} from './family-config.mjs?v=20260727-6';
import {JsonBlobStore, startPolling} from './family-store.mjs?v=20260727-6';
import {submissionStatus, tmiInteractionState} from './family-core.mjs?v=20260727-6';

const app = document.querySelector('#family-app');
const banner = document.querySelector('#network-banner');
const retry = document.querySelector('#network-retry');
const store = new JsonBlobStore();
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const playerBySlug = slug => PLAYERS.find(player => player.slug === slug);
const emptyScores = () => Object.fromEntries(PLAYERS.map(player => [player.slug, {tmi:0, pointing:0}]));
let slug = localStorage.getItem('family-player');
if (!playerBySlug(slug)) slug = null;
let game = {phase:'collecting', locked:false, scores:emptyScores()};
let me = null;
let peerStates = {};
let networkFailed = false;
let writing = Promise.resolve();
let writeEpoch = 0;
let lastHeartbeat = 0;

function defaultPlayer(player) {
  return {version:1, slug:player.slug, name:player.name, submitted:false, answers:Array(10).fill(''), draftIndex:0,
    live:{game:null,key:null,value:null,submittedAt:null}, onlineAt:0, updatedAt:0};
}
function showError(error) {
  networkFailed = true; banner.hidden = false;
  banner.querySelector('span').textContent = `공유 상태 연결 실패 · ${error?.message || '네트워크를 확인해 주세요.'}`;
}
function clearError() { networkFailed = false; banner.hidden = true; }
function ownWrite(next) {
  if (!slug) return Promise.resolve();
  // Ownership invariant: this module only ever writes the selected participant URL.
  writeEpoch += 1;
  me = {...defaultPlayer(playerBySlug(slug)), ...next, slug, name:playerBySlug(slug).name, onlineAt:Date.now()};
  peerStates[slug] = me;
  writing = writing.catch(() => {}).then(() => store.write(FAMILY_STATE.players[slug], me)).then(saved => { me = saved; clearError(); return saved; }).catch(error => { showError(error); throw error; });
  return writing;
}
function setLive(gameName, key, value) {
  return ownWrite({...me, live:{game:gameName, key, value, submittedAt:Date.now()}});
}
function isLive() { return !['collecting'].includes(game.phase); }
function setPageMode() { document.body.classList.toggle('live', isLive()); }

function scoreMarkup(scores = emptyScores()) {
  return `<div class="score-grid">${PLAYERS.map(player => {
    const score = scores[player.slug] || {};
    return `<article class="score-card" style="--person:${player.color}"><b>${player.name}</b><strong>${Number(score.tmi || 0) + Number(score.pointing || 0)}</strong><span>TMI ${Number(score.tmi || 0)} · 이미지 ${Number(score.pointing || 0)}</span></article>`;
  }).join('')}</div>`;
}
function chooseName() {
  app.innerHTML = `<header class="family-hero"><span class="eyebrow">MONDAY · FAMILY NIGHT</span><h1>누구로 참여할까요?</h1><p>로그인은 필요 없어요. 이 기기에 이름만 기억합니다.</p></header><section class="panel"><div class="name-grid">${PLAYERS.map(player => `<button class="name-card" style="--person:${player.color}" data-name="${player.slug}">${player.name}</button>`).join('')}</div></section>`;
  app.querySelectorAll('[data-name]').forEach(button => button.addEventListener('click', async () => {
    slug = button.dataset.name; localStorage.setItem('family-player', slug); me = defaultPlayer(playerBySlug(slug));
    try { me = {...me, ...await store.read(FAMILY_STATE.players[slug])}; clearError(); await ownWrite(me); } catch (error) { showError(error); }
    render();
  }));
}
function collecting() {
  const player = playerBySlug(slug);
  if (!me) { app.innerHTML = '<div class="family-loading"><span class="spinner"></span><b>내 답변 불러오는 중…</b></div>'; return; }
  if (game.locked && !me.submitted) {
    app.innerHTML = `<section class="panel waiting"><div class="big-icon">🔒</div><h1>답변이 잠겼어요</h1><p>행사가 이미 시작되었습니다. 진행자에게 알려 주세요.</p></section>`; return;
  }
  if (me.submitted) return submittedDashboard(player);
  const index = Math.max(0, Math.min(9, Number(me.draftIndex || 0)));
  const question = TMI_QUESTIONS[index];
  app.innerHTML = `<div class="who-bar"><span class="person-chip" style="--person:${player.color}">${player.name}</span><button class="text-button" id="change-name">이름 변경</button></div><section class="panel"><div class="question-count">${index + 1}/10</div><h1 class="question-title">${esc(question.text)}</h1><input id="answer" class="answer-input" maxlength="30" value="${esc(me.answers?.[index] || '')}" placeholder="${esc(question.placeholder)}" autocomplete="off"><div class="char-count"><span id="chars">${String(me.answers?.[index] || '').length}</span>/30</div><div class="actions"><button class="btn" id="previous" ${index === 0 ? 'disabled' : ''}>이전</button><button class="btn primary" id="next">${index === 9 ? '최종 제출' : '저장 후 다음'}</button></div></section>`;
  const input = app.querySelector('#answer'); input.focus();
  input.addEventListener('input', () => { app.querySelector('#chars').textContent = input.value.length; });
  app.querySelector('#change-name').addEventListener('click', changeName);
  app.querySelector('#previous').addEventListener('click', async () => saveDraft(index, Math.max(0,index - 1), false));
  app.querySelector('#next').addEventListener('click', async () => {
    if (!input.value.trim()) { input.setCustomValidity('답변을 한 줄 입력해 주세요.'); input.reportValidity(); return; }
    const answers = [...(me.answers || Array(10).fill(''))]; answers[index] = input.value.trim();
    if (index === 9) {
      if (answers.some(answer => !String(answer).trim())) { alert('비어 있는 이전 답변이 있어요. 이전 버튼으로 확인해 주세요.'); return; }
      await ownWrite({...me, answers, draftIndex:9, submitted:true}); render();
    } else await saveDraft(index, index + 1, false);
  });
}
async function saveDraft(index, draftIndex, submitted) {
  const input = app.querySelector('#answer');
  const answers = [...(me.answers || Array(10).fill(''))]; answers[index] = input.value.trim();
  try { await ownWrite({...me, answers, draftIndex, submitted}); render(); } catch {}
}
function changeName() { localStorage.removeItem('family-player'); slug = null; me = null; render(); }
function submittedDashboard(player) {
  const statuses = submissionStatus(PLAYERS, {...peerStates, [slug]:me});
  const submitted = PLAYERS.map(item => statuses[item.slug]);
  app.innerHTML = `<div class="who-bar"><span class="person-chip" style="--person:${player.color}">${player.name}</span><button class="text-button" id="change-name">이름 변경</button></div><header class="family-hero"><span class="eyebrow">READY</span><h1>답변 준비 완료!</h1><p>행사 시작 전까지 언제든 수정할 수 있어요.</p></header><section class="panel"><h2>준비 현황</h2><div class="status-grid">${PLAYERS.map((item,index) => `<article class="status-card ${submitted[index] ? 'ready' : ''}" style="--person:${item.color}"><b>${item.name}</b><span>${submitted[index] ? '준비 완료' : '작성 중'}</span></article>`).join('')}</div></section><section class="panel"><h2>현재 점수</h2>${scoreMarkup(game.scores)}</section><div class="actions"><button class="btn primary" id="edit">내 답변 수정</button></div><details class="panel"><summary>오늘의 레크리에이션 게임</summary><ol class="game-list"><li><b>가족 TMI</b> · 서로의 답을 맞혀요.</li><li><b>이미지 게임</b> · 질문에 어울리는 가족을 골라요.</li><li><b>대화 카드</b> · 각자 다섯 질문에 답해요.</li></ol></details>`;
  app.querySelector('#change-name').addEventListener('click', changeName);
  app.querySelector('#edit').addEventListener('click', async () => { await ownWrite({...me, submitted:false, draftIndex:0}); render(); });
}
function liveTmi() {
  const state = game.tmi || {}; const round = state.rounds?.[state.index];
  if (!round) return liveWaiting('TMI 문제를 준비하고 있어요', '진행자 화면을 봐 주세요.');
  const interaction = tmiInteractionState(state);
  if (interaction === 'waiting') return liveWaiting('TMI 시작 전이에요', '진행자가 시작하면 문제가 나타납니다.');
  if (interaction === 'paused') return liveWaiting('잠시 멈췄어요', '진행자가 재개할 때까지 공용 화면을 봐 주세요.');
  const target = playerBySlug(round.target); const eligible = round.target !== slug;
  const selected = me?.live?.game === 'tmi' && me.live.key === round.id ? me.live.value : null;
  const waitingCount = Number(game.responseCount || 0);
  let body;
  if (!eligible) body = `<div class="waiting"><div class="big-icon">🎯</div><h2>이번 문제의 주인공은 ${target.name}</h2><p>가족들이 나를 얼마나 잘 아는지 지켜봐요.</p></div>`;
  else body = `<div class="choice-list">${round.choices.map((choice,index) => {
    const names = state.revealed ? PLAYERS.filter(p => game.tmiSelections?.[p.slug] === choice).map(p => p.name).join(' · ') : '';
    const classes = [selected === choice ? 'selected' : '', state.revealed && choice === round.correctAnswer ? 'correct' : '', state.revealed && selected === choice && choice !== round.correctAnswer ? 'wrong' : ''].join(' ');
    return `<button class="choice ${classes}" data-choice="${index}" ${state.revealed ? 'disabled' : ''}><i>${String.fromCharCode(65+index)}</i><span>${esc(choice)}</span>${names ? `<small class="reveal-names">${esc(names)}</small>` : ''}</button>`;
  }).join('')}</div><p class="muted">${state.revealed ? (selected === round.correctAnswer ? '정답! +1점' : `정답은 “${esc(round.correctAnswer)}”`) : selected ? '제출 완료 · 공개 전까지 바꿀 수 있어요.' : '하나를 선택해 주세요.'}</p>`;
  app.innerHTML = liveFrame(`<span>${target.name} TMI · ${state.index % 10 + 1}/10</span><span>${waitingCount}/3 응답</span>`, `<h1 class="live-question">${esc(round.question)}</h1>${body}`);
  app.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', async () => {
    await setLive('tmi', round.id, round.choices[Number(button.dataset.choice)]); render();
  }));
}
function livePointing() {
  const state = game.pointing || {}; const question = POINTING_QUESTIONS[state.index];
  if (!question) return liveWaiting('이미지 게임을 준비하고 있어요', '진행자 화면을 봐 주세요.');
  const key = `pointing-${question.id}`; const selected = me?.live?.game === 'pointing' && me.live.key === key ? me.live.value : null;
  const candidates = PLAYERS.filter(player => player.slug !== slug);
  let body = `<div class="choice-list">${candidates.map(player => `<button class="choice ${selected === player.slug ? 'selected' : ''}" style="--person:${player.color}" data-person="${player.slug}" ${state.revealed ? 'disabled' : ''}><span class="person-chip" style="--person:${player.color}">${player.name}</span>${state.revealed ? `<small class="reveal-names">${Number(game.pointingCounts?.[player.slug] || 0)}표</small>` : ''}</button>`).join('')}</div><p class="muted">${state.revealed ? '투표자는 공개하지 않아요.' : selected ? '제출 완료 · 공개 전까지 바꿀 수 있어요.' : '나를 제외한 가족 한 명을 골라요.'}</p>`;
  app.innerHTML = liveFrame(`<span>이미지 게임 · ${state.index + 1}/15</span><span>${Number(game.responseCount || 0)}/4 응답</span>`, `<h1 class="live-question">${esc(question.text)}</h1>${body}`);
  app.querySelectorAll('[data-person]').forEach(button => button.addEventListener('click', async () => { await setLive('pointing', key, button.dataset.person); render(); }));
}
function liveFrame(top, body) { return `<section class="live-shell"><header class="live-top"><span class="eyebrow">FAMILY NIGHT</span>${top}</header><div class="live-center">${game.offlineMessage ? `<div class="offline-note">${esc(game.offlineMessage)}</div>` : ''}${body}</div></section>`; }
function liveWaiting(title, message) { app.innerHTML = liveFrame('<span>LIVE</span>', `<div class="waiting"><div class="big-icon">✦</div><h1>${esc(title)}</h1><p>${esc(message)}</p></div>`); }
function liveScore(title) { app.innerHTML = liveFrame(`<span>${esc(title)}</span>`, `<h1>${esc(title)}</h1><div class="immersive-score">${scoreMarkup(game.scores)}</div><p>진행자가 다음 게임을 준비하고 있어요.</p>`); }
function finalScreen() { liveScore(game.phase === 'ended' ? '행사가 끝났어요' : '최종 결과'); }
function render() {
  setPageMode();
  if (!slug) return chooseName();
  if (game.phase === 'collecting') return collecting();
  if (game.phase === 'tmi') return liveTmi();
  if (game.phase === 'pointing') return livePointing();
  if (game.phase === 'tmi_score') return liveScore('TMI 중간 순위');
  if (game.phase === 'pointing_score') return liveScore('이미지 게임 순위');
  if (game.phase === 'final' || game.phase === 'ended') return finalScreen();
  const messages = {rules:['규칙 설명 중','공용 화면을 봐 주세요.'],cards:['대화 카드 시간','공용 화면에서 함께 이야기해요.']};
  liveWaiting(...(messages[game.phase] || ['잠시만 기다려 주세요','진행자가 다음 순서를 준비 중이에요.']));
}
async function poll() {
  const preserveAnswerInput = game.phase === 'collecting' && document.activeElement?.id === 'answer';
  const epochAtStart = writeEpoch;
  const values = [await store.read(FAMILY_STATE.game)];
  for (const player of PLAYERS) values.push(await store.read(FAMILY_STATE.players[player.slug]));
  game = values[0] || game;
  peerStates = Object.fromEntries(PLAYERS.map((player,index) => [player.slug, values[index + 1] || defaultPlayer(player)]));
  if (slug && epochAtStart === writeEpoch) me = {...defaultPlayer(playerBySlug(slug)), ...peerStates[slug]};
  if (slug && Date.now() - lastHeartbeat > 5000) { lastHeartbeat = Date.now(); await ownWrite(me); }
  clearError();
  if (!preserveAnswerInput || game.phase !== 'collecting') render();
}
retry.addEventListener('click', () => poll().catch(showError));
render();
startPolling(poll, {interval:POLL_MS, onError:showError});
