import {PLAYERS, TMI_QUESTIONS, POINTING_QUESTIONS, TALK_CARDS} from './family-data.mjs?v=20260727-6';
import {FAMILY_STATE, ADMIN_PIN_SHA256, POLL_MS} from './family-config.mjs?v=20260727-6';
import {JsonBlobStore, startPolling} from './family-store.mjs?v=20260727-6';
import {buildTmiRounds, scoreTmiAnswer, awardPointingQuestion, rankScores, shuffle} from './family-core.mjs?v=20260727-6';

const app = document.querySelector('#admin-app');
const banner = document.querySelector('#network-banner');
const retry = document.querySelector('#network-retry');
const store = new JsonBlobStore();
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const emptyScores = () => Object.fromEntries(PLAYERS.map(player => [player.slug, {tmi:0, pointing:0}]));
const bySlug = slug => PLAYERS.find(player => player.slug === slug);
const rules = [
  ['오늘의 순서','규칙 → 가족 TMI → 이미지 게임 → 대화 카드 → 최종 시상'],
  ['가족 TMI','한 사람당 10문제. 주인공을 뺀 세 명이 A~E 중 정답을 고릅니다. 정답은 +1점!'],
  ['이미지 게임','15개 질문마다 나를 제외한 한 명을 고릅니다. 최다 득표자는 모두 +1점!'],
  ['대화 카드','은준 → 하은 → 윤희 → 현신 순서로 5번씩, 정확히 20장을 이야기합니다.'],
  ['점수와 연결','중간 순위는 TMI 각 10문제와 이미지 게임이 끝날 때만 봅니다. 모두 온라인이어야 진행됩니다.']
];
let game = {version:1, phase:'collecting', locked:false, scores:emptyScores(), scoredKeys:[], awardedKeys:[]};
let players = {};
let unlocked = sessionStorage.getItem('family-admin-unlocked') === 'yes';
let muted = localStorage.getItem('family-admin-muted') === 'yes';
let writing = Promise.resolve();
let writeEpoch = 0;
let clockTimer = null;

function normalizeGame(value = {}) {
  return {...game, ...value, scores:{...emptyScores(), ...(value.scores || {})}, scoredKeys:value.scoredKeys || [], awardedKeys:value.awardedKeys || []};
}
function showError(error) { banner.hidden = false; banner.querySelector('span').textContent = `공유 상태 연결 실패 · ${error?.message || '네트워크를 확인해 주세요.'}`; }
function clearError() { banner.hidden = true; }
function save(patch) {
  // Ownership invariant: the admin module writes only the game blob, never a participant blob.
  writeEpoch += 1;
  game = normalizeGame({...game, ...patch});
  writing = writing.catch(() => {}).then(() => store.write(FAMILY_STATE.game, game)).then(saved => { game = normalizeGame(saved); clearError(); render(); sound(); return saved; }).catch(error => { showError(error); throw error; });
  return writing;
}
function playerReady(slug) { return Boolean(players[slug]?.submitted); }
function online(slug) { return Date.now() - Number(players[slug]?.onlineAt || 0) < 15000; }
function allOnline() { return PLAYERS.every(player => online(player.slug)); }
function onlineMarkup() {
  return `<div class="online-list">${PLAYERS.map(player => `<div class="online-row ${online(player.slug) ? '' : 'offline'}" style="--person:${player.color}"><b>${player.name}</b><span>${online(player.slug) ? '온라인' : '오프라인'}</span></div>`).join('')}</div>`;
}
async function digest(value) {
  const bytes = new TextEncoder().encode(value); const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
function pinScreen(message = '') {
  app.innerHTML = `<section class="pin-screen"><form class="pin-box" id="pin-form"><span class="eyebrow">ADMIN TABLET</span><h1>진행자 PIN</h1><p>실수로 진행 화면을 조작하지 않도록 만든 기기용 잠금입니다. 백엔드 보안 인증은 아닙니다.</p><label for="pin">4자리 PIN</label><input id="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autofocus><button class="btn primary" type="submit">진행 화면 열기</button>${message ? `<p role="alert">${esc(message)}</p>` : ''}</form></section>`;
  app.querySelector('#pin-form').addEventListener('submit', async event => {
    event.preventDefault(); const pin = app.querySelector('#pin').value;
    if (await digest(pin) === ADMIN_PIN_SHA256) { unlocked = true; sessionStorage.setItem('family-admin-unlocked','yes'); render(); }
    else pinScreen('PIN이 맞지 않습니다.');
  });
}
function header() {
  const labels = {collecting:'답변 수집',rules:'규칙',tmi:'가족 TMI',tmi_score:'TMI 순위',pointing:'이미지 게임',pointing_score:'이미지 게임 순위',cards:'대화 카드',final:'최종 시상',ended:'종료'};
  return `<header class="admin-header"><h1>FAMILY NIGHT / ${labels[game.phase] || game.phase}</h1><div class="admin-tools"><button data-action="mute">${muted ? '🔇 효과음 끔' : '🔊 효과음 켬'}</button><button data-action="lock-admin">화면 잠금</button></div></header>`;
}
function controls(buttons) { return `<div class="admin-controls">${buttons.map(item => `<button class="btn ${item.primary ? 'coral' : ''} ${item.wide ? 'wide' : ''}" data-action="${item.action}" ${item.disabled ? 'disabled' : ''}>${item.label}</button>`).join('')}</div>`; }
function shell(stage, buttons) {
  return `${header()}<div class="admin-layout"><section class="stage">${stage}</section><aside class="admin-side"><section class="panel"><h3>접속 상태</h3>${onlineMarkup()}</section>${controls(buttons)}</aside></div>`;
}
function collectingView() {
  const allSubmitted = PLAYERS.every(player => playerReady(player.slug));
  const cards = PLAYERS.map(player => `<article class="status-card ${playerReady(player.slug) ? 'ready' : ''}" style="--person:${player.color}"><b>${player.name}</b><span>${playerReady(player.slug) ? '10/10 제출 완료' : '작성 중'}</span></article>`).join('');
  return shell(`<div class="stage-body"><span class="eyebrow">PRE-GAME CHECK</span><h2>가족 답변 준비</h2><div class="status-grid">${cards}</div><p>${allSubmitted ? '모두 준비되었습니다. 먼저 규칙을 설명하거나 바로 행사를 시작할 수 있습니다.' : '네 명 모두 답변을 제출해야 행사를 시작할 수 있습니다.'}</p></div>`, [
    {action:'rules',label:'규칙 설명',wide:true,primary:true},{action:'start',label:'행사 시작 · 답변 잠금',wide:true,disabled:!allSubmitted}
  ]);
}
function rulesView() {
  const index = Math.max(0, Math.min(4, Number(game.rulesSlide || 0))); const [title,text] = rules[index];
  return shell(`<div class="stage-body rules-slide"><span class="eyebrow">RULE ${index + 1} / 5</span><strong>${String(index + 1).padStart(2,'0')}</strong><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`, [
    {action:'rules-prev',label:'이전 슬라이드',disabled:index===0},{action:'rules-next',label:'다음 슬라이드',disabled:index===4},{action:'back-collecting',label:'답변 현황',wide:true},{action:'start',label:'행사 시작 · 잠금',wide:true,primary:true,disabled:!PLAYERS.every(p=>playerReady(p.slug))}
  ]);
}
function tmiInfo() {
  const state = game.tmi || {}; const round = state.rounds?.[state.index];
  if (!round) return {state,round:null,selections:{},count:0};
  const selections = {};
  round.voters.forEach(slug => { const live = players[slug]?.live; if (live?.game === 'tmi' && live.key === round.id && live.value) selections[slug] = live.value; });
  return {state,round,selections,count:Object.keys(selections).length};
}
function tmiView() {
  const {state,round,selections,count} = tmiInfo();
  if (!round) return shell('<div class="stage-body"><h2>TMI 문제 없음</h2></div>', [{action:'back-collecting',label:'답변 현황'}]);
  const target = bySlug(round.target); const blocked = !allOnline();
  const choices = round.choices.map((choice,index) => {
    const picked = Object.entries(selections).filter(([,value]) => value === choice).map(([slug]) => bySlug(slug).name).join(' · ');
    return `<div class="admin-choice ${state.revealed && choice === round.correctAnswer ? 'correct' : ''}"><span>${String.fromCharCode(65+index)}. ${esc(choice)}</span>${state.revealed ? `<span class="picked">${esc(picked || '—')}</span>` : ''}</div>`;
  }).join('');
  const offline = blocked ? `<div class="offline-note">오프라인 참가자가 있습니다. 모두 재접속하기 전 공개와 다음 진행이 차단됩니다.</div>` : '';
  const startLabel = state.started ? '진행 중' : 'TMI 시작';
  return shell(`<div class="stage-body"><span class="eyebrow">${target.name} · ${state.index % 10 + 1}/10 · 전체 ${state.index + 1}/40</span><h2 class="question-title">${esc(round.question)}</h2>${offline}${state.started ? choices : '<p>참가자 화면에 문제를 띄울 준비가 되었습니다.</p>'}<p><b>${count}/3 응답</b>${state.revealed ? ` · 정답: ${esc(round.correctAnswer)}` : ''}${state.paused ? ' · 일시정지' : ''}</p></div>`, [
    {action:'tmi-start',label:startLabel,disabled:state.started},{action:'tmi-pause',label:state.paused?'재개':'일시정지',disabled:!state.started},{action:'tmi-reveal',label:'정답 공개',wide:true,primary:true,disabled:!state.started||state.revealed||count!==3||blocked},{action:'tmi-next',label:'다음 문제',wide:true,disabled:!state.revealed||blocked},{action:'tmi-invalid',label:'문제 무효 · 넘기기',wide:true}
  ]);
}
function scoreView(kind) {
  const groups = rankScores(game.scores, PLAYERS);
  return shell(`<div class="stage-body"><span class="eyebrow">SCORE BREAK</span><h2>${kind === 'tmi' ? 'TMI 중간 순위' : '이미지 게임 결과'}</h2><div class="score-grid">${groups.flatMap(group => group.players).map(player => `<article class="score-card"><b>${player.name}</b><strong>${player.total}</strong><span>TMI ${player.tmi} · 이미지 ${player.pointing}</span></article>`).join('')}</div></div>`, [{action:kind==='tmi'?'after-tmi-score':'cards-start',label:kind==='tmi' ? ((game.tmi?.index ?? 0) >= 39 ? '이미지 게임 시작' : '다음 사람 TMI') : '대화 카드 시작',wide:true,primary:true}]);
}
function pointingInfo() {
  const state = game.pointing || {}; const question = POINTING_QUESTIONS[state.index]; const key = question ? `pointing-${question.id}` : '';
  const votes = {}; PLAYERS.forEach(player => { const live=players[player.slug]?.live; if(live?.game==='pointing'&&live.key===key&&live.value) votes[player.slug]=live.value; });
  return {state,question,key,votes,count:Object.keys(votes).length};
}
function pointingView() {
  const {state,question,votes,count} = pointingInfo(); if (!question) return scoreView('pointing');
  const counts = Object.values(votes).reduce((map,slug) => ({...map,[slug]:(map[slug]||0)+1}),{}); const blocked=!allOnline();
  return shell(`<div class="stage-body"><span class="eyebrow">IMAGE GAME · ${state.index + 1}/15</span><h2 class="question-title">${esc(question.text)}</h2>${blocked?'<div class="offline-note">모두 재접속하기 전 공개와 다음 진행이 차단됩니다.</div>':''}${state.revealed ? `<div class="result-bars">${PLAYERS.map(player=>`<div class="result-row" style="--person:${player.color}"><span>${player.name}</span><div class="bar"><span style="width:${(counts[player.slug]||0)*25}%"></span></div><b>${counts[player.slug]||0}</b></div>`).join('')}</div><p>개인 투표자는 공개하지 않습니다.</p>`:'<p>각 참가자는 본인을 제외한 세 명 중 한 명을 고릅니다.</p>'}<p><b>${count}/4 응답</b></p></div>`, [
    {action:'pointing-reveal',label:'결과 공개',wide:true,primary:true,disabled:state.revealed||count!==4||blocked},{action:'pointing-next',label:state.index===14?'이미지 게임 종료':'다음 질문',wide:true,disabled:!state.revealed||blocked}
  ]);
}
function cardsView() {
  const state=game.cards||{}; const index=Number(state.index||0); if(index>=20) return shell('<div class="stage-body"><h2>20장 대화 완료!</h2><p>가족 모두 다섯 번씩 이야기를 나눴습니다.</p></div>',[{action:'final',label:'최종 시상',wide:true,primary:true}]);
  const cardId=state.order?.[index]; const card=TALK_CARDS.find(item=>item.id===cardId); const speaker=PLAYERS[index%4];
  const elapsed=state.timerStartedAt?Math.floor((Date.now()-state.timerStartedAt)/1000):0; const remain=Math.max(0,120-elapsed); const timer=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(remain%60).padStart(2,'0')}`;
  return shell(`<div class="stage-body"><span class="eyebrow">CARD ${index+1}/20 · ${speaker.name} · 개인 ${Math.floor(index/4)+1}/5</span><div class="card-scene"><div class="talk-card ${state.flipped?'flipped':''}" data-action="card-flip"><div class="card-face"><h2>${speaker.name}의 카드</h2><p>터치해서 질문 보기</p></div><div class="card-face back"><p>${esc(card?.text||'카드를 준비 중입니다.')}</p></div></div></div><div class="timer">${timer}</div></div>`, [
    {action:'card-flip',label:state.flipped?'앞면 보기':'카드 뒤집기'},{action:'card-timer',label:state.timerStartedAt?'타이머 재시작':'2분 타이머'},{action:'card-replace',label:`교체 (${state.replaced?.[speaker.slug]?'사용함':'1회'})`,disabled:Boolean(state.replaced?.[speaker.slug])},{action:'card-complete',label:'이 카드 완료',wide:true,primary:true,disabled:!state.flipped}
  ]);
}
function finalView() {
  const groups=rankScores(game.scores,PLAYERS).slice(0,3);
  return shell(`<div class="stage-body"><span class="eyebrow">FINAL CEREMONY</span><h2>우리 가족 최종 결과</h2><div class="podium">${groups.map((group,index)=>`<div class="podium-group"><strong>${group.tied?'':`${index+1}위`}</strong>${group.players.map(player=>`<h3>${player.name}</h3>`).join('')}<b>${group.total}점</b><small>${group.players.map(p=>`TMI ${p.tmi} · 이미지 ${p.pointing}`).join(' / ')}</small></div>`).join('')}</div></div><div class="confetti">${Array.from({length:30},(_,i)=>`<i style="left:${(i*37)%100}%;animation-delay:${(i%10)*.2}s;background:${PLAYERS[i%4].color}"></i>`).join('')}</div>`,[{action:'end',label:'행사 종료',wide:true,primary:true}]);
}
function endedView(){return shell('<div class="stage-body"><span class="eyebrow">THANK YOU</span><h2>오늘도 우리 가족, 완료!</h2><p>함께 웃고 이야기한 시간이 최종 상품입니다.</p></div>',[]);}
function render() {
  clearInterval(clockTimer); if(!unlocked)return pinScreen();
  const views={collecting:collectingView,rules:rulesView,tmi:tmiView,tmi_score:()=>scoreView('tmi'),pointing:pointingView,pointing_score:()=>scoreView('pointing'),cards:cardsView,final:finalView,ended:endedView};
  app.innerHTML=(views[game.phase]||collectingView)(); bindActions();
  if(game.phase==='cards'&&game.cards?.timerStartedAt) clockTimer=setInterval(()=>{const timer=app.querySelector('.timer');if(timer){const remain=Math.max(0,120-Math.floor((Date.now()-game.cards.timerStartedAt)/1000));timer.textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(remain%60).padStart(2,'0')}`;}},1000);
}
function startGame() {
  const answers=Object.fromEntries(PLAYERS.map(player=>[player.slug,players[player.slug]?.answers||[]]));
  try { const rounds=buildTmiRounds({players:PLAYERS,questions:TMI_QUESTIONS,answers}); save({phase:'tmi',locked:true,tmi:{rounds,index:0,started:false,revealed:false,paused:false},scores:emptyScores(),scoredKeys:[],awardedKeys:[],offlineMessage:null}); }
  catch(error){showError(new Error(`문제를 만들 수 없습니다: ${error.message}`));}
}
function nextTmi(invalid=false) {
  const state=game.tmi; const index=state.index;
  if(index%10===9) save({phase:'tmi_score',tmi:{...state,revealed:false,started:false,invalid}});
  else save({tmi:{...state,index:index+1,revealed:false,started:true,paused:false},tmiSelections:null,responseCount:0});
}
function revealTmi() {
  const {state,round,selections,count}=tmiInfo(); if(count!==3||!allOnline()||state.revealed)return;
  const scores=structuredClone(game.scores); const scored=[...game.scoredKeys];
  if(!scored.includes(round.id)){Object.entries(selections).forEach(([slug,value])=>{scores[slug].tmi+=scoreTmiAnswer(value,round.correctAnswer);});scored.push(round.id);}
  save({scores,scoredKeys:scored,tmi:{...state,revealed:true},tmiSelections:selections,responseCount:count,offlineMessage:null});
}
function revealPointing() {
  const {state,question,key,votes,count}=pointingInfo();if(count!==4||!allOnline()||state.revealed)return;
  let scores=game.scores;const awarded=[...game.awardedKeys];let counts={};
  if(!awarded.includes(key)){const next=awardPointingQuestion(scores,votes);counts=next.__counts;scores=next;awarded.push(key);}else counts=Object.values(votes).reduce((m,s)=>({...m,[s]:(m[s]||0)+1}),{});
  save({scores,awardedKeys:awarded,pointing:{...state,revealed:true},pointingCounts:counts,responseCount:count,offlineMessage:null});
}
function bindActions(){app.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>handle(button.dataset.action)));}
function handle(action) {
  sound();
  if(action==='mute'){muted=!muted;localStorage.setItem('family-admin-muted',muted?'yes':'no');render();return;}
  if(action==='lock-admin'){unlocked=false;sessionStorage.removeItem('family-admin-unlocked');render();return;}
  if(action==='rules')return save({phase:'rules',rulesSlide:0});
  if(action==='rules-prev')return save({rulesSlide:Math.max(0,(game.rulesSlide||0)-1)});
  if(action==='rules-next')return save({rulesSlide:Math.min(4,(game.rulesSlide||0)+1)});
  if(action==='back-collecting')return save({phase:'collecting'});
  if(action==='start')return startGame();
  if(action==='tmi-start')return save({tmi:{...game.tmi,started:true,paused:false}});
  if(action==='tmi-pause')return save({tmi:{...game.tmi,paused:!game.tmi.paused}});
  if(action==='tmi-reveal')return revealTmi();
  if(action==='tmi-next')return nextTmi();
  if(action==='tmi-invalid'){if(confirm('이 문제를 점수 없이 넘길까요?'))return nextTmi(true);return;}
  if(action==='after-tmi-score'){if(game.tmi.index>=39)return save({phase:'pointing',pointing:{index:0,revealed:false}});return save({phase:'tmi',tmi:{...game.tmi,index:game.tmi.index+1,started:true,revealed:false,paused:false},tmiSelections:null,responseCount:0});}
  if(action==='pointing-reveal')return revealPointing();
  if(action==='pointing-next'){if(game.pointing.index>=14)return save({phase:'pointing_score'});return save({pointing:{index:game.pointing.index+1,revealed:false},pointingCounts:null,responseCount:0});}
  if(action==='cards-start')return save({phase:'cards',cards:{order:shuffle(TALK_CARDS.map(card=>card.id)),index:0,flipped:false,timerStartedAt:null,replaced:{},completed:[]}});
  if(action==='card-flip')return save({cards:{...game.cards,flipped:!game.cards.flipped}});
  if(action==='card-timer')return save({cards:{...game.cards,timerStartedAt:Date.now()}});
  if(action==='card-replace'){const cards=structuredClone(game.cards);const speaker=PLAYERS[cards.index%4];if(cards.replaced[speaker.slug])return;let swap=cards.index+4;if(swap>=20)swap=cards.index+1;if(swap>=20)return;[cards.order[cards.index],cards.order[swap]]=[cards.order[swap],cards.order[cards.index]];cards.replaced[speaker.slug]=true;cards.flipped=false;cards.timerStartedAt=null;return save({cards});}
  if(action==='card-complete'){const cards={...game.cards,index:game.cards.index+1,flipped:false,timerStartedAt:null,completed:[...(game.cards.completed||[]),game.cards.order[game.cards.index]]};return save({cards});}
  if(action==='final')return save({phase:'final'});
  if(action==='end')return save({phase:'ended'});
}
function sound(){if(muted)return;try{const context=new AudioContext();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.frequency.value=660;gain.gain.setValueAtTime(.04,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.08);oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.08);}catch{}}
async function poll(){const epochAtStart=writeEpoch;const values=[await store.read(FAMILY_STATE.game)];for(const player of PLAYERS)values.push(await store.read(FAMILY_STATE.players[player.slug]));if(epochAtStart===writeEpoch)game=normalizeGame(values[0]);players=Object.fromEntries(PLAYERS.map((player,index)=>[player.slug,values[index+1]]));clearError();if(game.phase==='tmi'){const info=tmiInfo();game.responseCount=info.count;game.offlineMessage=allOnline()?null:'오프라인 참가자가 있어 모두 재접속할 때까지 기다립니다.';}if(game.phase==='pointing'){const info=pointingInfo();game.responseCount=info.count;game.offlineMessage=allOnline()?null:'오프라인 참가자가 있어 모두 재접속할 때까지 기다립니다.';}if(unlocked)render();}
retry.addEventListener('click',()=>poll().catch(showError));
render();startPolling(poll,{interval:POLL_MS,onError:showError});
