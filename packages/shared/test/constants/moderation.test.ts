import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REPORT_CONTENT_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_REASON_LABEL,
} from '../../src/constants/moderation'

test('report enums are non-empty and duplicate-free', () => {
  for (const list of [REPORT_CONTENT_TYPES, REPORT_REASONS, REPORT_STATUSES]) {
    assert.ok(list.length > 0)
    assert.equal(new Set(list).size, list.length)
  }
})

test('REPORT_REASON_LABEL: has a non-empty label for every reason and no extras', () => {
  const labelKeys = Object.keys(REPORT_REASON_LABEL).sort()
  assert.deepEqual(labelKeys, [...REPORT_REASONS].sort())
  for (const reason of REPORT_REASONS) {
    assert.ok(REPORT_REASON_LABEL[reason].length > 0, `${reason} label`)
  }
})
