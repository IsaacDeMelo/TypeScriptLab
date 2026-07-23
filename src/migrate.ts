import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import mongoose from 'mongoose'
import Rpg from './models/Rpg'
import ReviewModel from './models/Review'
import UserModel from './models/User'
import SessionModel from './models/Session'

async function migrate() {
  const uri = process.env.MONGO_URI
  if (!uri) {
    console.error('MONGO_URI não definida no .env')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Conectado ao MongoDB')

  const dbPath = join(__dirname, 'data', 'db.json')
  if (!existsSync(dbPath)) {
    console.error('db.json não encontrado em', dbPath)
    process.exit(1)
  }

  const db = JSON.parse(readFileSync(dbPath, 'utf-8'))

  await Promise.all([
    Rpg.deleteMany({}),
    ReviewModel.deleteMany({}),
    UserModel.deleteMany({}),
    SessionModel.deleteMany({}),
  ])
  console.log('Coleções existentes limpas')

  if (db.rpgs?.length) {
    await Rpg.insertMany(
      db.rpgs.map((r: any) => ({
        name: r.name,
        owner: r.owner,
        genre: r.genre,
        image: r.image,
        banner: r.banner || r.image,
        description: r.description,
        link: r.link,
        whatsapp: r.whatsapp,
        year: r.year,
        ageRating: r.ageRating,
        featured: r.featured ?? false,
        tags: r.tags || [],
      })),
    )
    console.log(`${db.rpgs.length} RPGs migrados`)
  }

  const idMap: Record<string, string> = {}
  for (const u of db.users || []) {
    const doc = await UserModel.create({
      username: u.username,
      passwordHash: u.passwordHash,
      role: u.role || 'user',
      bio: u.bio,
      avatar: u.avatar,
      contact: u.contact,
    })
    idMap[u.id] = String(doc._id)
  }
  console.log(`${Object.keys(idMap).length} usuários migrados`)

  if (db.reviews?.length) {
    await ReviewModel.insertMany(
      db.reviews.map((r: any) => ({
        rpgName: r.rpgName,
        username: r.username,
        rating: r.rating,
        comment: r.comment,
        customImage: r.customImage,
        status: r.status || 'approved',
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      })),
    )
    console.log(`${db.reviews.length} avaliações migradas`)
  }

  if (db.sessions) {
    const entries = Object.entries(db.sessions) as [string, string][]
    const sessionDocs = entries
      .filter(([_, oldId]) => idMap[oldId])
      .map(([token, oldId]) => ({
        token,
        userId: idMap[oldId],
      }))
    if (sessionDocs.length) {
      await SessionModel.insertMany(sessionDocs)
    }
    console.log(`${sessionDocs.length} sessões migradas`)
  }

  console.log('Migração concluída com sucesso!')
  await mongoose.disconnect()
}

migrate().catch((err) => {
  console.error('Erro na migração:', err)
  process.exit(1)
})
