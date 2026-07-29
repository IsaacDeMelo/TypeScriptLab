import { Router, Request, Response } from 'express'
import { getRpgs, getReviews, getRecentReviews, getPendingReviews, getUsers, getRpgRatings } from '../data'

export async function getPageData() {
  const [feedReviews, allReviews, pendingReviews, rpgs, users, rpgRatings] = await Promise.all([
    getRecentReviews(20),
    getReviews(),
    getPendingReviews(),
    getRpgs(),
    getUsers(),
    getRpgRatings(),
  ])
  return {
    rpgs,
    reviews: feedReviews,
    pendingReviews,
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
