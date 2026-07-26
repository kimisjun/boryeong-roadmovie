import test from 'node:test';
import assert from 'node:assert/strict';
import {JsonBlobStore} from '../family-store.mjs';

test('JsonBlobStore reads JSON with cache disabled', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    return {ok:true, json:async () => ({phase:'collecting'})};
  };
  const store = new JsonBlobStore({fetchImpl, now:() => 123});
  const state = await store.read('https://example.test/state');
  assert.deepEqual(state, {phase:'collecting'});
  assert.match(calls[0].url, /_t=123/);
  assert.equal(calls[0].options.cache, 'no-store');
});

test('JsonBlobStore writes JSON and stamps updatedAt', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = {url, options};
    return {ok:true, text:async () => ''};
  };
  const store = new JsonBlobStore({fetchImpl, now:() => 456});
  await store.write('https://example.test/state', {phase:'tmi'});
  assert.equal(request.options.method, 'PUT');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), {phase:'tmi', updatedAt:456});
});

test('JsonBlobStore throws a useful error on failed responses', async () => {
  const fetchImpl = async () => ({ok:false, status:503, text:async () => 'offline'});
  const store = new JsonBlobStore({fetchImpl});
  await assert.rejects(() => store.read('https://example.test/state'), /503.*offline/);
  await assert.rejects(() => store.write('https://example.test/state', {}), /503.*offline/);
});

test('JsonBlobStore calls browser fetch without rebinding its receiver', async () => {
  let receiver;
  async function browserLikeFetch() {
    'use strict';
    receiver = this;
    return {ok:true, json:async () => ({phase:'collecting'})};
  }
  const store = new JsonBlobStore({fetchImpl:browserLikeFetch});
  await store.read('https://example.test/state');
  assert.equal(receiver, undefined);
});

test('JsonBlobStore update reads latest state before merging', async () => {
  const bodies = [];
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      bodies.push(JSON.parse(options.body));
      return {ok:true, text:async () => ''};
    }
    return {ok:true, json:async () => ({answers:['a'], submitted:false})};
  };
  const store = new JsonBlobStore({fetchImpl, now:() => 789});
  const result = await store.update('https://example.test/player', current => ({...current, submitted:true}));
  assert.equal(result.submitted, true);
  assert.deepEqual(result.answers, ['a']);
  assert.equal(bodies[0].submitted, true);
});
