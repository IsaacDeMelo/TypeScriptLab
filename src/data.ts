import { randomBytes, scryptSync } from 'crypto'
import Rpg from './models/Rpg'
import ReviewModel from './models/Review'
import UserModel from './models/User'
import SessionModel from './models/Session'
import { RPG, Review, ReviewInput, User } from './types'

export function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function calcTimeAgo(createdAt: string | Date): string {
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

function rpgFromDoc(doc: any): RPG {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    name: o.name,
    owner: o.owner,
    genre: o.genre,
    image: o.image,
    banner: o.banner || '',
    description: o.description,
    link: o.link,
    whatsapp: o.whatsapp,
    year: o.year,
    ageRating: o.ageRating,
    featured: o.featured ?? false,
    blurImage: o.blurImage ?? false,
    tags: o.tags || [],
  }
}

function reviewFromDoc(doc: any, rpg: RPG): Review {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    rpg,
    username: o.username,
    rating: o.rating,
    comment: o.comment,
    customImage: o.customImage,
    status: o.status || 'approved',
    timeAgo: calcTimeAgo(o.createdAt),
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
  }
}

function userFromDoc(doc: any): User {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    username: o.username,
    passwordHash: o.passwordHash,
    role: o.role,
    bio: o.bio,
    avatar: o.avatar,
    contact: o.contact,
  }
}

function userPublicFromDoc(doc: any): Omit<User, 'passwordHash'> {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    username: o.username,
    role: o.role,
    bio: o.bio,
    avatar: o.avatar,
    contact: o.contact,
  }
}

async function resolveRpg(rpgName: string): Promise<RPG | undefined> {
  const doc = await Rpg.findOne({ name: rpgName })
  return doc ? rpgFromDoc(doc) : undefined
}

async function firstRpg(): Promise<RPG | undefined> {
  const doc = await Rpg.findOne()
  return doc ? rpgFromDoc(doc) : undefined
}

export async function getRpgByName(name: string): Promise<RPG | undefined> {
  return resolveRpg(name)
}

export async function getRpgs(): Promise<RPG[]> {
  const docs = await Rpg.find()
  return docs.map(rpgFromDoc)
}

export async function getReviews(all?: boolean): Promise<Review[]> {
  const filter: Record<string, any> = all ? {} : { status: { $ne: 'rejected' } }
  const docs = await ReviewModel.find(filter).sort({ createdAt: -1 })
  const results: Review[] = []
  for (const doc of docs) {
    const rpg = await resolveRpg(doc.rpgName) || await firstRpg() || {} as RPG
    results.push(reviewFromDoc(doc, rpg!))
  }
  return results
}

export async function getPendingReviews(): Promise<Review[]> {
  const docs = await ReviewModel.find({ status: 'pending' }).sort({ createdAt: -1 })
  const results: Review[] = []
  for (const doc of docs) {
    const rpg = await resolveRpg(doc.rpgName) || await firstRpg() || {} as RPG
    results.push(reviewFromDoc(doc, rpg!))
  }
  return results
}

export async function addReview(input: ReviewInput, username: string): Promise<Review> {
  const rpg = await resolveRpg(input.rpgName) || await firstRpg() || {} as RPG
  const user = await UserModel.findOne({ username })
  const isAdmin = user?.role === 'admin'

  const doc = await ReviewModel.create({
    rpgName: input.rpgName,
    username,
    rating: input.rating,
    comment: input.comment,
    customImage: input.customImage || undefined,
    status: isAdmin ? 'approved' : 'pending',
  })

  return reviewFromDoc(doc, rpg!)
}

export async function approveReview(reviewId: string): Promise<Review | undefined> {
  const doc = await ReviewModel.findByIdAndUpdate(
    reviewId,
    { status: 'approved' },
    { new: true },
  )
  if (!doc) return undefined
  const rpg = await resolveRpg(doc.rpgName) || await firstRpg() || {} as RPG
  return reviewFromDoc(doc, rpg!)
}

export async function rejectReview(reviewId: string): Promise<boolean> {
  const doc = await ReviewModel.findByIdAndUpdate(reviewId, { status: 'rejected' })
  return !!doc
}

export async function deleteReviewById(reviewId: string, username: string, isAdmin: boolean): Promise<boolean> {
  const review = await ReviewModel.findById(reviewId)
  if (!review) return false
  if (review.username !== username && !isAdmin) return false
  await ReviewModel.findByIdAndDelete(reviewId)
  return true
}

export async function addRpg(input: Omit<RPG, 'banner'> & { banner?: string }): Promise<RPG> {
  const doc = await Rpg.create({
    ...input,
    banner: input.banner || input.image,
    tags: input.tags || [],
  })
  return rpgFromDoc(doc)
}

export async function updateRpg(name: string, updates: Partial<RPG>): Promise<RPG | undefined> {
  const rpg = await Rpg.findOne({ name })
  if (!rpg) return undefined
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      ;(rpg as any)[key] = null
    } else {
      ;(rpg as any)[key] = value
    }
  }
  await rpg.save()
  return rpgFromDoc(rpg)
}

export async function toggleFeaturedRpg(name: string): Promise<RPG | undefined> {
  const rpg = await Rpg.findOne({ name })
  if (!rpg) return undefined
  rpg.featured = !rpg.featured
  await rpg.save()
  return rpgFromDoc(rpg)
}

export async function deleteRpg(name: string): Promise<boolean> {
  const doc = await Rpg.findOneAndDelete({ name })
  return !!doc
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

export async function registerUser(username: string, password: string, contact?: string, avatar?: string): Promise<{ user: User; token: string } | { error: string }> {
  const existing = await UserModel.findOne({ username })
  if (existing) return { error: 'Usuário já existe.' }

  const count = await UserModel.countDocuments()
  const isFirst = count === 0

  const user = await UserModel.create({
    username,
    passwordHash: hashPassword(password),
    role: isFirst ? 'admin' : 'user',
    contact: contact || undefined,
    avatar: avatar || undefined,
  })

  const token = randomBytes(32).toString('hex')
  await SessionModel.create({ token, userId: String(user._id) })

  return { user: userFromDoc(user), token }
}

export async function loginUser(username: string, password: string): Promise<{ user: User; token: string } | { error: string }> {
  const user = await UserModel.findOne({ username })
  if (!user) return { error: 'Usuário não encontrado.' }

  if (!verifyPassword(password, user.passwordHash)) {
    return { error: 'Senha incorreta.' }
  }

  const token = randomBytes(32).toString('hex')
  await SessionModel.create({ token, userId: String(user._id) })

  return { user: userFromDoc(user), token }
}

export async function getUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const docs = await UserModel.find()
  return docs.map(userPublicFromDoc)
}

export async function getUserByToken(token: string): Promise<User | undefined> {
  const session = await SessionModel.findOne({ token })
  if (!session) return undefined
  const user = await UserModel.findById(session.userId)
  return user ? userFromDoc(user) : undefined
}

export async function updateProfile(userId: string, data: { bio?: string; avatar?: string }): Promise<User | undefined> {
  const user = await UserModel.findById(userId)
  if (!user) return undefined
  if (data.bio !== undefined) user.bio = data.bio
  if (data.avatar !== undefined) user.avatar = data.avatar
  await user.save()
  return userFromDoc(user)
}

export interface RpgRating {
  rpg: RPG
  avgRating: number
  reviewCount: number
  bayesianAvg: number
}

export async function getRpgRatings(): Promise<RpgRating[]> {
  const [reviews, rpgs] = await Promise.all([
    ReviewModel.find({ status: 'approved' }),
    getRpgs(),
  ])

  const stats: Record<string, { sum: number; count: number }> = {}

  for (const review of reviews) {
    const name = review.rpgName
    if (!stats[name]) stats[name] = { sum: 0, count: 0 }
    stats[name].sum += review.rating
    stats[name].count++
  }

  const m = 20
  const C = 3.5

  const results: RpgRating[] = rpgs.map(rpg => {
    const s = stats[rpg.name]
    const count = s?.count || 0
    const avg = count > 0 ? s.sum / count : 0
    const bayesianAvg = (avg * count + m * C) / (count + m)
    return { rpg, avgRating: avg, reviewCount: count, bayesianAvg }
  })

  results.sort((a, b) => {
    const diff = b.bayesianAvg - a.bayesianAvg
    if (diff !== 0) return diff
    return b.reviewCount - a.reviewCount
  })

  return results
}

export async function logoutUser(token: string): Promise<void> {
  await SessionModel.deleteOne({ token })
}
