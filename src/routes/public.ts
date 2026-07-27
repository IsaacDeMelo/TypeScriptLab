import { Router, Request, Response } from 'express'
import { getRpgs, getReviews, getUsers, getRpgRatings } from '../data'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const [allReviews, rpgs, users, rpgRatings] = await Promise.all([
    getReviews(true),
    getRpgs(),
    getUsers(),
    getRpgRatings(),
  ])
  const approvedReviews = allReviews.filter(r => r.status === 'approved')
  res.render('public', {
    rpgs,
    reviews: approvedReviews,
    pendingReviews: allReviews.filter(r => r.status === 'pending'),
    allReviews: allReviews,
    users,
    rpgRatings,
    topRpgs: rpgRatings.slice(0, 10),
  })
})

export default router
