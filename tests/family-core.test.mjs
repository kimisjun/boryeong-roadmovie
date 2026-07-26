import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChoiceSet,
  buildTmiRounds,
  eligibleTmiVoters,
  scoreTmiAnswer,
  awardPointingQuestion,
  rankScores,
  dealConversationCards,
  submissionStatus,
  tmiInteractionState
} from '../family-core.mjs';

const players = [
  {slug:'eunjun', name:'은준'},
  {slug:'haeun', name:'하은'},
  {slug:'yunhee', name:'윤희'},
  {slug:'hyunshin', name:'현신'}
];
const zeroRandom = () => 0;

test('buildChoiceSet creates five unique choices containing the target answer', () => {
  const result = buildChoiceSet({
    familyAnswers:['복숭아','수박','딸기','사과'],
    correctAnswer:'수박',
    fallback:['망고','포도'],
    random:zeroRandom
  });
  assert.equal(result.length, 5);
  assert.equal(new Set(result).size, 5);
  assert.ok(result.includes('수박'));
  assert.ok(result.includes('망고'));
});

test('buildChoiceSet fills duplicate family answers from fallback choices', () => {
  const result = buildChoiceSet({
    familyAnswers:['파랑','파랑','검정','검정'],
    correctAnswer:'파랑',
    fallback:['보라','초록','주황','노랑'],
    random:zeroRandom
  });
  assert.deepEqual(new Set(result).size, 5);
  assert.ok(result.includes('파랑'));
  assert.ok(result.includes('검정'));
});

test('buildChoiceSet rejects an empty correct answer', () => {
  assert.throws(() => buildChoiceSet({familyAnswers:['사과'], correctAnswer:' ', fallback:['배']}), /correct answer/i);
});

test('buildTmiRounds creates forty rounds in the agreed participant order', () => {
  const questions = Array.from({length:10}, (_, index) => ({
    id:`q${index + 1}`,
    text:`질문 ${index + 1}`,
    fallback:['예비1','예비2','예비3','예비4','예비5']
  }));
  const answers = Object.fromEntries(players.map((player, playerIndex) => [
    player.slug,
    questions.map((_, questionIndex) => `${player.name}-${questionIndex + 1}-${playerIndex}`)
  ]));
  const rounds = buildTmiRounds({players, questions, answers, random:zeroRandom});
  assert.equal(rounds.length, 40);
  assert.deepEqual(rounds.slice(0, 10).map(round => round.target), Array(10).fill('eunjun'));
  assert.equal(rounds[10].target, 'haeun');
  assert.equal(rounds[20].target, 'yunhee');
  assert.equal(rounds[30].target, 'hyunshin');
  assert.equal(rounds.every(round => round.choices.length === 5), true);
  assert.equal(rounds.every(round => round.choices.includes(round.correctAnswer)), true);
});

test('eligibleTmiVoters excludes only the target participant', () => {
  assert.deepEqual(eligibleTmiVoters(players, 'yunhee'), ['eunjun','haeun','hyunshin']);
});

test('scoreTmiAnswer awards one point only for an exact correct choice', () => {
  assert.equal(scoreTmiAnswer('수박', '수박'), 1);
  assert.equal(scoreTmiAnswer('사과', '수박'), 0);
  assert.equal(scoreTmiAnswer('', '수박'), 0);
});

test('awardPointingQuestion gives one point to every tied leader', () => {
  const scores = Object.fromEntries(players.map(player => [player.slug, {tmi:0, pointing:0}]));
  const votes = {eunjun:'yunhee', haeun:'hyunshin', yunhee:'hyunshin', hyunshin:'yunhee'};
  const result = awardPointingQuestion(scores, votes);
  assert.equal(result.yunhee.pointing, 1);
  assert.equal(result.hyunshin.pointing, 1);
  assert.equal(result.eunjun.pointing, 0);
  assert.deepEqual(result.__leaders.sort(), ['hyunshin','yunhee']);
});

test('rankScores groups tied totals onto the same podium tier', () => {
  const ranked = rankScores({
    eunjun:{tmi:10, pointing:2},
    haeun:{tmi:9, pointing:3},
    yunhee:{tmi:8, pointing:1},
    hyunshin:{tmi:5, pointing:2}
  }, players);
  assert.equal(ranked[0].total, 12);
  assert.deepEqual(ranked[0].players.map(player => player.slug), ['eunjun','haeun']);
  assert.equal(ranked[0].tied, true);
  assert.equal(ranked[1].total, 9);
});

test('dealConversationCards deals five unique cards to each person', () => {
  const cards = Array.from({length:20}, (_, index) => ({id:`c${index + 1}`, text:`카드 ${index + 1}`}));
  const dealt = dealConversationCards(cards, players, 5, zeroRandom);
  assert.deepEqual(Object.values(dealt).map(items => items.length), [5,5,5,5]);
  const ids = Object.values(dealt).flat().map(card => card.id);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20);
});

test('dealConversationCards rejects a deck that is too small', () => {
  assert.throws(() => dealConversationCards([{id:'one'}], players, 5), /not enough cards/i);
});

test('submissionStatus reports every family member from read-only peer states', () => {
  const states = {
    eunjun:{submitted:true}, haeun:{submitted:false}, yunhee:{submitted:true}, hyunshin:{submitted:true}
  };
  assert.deepEqual(submissionStatus(players, states), {
    eunjun:true, haeun:false, yunhee:true, hyunshin:true
  });
});

test('tmiInteractionState hides questions before start and while paused', () => {
  assert.equal(tmiInteractionState({started:false, paused:false, revealed:false}), 'waiting');
  assert.equal(tmiInteractionState({started:true, paused:true, revealed:false}), 'paused');
  assert.equal(tmiInteractionState({started:true, paused:false, revealed:false}), 'answering');
  assert.equal(tmiInteractionState({started:true, paused:false, revealed:true}), 'revealed');
});
