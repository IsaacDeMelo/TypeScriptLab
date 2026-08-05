import { Router, Request, Response } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import { getReviews, getRecentReviews, getPendingReviews, addReview, approveReview, rejectReview, deleteReviewById, addRpg, updateRpg, deleteRpg, getRpgs, getRpgByName, getUserByToken, toggleFeaturedRpg, getRpgRatings, attachRpgs } from '../data'
import ReviewModel from '../models/Review'
import { ReviewInput, RPG } from '../types'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Formato de imagem inválido. Use jpg, png, webp ou gif.'))
    }
  },
})

function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'rpg-reviewer', resource_type: 'image' },
      (err, result) => {
        if (err) reject(err)
        else resolve(result!.secure_url)
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}

const router = Router()

router.get('/rpgs', async (_req: Request, res: Response) => {
  res.json(await getRpgs())
})

router.get('/rpgs/:name', async (req: Request, res: Response) => {
  const rpg = await getRpgByName(String(req.params.name))
  if (!rpg) { res.status(404).json({ error: 'RPG não encontrado.' }); return }
  res.json(rpg)
})

router.get('/reviews', async (req: Request, res: Response) => {
  const rpgFilter = req.query.rpg as string | undefined
  let reviews = await getReviews()
  if (rpgFilter) {
    reviews = reviews.filter(r => r.rpg.name === rpgFilter)
  }
  res.json(reviews)
})

router.post('/reviews', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Autenticação necessária. Faça login primeiro.' })
    return
  }

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) {
    res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' })
    return
  }

  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Imagem muito grande. Máximo 5MB.' })
        return
      }
      res.status(400).json({ error: err.message })
      return
    }

    const { rpgName, rating, comment } = req.body

    if (!rpgName || !rating || !comment) {
      res.status(400).json({ error: 'Todos os campos são obrigatórios.' })
      return
    }

    const rpg = await getRpgByName(rpgName)
    if (!rpg) {
      res.status(400).json({ error: 'RPG não encontrado.' })
      return
    }

    const input: ReviewInput = {
      rpgName,
      rating: Number(rating),
      comment,
    }

    if (req.file) {
      try {
        input.customImage = await uploadToCloudinary(req.file.buffer)
      } catch {
        res.status(500).json({ error: 'Erro ao fazer upload da imagem.' })
        return
      }
    }

    const review = await addReview(input, user.username)
    res.status(201).json(review)
  })
})

router.get('/reviews/pending', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const pending = await getPendingReviews()
  res.json(pending)
})

router.patch('/reviews/:id/approve', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const review = await approveReview(String(req.params.id))
  if (!review) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  res.json(review)
})

router.patch('/reviews/:id/reject', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const ok = await rejectReview(String(req.params.id))
  if (!ok) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  res.json({ message: 'Avaliação rejeitada.' })
})

router.delete('/reviews/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  const ok = await deleteReviewById(String(req.params.id), user.username, user.role === 'admin')
  if (!ok) { res.status(403).json({ error: 'Não autorizado ou avaliação não encontrada.' }); return }
  res.json({ message: 'Avaliação excluída.' })
})

function uploadRpgImage(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => { if (err) reject(err); else resolve(result!.secure_url) },
    )
    Readable.from(buffer).pipe(stream)
  })
}

router.post('/rpgs', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) {
    res.status(401).json({ error: 'Sessão inválida.' })
    return
  }

  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) { res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande. Máximo 30MB.' : 'Erro no upload de imagem.' }); return }

    const { name, owner, genre, year, ageRating, description, link, whatsapp, tags } = req.body
    if (!name || !owner || !genre || !ageRating || !description) {
      res.status(400).json({ error: 'Campos obrigatórios: name, owner, genre, ageRating, description.' })
      return
    }

    const existing = await getRpgByName(name)
    if (existing) {
      res.status(400).json({ error: 'Já existe um RPG com este nome.' })
      return
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    try {
      let imageUrl = req.body.image || ''
      let bannerUrl = req.body.banner || ''

      if (files?.image?.[0]) imageUrl = await uploadRpgImage(files.image[0].buffer, 'rpg-reviewer/rpgs')
      if (files?.banner?.[0]) bannerUrl = await uploadRpgImage(files.banner[0].buffer, 'rpg-reviewer/rpgs')

      if (!imageUrl) { res.status(400).json({ error: 'Imagem é obrigatória.' }); return }

      let parsedTags
      if (typeof tags === 'string') {
        try { parsedTags = JSON.parse(tags) } catch { parsedTags = undefined }
      } else {
        parsedTags = tags
      }

      const rpg = await addRpg({
        name, owner, genre, year, ageRating, image: imageUrl, banner: bannerUrl || undefined, description, link, whatsapp, tags: parsedTags,
        blurImage: req.body.blurImage === 'true',
        limitedEdition: req.body.limitedEdition === 'true',
        slotsTotal: req.body.slotsTotal !== undefined && req.body.slotsTotal !== '' ? Number(req.body.slotsTotal) : undefined,
        slotsFilled: req.body.slotsFilled !== undefined && req.body.slotsFilled !== '' ? Number(req.body.slotsFilled) : 0,
        closed: req.body.closed === 'true',
      })
      res.status(201).json(rpg)
    } catch {
      res.status(500).json({ error: 'Erro ao fazer upload das imagens.' })
    }
  })
})

router.patch('/rpgs/:name', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores podem editar sistemas.' }); return }

  const rpgName = String(req.params.name)
  const existing = await getRpgByName(rpgName)
  if (!existing) { res.status(404).json({ error: 'Sistema não encontrado.' }); return }

  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) { res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande. Máximo 30MB.' : 'Erro no upload.' }); return }

    const { owner, genre, year, ageRating, description, link, whatsapp, tags } = req.body
    const updates: Partial<RPG> = {}

    if (owner) updates.owner = owner
    if (genre) updates.genre = genre
    if (year) updates.year = year
    if (ageRating) updates.ageRating = ageRating
    if (description) updates.description = description
    if (link !== undefined) updates.link = link || undefined
    if (whatsapp !== undefined) updates.whatsapp = whatsapp || undefined
    if (req.body.blurImage !== undefined) updates.blurImage = req.body.blurImage === 'true'
    if (req.body.limitedEdition !== undefined) updates.limitedEdition = req.body.limitedEdition === 'true'
    if (req.body.slotsTotal !== undefined) updates.slotsTotal = req.body.slotsTotal === '' ? undefined : Number(req.body.slotsTotal)
    if (req.body.slotsFilled !== undefined) updates.slotsFilled = req.body.slotsFilled === '' ? 0 : Number(req.body.slotsFilled)
    if (req.body.closed !== undefined) updates.closed = req.body.closed === 'true'
    if (tags !== undefined) {
      if (typeof tags === 'string') {
        try { updates.tags = JSON.parse(tags) } catch { /* ignore */ }
      } else {
        updates.tags = tags
      }
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    try {
      if (files?.image?.[0]) updates.image = await uploadRpgImage(files.image[0].buffer, 'rpg-reviewer/rpgs')
      if (files?.banner?.[0]) updates.banner = await uploadRpgImage(files.banner[0].buffer, 'rpg-reviewer/rpgs')

      const rpg = await updateRpg(rpgName, updates)
      if (!rpg) { res.status(500).json({ error: 'Erro ao atualizar.' }); return }
      res.json(rpg)
    } catch (e) {
      console.error('Erro ao atualizar RPG:', e)
      res.status(500).json({ error: 'Erro ao fazer upload das imagens.' })
    }
  })
})

router.patch('/rpgs/:name/featured', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const rpg = await toggleFeaturedRpg(String(req.params.name))
  if (!rpg) { res.status(404).json({ error: 'RPG não encontrado.' }); return }
  res.json(rpg)
})

router.delete('/rpgs/:name', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores podem excluir sistemas.' }); return }

  const ok = await deleteRpg(String(req.params.name))
  if (!ok) { res.status(404).json({ error: 'Sistema não encontrado.' }); return }
  res.json({ message: 'Sistema excluído.' })
})

router.get('/rpgs/ratings', async (_req: Request, res: Response) => {
  res.json(await getRpgRatings())
})

router.get('/reviews/feed', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
  const skip = parseInt(req.query.skip as string) || 0
  const docs = await ReviewModel.find({ status: 'approved' }).sort({ createdAt: -1 }).skip(skip).limit(limit)
  res.json(await attachRpgs(docs))
})

export default router
