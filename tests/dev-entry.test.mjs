import test from 'node:test'
import assert from 'node:assert/strict'
import {sandboxMemberId} from '../data/dev-entry.mjs'

test('local compile parameters select a test member without changing production identity', () => {
  assert.equal(sandboxMemberId({member:'101'}, true), 101)
  assert.equal(sandboxMemberId({member:'301'}, true), 301)
  assert.equal(sandboxMemberId({member:'101'}, false), 201)
  assert.equal(sandboxMemberId({}, true), 201)
  assert.equal(sandboxMemberId({member:'-1'}, true), 201)
  assert.equal(sandboxMemberId({member:'not-a-member'}, true), 201)
})
