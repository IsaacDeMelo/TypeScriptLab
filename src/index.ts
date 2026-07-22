import 'dotenv/config'
import express from 'express'
import path from 'path'
import { v2 as cloudinary } from 'cloudinary'
import publicRouter from './routes/public'
import apiRouter from './routes/api'
import authRouter from './routes/auth'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const app = express()

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.get('/', (_req, res) => {
  res.redirect('/public')
})

app.use('/public', publicRouter)
app.use('/api', apiRouter)
app.use('/api/auth', authRouter)

app.listen(3000, () => {
  console.log('App is running on http://localhost:3000')
})