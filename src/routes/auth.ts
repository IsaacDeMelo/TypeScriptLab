import { Router, Request, Response } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import { registerUser, loginUser, getUserByToken, logoutUser, updateProfile } from '../data'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'rpg-reviewer/avatars', resource_type: 'image' },
      (err, result) => { if (err) reject(err); else resolve(result!.secure_url) },
    )
    Readable.from(buffer).pipe(stream)
  })
}

const router = Router()

router.post('/register', (req: Request, res: Response) => {
  const { username, password, contact } = req.body

  if (!username || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios.' })
    return
  }

  if (username.length < 3) {
    res.status(400).json({ error: 'Usuário deve ter pelo menos 3 caracteres.' })
    return
  }

  if (password.length < 4) {
    res.status(400).json({ error: 'Senha deve ter pelo menos 4 caracteres.' })
    return
  }

  const result = registerUser(username, password, contact)

  if ('error' in result) {
    res.status(400).json({ error: result.error })
    return
  }

  res.status(201).json({ user: result.user, token: result.token })
})

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios.' })
    return
  }

  const result = loginUser(username, password)

  if ('error' in result) {
    res.status(401).json({ error: result.error })
    return
  }

  res.json({ user: result.user, token: result.token })
})

router.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Token não fornecido.' })
    return
  }

  const token = authHeader.replace('Bearer ', '')
  logoutUser(token)
  res.json({ message: 'Sessão encerrada.' })
})

router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Token não fornecido.' })
    return
  }

  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)

  if (!user) {
    res.status(401).json({ error: 'Token inválido.' })
    return
  }

  res.json({ user: { id: user.id, username: user.username, role: user.role, bio: user.bio, avatar: user.avatar, contact: user.contact } })
})

router.patch('/profile', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Token não fornecido.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Token inválido.' }); return }

  upload.single('avatar')(req, res, async (err) => {
    if (err) { res.status(400).json({ error: 'Erro no upload.' }); return }
    const updateData: { bio?: string; avatar?: string } = {}
    if (req.body.bio !== undefined) updateData.bio = req.body.bio
    if (req.file) {
      try { updateData.avatar = await uploadToCloudinary(req.file.buffer) }
      catch { res.status(500).json({ error: 'Erro ao enviar avatar.' }); return }
    }
    const updated = updateProfile(user.id, updateData)
    if (!updated) { res.status(500).json({ error: 'Erro ao atualizar.' }); return }
    res.json({ user: { id: updated.id, username: updated.username, role: updated.role, bio: updated.bio, avatar: updated.avatar, contact: updated.contact } })
  })
})

export default router
