import { Router, Request, Response } from 'express'
import { getRpgs, getReviews, getUsers } from '../data'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const [allReviews, rpgs, users] = await Promise.all([
    getReviews(true),
    getRpgs(),
    getUsers(),
  ])
  res.render('public', {
    rpgs,
    reviews: allReviews.filter(r => r.status === 'approved'),
    pendingReviews: allReviews.filter(r => r.status === 'pending'),
    allReviews: allReviews,
    users,
  })
})

export default router
