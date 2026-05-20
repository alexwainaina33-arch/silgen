import { openDB } from 'idb'

const DB_NAME    = 'silgen_offline'
const DB_VERSION = 1
const STORE      = 'queue'

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    },
  })
}

/**
 * Add an action to the offline queue.
 * @param {'cart_add'|'cart_remove'|'cart_update'|'wishlist_add'|'wishlist_remove'} type
 * @param {Object} payload
 */
export async function enqueue(type, payload) {
  try {
    const db = await getDB()
    await db.add(STORE, { type, payload, createdAt: Date.now() })
  } catch (err) {
    console.warn('[OfflineQueue] enqueue failed:', err)
  }
}

/** Get all queued actions */
export async function getQueue() {
  try {
    const db = await getDB()
    return await db.getAll(STORE)
  } catch {
    return []
  }
}

/** Remove a processed action by id */
export async function dequeue(id) {
  try {
    const db = await getDB()
    await db.delete(STORE, id)
  } catch (err) {
    console.warn('[OfflineQueue] dequeue failed:', err)
  }
}

/** Clear the entire queue */
export async function clearQueue() {
  try {
    const db = await getDB()
    await db.clear(STORE)
  } catch (err) {
    console.warn('[OfflineQueue] clearQueue failed:', err)
  }
}

/**
 * Process all queued actions when back online.
 * Pass a handler map: { cart_add: fn, cart_remove: fn, ... }
 */
export async function flushQueue(handlers = {}) {
  const items = await getQueue()
  if (!items.length) return

  console.log(`[OfflineQueue] Flushing ${items.length} queued actions`)

  for (const item of items) {
    try {
      if (handlers[item.type]) {
        await handlers[item.type](item.payload)
      }
      await dequeue(item.id)
    } catch (err) {
      console.warn(`[OfflineQueue] Failed to process ${item.type}:`, err)
    }
  }
}

/** Register online/offline listeners and auto-flush when reconnected */
export function registerConnectivityListeners(handlers = {}) {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Back online — flushing queue')
    flushQueue(handlers)
  })
}