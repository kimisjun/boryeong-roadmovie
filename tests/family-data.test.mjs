import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYERS, TMI_QUESTIONS, POINTING_QUESTIONS, TALK_CARDS} from '../family-data.mjs';

test('participant order and names match the agreed family order', () => {
  assert.deepEqual(PLAYERS.map(player => [player.slug, player.name]), [
    ['eunjun','은준'], ['haeun','하은'], ['yunhee','윤희'], ['hyunshin','현신']
  ]);
  assert.equal(new Set(PLAYERS.map(player => player.color)).size, 4);
});

test('TMI has exactly ten questions with enough unique fallback answers', () => {
  assert.equal(TMI_QUESTIONS.length, 10);
  assert.equal(new Set(TMI_QUESTIONS.map(question => question.id)).size, 10);
  TMI_QUESTIONS.forEach(question => {
    assert.ok(question.text.length > 0);
    assert.ok(new Set(question.fallback).size >= 5);
  });
});

test('pointing game has fifteen agreed questions', () => {
  assert.equal(POINTING_QUESTIONS.length, 15);
  assert.equal(new Set(POINTING_QUESTIONS.map(question => question.id)).size, 15);
  assert.equal(POINTING_QUESTIONS.filter(question => question.tone === 'positive').length, 7);
  assert.equal(POINTING_QUESTIONS.filter(question => question.tone === 'playful').length, 8);
});

test('conversation deck has exactly twenty unique cards', () => {
  assert.equal(TALK_CARDS.length, 20);
  assert.equal(new Set(TALK_CARDS.map(card => card.id)).size, 20);
  assert.equal(new Set(TALK_CARDS.map(card => card.text)).size, 20);
});
