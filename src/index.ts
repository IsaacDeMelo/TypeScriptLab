import 'dotenv/config'
import express from 'express'
import path from 'path'

const app = express();

// Rode o Express direto para testar:
app.listen(3000, () => {
  console.log(`App is running on http://localhost:${PORT}`)
})

// Chame o banco de forma independente para ver o que acontece
connectDatabase()
  .then(() => console.log('MongoDB conectado!'))
  .catch((err) => console.error('Erro no banco:', err))