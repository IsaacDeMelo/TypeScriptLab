import mongoose from 'mongoose'

export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGO_URI
  if (!uri) {
    console.error('MONGO_URI não definida no .env')
    process.exit(1)
  }
  await mongoose.connect(uri)
  console.log('Conectado ao MongoDB')
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}
