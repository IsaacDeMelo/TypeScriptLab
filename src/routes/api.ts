import { Router, Request, Response } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import { getReviews, getPendingReviews, addReview, approveReview, rejectReview, deleteReviewById, addRpg, updateRpg, deleteRpg, getRpgs, getRpgByName, getUserByToken, toggleFeaturedRpg } from '../data'
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

router.get('/rpgs', (_req: Request, res: Response) => {
  res.json(getRpgs())
})

router.get('/rpgs/:name', (req: Request, res: Response) => {
  const rpg = getRpgByName(String(req.params.name))
  if (!rpg) { res.status(404).json({ error: 'RPG não encontrado.' }); return }
  res.json(rpg)
})

router.get('/reviews', (_req: Request, res: Response) => {
  const rpgFilter = _req.query.rpg as string | undefined
  let reviews = getReviews()
  if (rpgFilter) {
    reviews = reviews.filter(r => r.rpg.name === rpgFilter)
  }
  res.json(reviews)
})

router.post('/reviews', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Autenticação necessária. Faça login primeiro.' })
    return
  }

  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
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

    const rpg = getRpgByName(rpgName)
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

    const review = addReview(input, user.username)
    res.status(201).json(review)
  })
})

router.get('/reviews/pending', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const pending = getPendingReviews()
  res.json(pending)
})

router.patch('/reviews/:id/approve', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const review = approveReview(String(req.params.id))
  if (!review) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  res.json(review)
})

router.patch('/reviews/:id/reject', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const ok = rejectReview(String(req.params.id))
  if (!ok) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  res.json({ message: 'Avaliação rejeitada.' })
})

router.delete('/reviews/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  const ok = deleteReviewById(String(req.params.id), user.username, user.role === 'admin')
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

router.post('/rpgs', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
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

    if (getRpgByName(name)) {
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

      const rpg = addRpg({ name, owner, genre, year, ageRating, image: imageUrl, banner: bannerUrl || undefined, description, link, whatsapp, tags: parsedTags })
      res.status(201).json(rpg)
    } catch {
      res.status(500).json({ error: 'Erro ao fazer upload das imagens.' })
    }
  })
})

router.patch('/rpgs/:name', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores podem editar sistemas.' }); return }

  const rpgName = String(req.params.name)
  const existing = getRpgByName(rpgName)
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

      const rpg = updateRpg(rpgName, updates)
      if (!rpg) { res.status(500).json({ error: 'Erro ao atualizar.' }); return }
      res.json(rpg)
    } catch {
      res.status(500).json({ error: 'Erro ao fazer upload das imagens.' })
    }
  })
})

router.patch('/rpgs/:name/featured', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const rpg = toggleFeaturedRpg(String(req.params.name))
  if (!rpg) { res.status(404).json({ error: 'RPG não encontrado.' }); return }
  res.json(rpg)
})

router.delete('/rpgs/:name', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores podem excluir sistemas.' }); return }

  const ok = deleteRpg(String(req.params.name))
  if (!ok) { res.status(404).json({ error: 'Sistema não encontrado.' }); return }
  res.json({ message: 'Sistema excluído.' })
})

export default router
