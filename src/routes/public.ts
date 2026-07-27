import { Router, Request, Response } from 'express'
import { getRpgs, getReviews, getUsers, getRpgRatings } from '../data'

export async function getPageData() {
  const [allReviews, rpgs, users, rpgRatings] = await Promise.all([
    getReviews(true),
    getRpgs(),
    getUsers(),
    getRpgRatings(),
  ])
  return {
    rpgs,
    reviews: allReviews.filter(r => r.status === 'approved'),
    pendingReviews: allReviews.filter(r => r.status === 'pending'),
    allReviews,
    users,
    rpgRatings,
    topRpgs: rpgRatings.slice(0, 10),
  }
}

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const data = await getPageData()
  res.render('public', data)
})

export default router
