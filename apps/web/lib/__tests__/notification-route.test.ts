/**
 * Web's routing table over the shared screen vocabulary. The nulls are as
 * load-bearing as the routes: exchange (S6.4), dispute (S6.1) and
 * fiat-intent have no web surface yet, and a null keeps the row from
 * navigating to a 404.
 */
import { expect, test } from 'vitest'
import { notificationRoute } from '@/lib/notification-route'

test('escrow notices route to the gig detail; exchange kind stays put until S6.4', () => {
  expect(notificationRoute({ screen: 'escrow', escrowId: 'e1', kind: 'gig' })).toBe('/gig/e1')
  expect(notificationRoute({ screen: 'escrow', escrowId: 'e1' })).toBe('/gig/e1') // legacy no-kind
  expect(notificationRoute({ screen: 'escrow', escrowId: 'e1', kind: 'exchange' })).toBeNull()
})

test('chat notices route to the thread', () => {
  expect(notificationRoute({ screen: 'chat', userId: 'u1' })).toBe('/chat/u1')
})

test('dispute and fiat-intent are non-navigable until their surfaces land', () => {
  expect(notificationRoute({ screen: 'dispute', escrowId: 'e1' })).toBeNull()
  expect(notificationRoute({ screen: 'fiat-intent', escrowId: 'e1' })).toBeNull()
})

test('null data, unknown screens, and missing ids never produce a route', () => {
  expect(notificationRoute(null)).toBeNull()
  expect(notificationRoute({ screen: 'escrow' })).toBeNull() // no escrowId
  expect(notificationRoute({ screen: 'chat' })).toBeNull() // no userId
  expect(notificationRoute({ screen: 'mystery', escrowId: 'e1' })).toBeNull()
})
