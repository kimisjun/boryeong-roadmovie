const normalize = value => String(value ?? '').trim();

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function buildChoiceSet({familyAnswers, correctAnswer, fallback, random = Math.random}) {
  const correct = normalize(correctAnswer);
  if (!correct) throw new Error('Correct answer is required');
  const unique = [];
  const add = value => {
    const normalized = normalize(value);
    if (normalized && !unique.includes(normalized)) unique.push(normalized);
  };
  (familyAnswers || []).forEach(add);
  add(correct);
  (fallback || []).forEach(value => {
    if (unique.length < 5) add(value);
  });
  if (unique.length < 5) throw new Error('Not enough unique choices');
  return shuffle(unique.slice(0, 5), random);
}

export function eligibleTmiVoters(players, targetSlug) {
  return players.filter(player => player.slug !== targetSlug).map(player => player.slug);
}

export function buildTmiRounds({players, questions, answers, random = Math.random}) {
  return players.flatMap(target => questions.map((question, questionIndex) => {
    const familyAnswers = players.map(player => answers[player.slug]?.[questionIndex]);
    const correctAnswer = normalize(answers[target.slug]?.[questionIndex]);
    return {
      id: `tmi-${target.slug}-${question.id}`,
      target: target.slug,
      questionId: question.id,
      question: question.text,
      choices: buildChoiceSet({familyAnswers, correctAnswer, fallback: question.fallback, random}),
      correctAnswer,
      voters: eligibleTmiVoters(players, target.slug)
    };
  }));
}

export function scoreTmiAnswer(selection, correctAnswer) {
  const selected = normalize(selection);
  return selected && selected === normalize(correctAnswer) ? 1 : 0;
}

export function awardPointingQuestion(scores, votes) {
  const next = Object.fromEntries(Object.entries(scores).map(([slug, value]) => [slug, {...value}]));
  const counts = {};
  Object.values(votes || {}).forEach(selection => {
    if (next[selection]) counts[selection] = (counts[selection] || 0) + 1;
  });
  const high = Math.max(0, ...Object.values(counts));
  const leaders = high ? Object.keys(counts).filter(slug => counts[slug] === high) : [];
  leaders.forEach(slug => { next[slug].pointing = Number(next[slug].pointing || 0) + 1; });
  Object.defineProperty(next, '__leaders', {value: leaders, enumerable: false});
  Object.defineProperty(next, '__counts', {value: counts, enumerable: false});
  return next;
}

export function rankScores(scores, players) {
  const rows = players.map(player => {
    const score = scores[player.slug] || {};
    const tmi = Number(score.tmi || 0);
    const pointing = Number(score.pointing || 0);
    return {...player, tmi, pointing, total: tmi + pointing};
  }).sort((a, b) => b.total - a.total);
  const groups = [];
  rows.forEach(player => {
    const group = groups.find(item => item.total === player.total);
    if (group) group.players.push(player);
    else groups.push({total: player.total, players:[player], tied:false});
  });
  groups.forEach(group => { group.tied = group.players.length > 1; });
  return groups;
}

export function dealConversationCards(cards, players, countPerPlayer, random = Math.random) {
  const needed = players.length * countPerPlayer;
  if (cards.length < needed) throw new Error('Not enough cards');
  const deck = shuffle(cards, random).slice(0, needed);
  return Object.fromEntries(players.map((player, playerIndex) => [
    player.slug,
    deck.slice(playerIndex * countPerPlayer, (playerIndex + 1) * countPerPlayer)
  ]));
}

export function submissionStatus(players, playerStates = {}) {
  return Object.fromEntries(players.map(player => [player.slug, Boolean(playerStates[player.slug]?.submitted)]));
}

export function tmiInteractionState({started = false, paused = false, revealed = false} = {}) {
  if (!started) return 'waiting';
  if (paused) return 'paused';
  return revealed ? 'revealed' : 'answering';
}
