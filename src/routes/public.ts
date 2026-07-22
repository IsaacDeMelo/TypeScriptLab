import { Router, Request, Response } from 'express'
import { getRpgs, getReviews, getUsers } from '../data'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const allReviews = getReviews(true)
  res.render('public', {
    rpgs: getRpgs(),
    reviews: allReviews.filter(r => r.status === 'approved'),
    pendingReviews: allReviews.filter(r => r.status === 'pending'),
    allReviews: allReviews,
    users: getUsers(),
  })
})

export default router