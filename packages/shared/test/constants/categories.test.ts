import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORY_LABELS, CATEGORY_META, GIG_CATEGORIES } from '../../src/constants/categories'

test('GIG_CATEGORIES: non-empty, duplicate-free, all lowercase slugs', () => {
  assert.ok(GIG_CATEGORIES.length > 0)
  assert.equal(new Set(GIG_CATEGORIES).size, GIG_CATEGORIES.length)
  for (const c of GIG_CATEGORIES) assert.match(c, /^[a-z]+$/)
})

test('CATEGORY_LABELS: every category has a non-empty label, and photo reads "Creative"', () => {
  for (const category of GIG_CATEGORIES) {
    assert.equal(typeof CATEGORY_LABELS[category], 'string')
    assert.notEqual(CATEGORY_LABELS[category], '')
  }
  assert.equal(CATEGORY_LABELS.photo, 'Creative')
})

test('CATEGORY_META: one entry per category, labels sourced from CATEGORY_LABELS', () => {
  assert.deepEqual(CATEGORY_META.map((meta) => meta.key), [...GIG_CATEGORIES])
  for (const meta of CATEGORY_META) {
    assert.equal(meta.label, CATEGORY_LABELS[meta.key])
    assert.notEqual(meta.icon, '')
    assert.match(meta.colorToken, /^category[A-Z]/)
  }
})

test('CATEGORY_META: pins the micro-task-weight icon decision (Bike not Truck, Laptop not Monitor)', () => {
  const iconOf = (key: string) => CATEGORY_META.find((meta) => meta.key === key)?.icon
  assert.equal(iconOf('delivery'), 'Bike')
  assert.equal(iconOf('digital'), 'Laptop')
  assert.equal(iconOf('photo'), 'Camera')
  assert.equal(iconOf('errand'), 'ShoppingBag')
  assert.equal(iconOf('service'), 'Wrench')
})
