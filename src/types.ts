export interface Tag {
  name: string
  weight: number
}

export interface RPG {
  name: string
  owner: string
  genre: string
  image: string
  banner: string
  description: string
  link?: string
  whatsapp?: string
  year?: string
  ageRating: string
  featured?: boolean
  blurImage?: boolean
  limitedEdition?: boolean
  slotsTotal?: number
  slotsFilled?: number
  closed?: boolean
  tags?: Tag[]
}

export interface Review {
  id: string
  rpg: RPG
  username: string
  rating: number
  comment: string
  timeAgo: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
  customImage?: string
}

export interface ReviewInput {
  rpgName: string
  rating: number
  comment: string
  customImage?: string
}

export interface User {
  id: string
  username: string
  passwordHash: string
  role: 'user' | 'admin'
  bio?: string
  avatar?: string
  contact?: string
}
