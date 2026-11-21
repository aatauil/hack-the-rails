// Bookings kept in a JSON file. Fine for a single dev server; swap for a database before launch.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'bookings.json')
let cache = null
let writing = Promise.resolve()

async function load() {
  if (cache) return cache
  try {
    cache = JSON.parse(await readFile(FILE, 'utf8'))
  } catch {
    cache = {}
  }
  return cache
}

export async function getBooking(id) {
  return (await load())[id] ?? null
}

export async function findByPaymentIntent(paymentIntentId) {
  return Object.values(await load()).find((b) => b.paymentIntentId === paymentIntentId) ?? null
}

export async function saveBooking(booking) {
  const all = await load()
  all[booking.id] = booking
  // Writes are queued and atomic (temp file + rename) so concurrent requests can't corrupt the file.
  writing = writing.then(async () => {
    await mkdir(dirname(FILE), { recursive: true })
    await writeFile(`${FILE}.tmp`, JSON.stringify(all, null, 2))
    await rename(`${FILE}.tmp`, FILE)
  })
  return writing
}
