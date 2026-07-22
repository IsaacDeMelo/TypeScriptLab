import { randomBytes, scryptSync } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { RPG, Review, ReviewInput, Tag, User } from './types'

const DB_PATH = join(__dirname, 'data', 'db.json')

interface DbData {
  rpgs: RPG[]
  reviews: (Omit<Review, 'rpg'> & { rpgName: string })[]
  users: User[]
  nextId: number
  nextRpgId: number
  sessions: Record<string, string>
}

let db: DbData
let sessions = new Map<string, string>()

function loadDb(): DbData {
  if (existsSync(DB_PATH)) {
    return JSON.parse(readFileSync(DB_PATH, 'utf-8'))
  }
  return { rpgs: [], reviews: [], users: [], nextId: 1, nextRpgId: 1, sessions: {} }
}

function saveDb() {
  db.sessions = Object.fromEntries(sessions)
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

function restoreSessions() {
  if (db.sessions) {
    sessions = new Map(Object.entries(db.sessions))
  }
}

db = loadDb()
restoreSessions()

let migrated = false
for (const r of db.reviews) {
  if (!r.status) {
    r.status = 'approved'
    migrated = true
  }
}
if (!db.rpgs.some(r => r.featured) && db.rpgs.length > 0) {
  db.rpgs[0].featured = true
  migrated = true
}
for (const r of db.rpgs) {
  if (!r.tags) {
    r.tags = []
    migrated = true
  }
}
if (migrated) saveDb()

function resolveRpg(rpgName: string): RPG | undefined {
  return db.rpgs.find(r => r.name === rpgName)
}

export function getRpgByName(name: string): RPG | undefined {
  return resolveRpg(name)
}

export function getRpgs(): RPG[] {
  return [...db.rpgs]
}

function calcTimeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora mesmo'
  if (mins < 60) return `${mins} min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h atrás`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d atrás`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mês atrás`
  return `${Math.floor(months / 12)} ano atrás`
}

function reviewStatus(r: { status?: string }): string {
  return r.status || 'approved'
}

export function getReviews(all?: boolean): Review[] {
  return db.reviews
    .filter(r => all || reviewStatus(r) === 'approved')
    .map(r => ({
      ...r,
      status: (reviewStatus(r) as any),
      timeAgo: calcTimeAgo(r.createdAt),
      rpg: resolveRpg(r.rpgName) || db.rpgs[0],
    }))
}

export function getPendingReviews(): Review[] {
  return db.reviews
    .filter(r => reviewStatus(r) === 'pending')
    .map(r => ({
      ...r,
      status: (reviewStatus(r) as any),
      timeAgo: calcTimeAgo(r.createdAt),
      rpg: resolveRpg(r.rpgName) || db.rpgs[0],
    }))
}

export function addReview(input: ReviewInput, username: string): Review {
  const rpg = resolveRpg(input.rpgName) || db.rpgs[0]
  const now = new Date().toISOString()
  const user = db.users.find(u => u.username === username)
  const isAdmin = user?.role === 'admin'
  const review = {
    id: String(db.nextId++),
    rpgName: input.rpgName,
    username,
    rating: input.rating,
    comment: input.comment,
    createdAt: now,
    timeAgo: 'Agora mesmo',
    status: (isAdmin ? 'approved' : 'pending') as 'approved' | 'pending',
  } as (Omit<Review, 'rpg'> & { rpgName: string })
  if (input.customImage) {
    ;(review as any).customImage = input.customImage
  }
  db.reviews.unshift(review)
  saveDb()
  return { ...review, rpg }
}

export function approveReview(reviewId: string): Review | undefined {
  const r = db.reviews.find(r => r.id === reviewId)
  if (!r) return undefined
  r.status = 'approved'
  saveDb()
  return { ...r, rpg: resolveRpg(r.rpgName) || db.rpgs[0], timeAgo: calcTimeAgo(r.createdAt) }
}

export function rejectReview(reviewId: string): boolean {
  const r = db.reviews.find(r => r.id === reviewId)
  if (!r) return false
  r.status = 'rejected'
  saveDb()
  return true
}

export function deleteReviewById(reviewId: string, username: string, isAdmin: boolean): boolean {
  const idx = db.reviews.findIndex(r => r.id === reviewId)
  if (idx === -1) return false
  const review = db.reviews[idx]
  if (review.username !== username && !isAdmin) return false
  db.reviews.splice(idx, 1)
  saveDb()
  return true
}

export function addRpg(input: Omit<RPG, 'banner'> & { banner?: string }): RPG {
  const rpg: RPG = {
    ...input,
    banner: input.banner || input.image,
    tags: input.tags || [],
  }
  db.rpgs.push(rpg)
  saveDb()
  return rpg
}

export function updateRpg(name: string, updates: Partial<RPG>): RPG | undefined {
  const idx = db.rpgs.findIndex(r => r.name === name)
  if (idx === -1) return undefined
  db.rpgs[idx] = { ...db.rpgs[idx], ...updates, name: db.rpgs[idx].name }
  saveDb()
  return db.rpgs[idx]
}

export function toggleFeaturedRpg(name: string): RPG | undefined {
  const rpg = db.rpgs.find(r => r.name === name)
  if (!rpg) return undefined
  rpg.featured = !rpg.featured
  saveDb()
  return { ...rpg }
}

export function deleteRpg(name: string): boolean {
  const idx = db.rpgs.findIndex(r => r.name === name)
  if (idx === -1) return false
  db.rpgs.splice(idx, 1)
  saveDb()
  return true
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verify = scryptSync(password, salt, 64).toString('hex')
  return hash === verify
}

export function registerUser(username: string, password: string, contact?: string): { user: User; token: string } | { error: string } {
  if (db.users.find(u => u.username === username)) {
    return { error: 'Usuário já existe.' }
  }

  const isFirst = db.users.length === 0
  const user: User = {
    id: String(db.users.length + 1),
    username,
    passwordHash: hashPassword(password),
    role: isFirst ? 'admin' : 'user',
    contact: contact || undefined,
  }

  db.users.push(user)
  saveDb()

  const token = randomBytes(32).toString('hex')
  sessions.set(token, user.id)

  return { user, token }
}

export function loginUser(username: string, password: string): { user: User; token: string } | { error: string } {
  const user = db.users.find(u => u.username === username)
  if (!user) {
    return { error: 'Usuário não encontrado.' }
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return { error: 'Senha incorreta.' }
  }

  const token = randomBytes(32).toString('hex')
  sessions.set(token, user.id)

  return { user, token }
}

export function getUsers(): (Omit<User, 'passwordHash'>)[] {
  return db.users.map(({ passwordHash, ...u }) => u)
}

export function getUserByToken(token: string): User | undefined {
  const userId = sessions.get(token)
  if (!userId) return undefined
  return db.users.find(u => u.id === userId)
}

export function updateProfile(userId: string, data: { bio?: string; avatar?: string }): User | undefined {
  const user = db.users.find(u => u.id === userId)
  if (!user) return undefined
  if (data.bio !== undefined) user.bio = data.bio
  if (data.avatar !== undefined) user.avatar = data.avatar
  saveDb()
  return { ...user }
}

export function logoutUser(token: string): void {
  sessions.delete(token)
}
