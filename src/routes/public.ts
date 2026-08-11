import { Router, Request, Response } from 'express'
import { getRpgs, getReviews, getRecentReviews, getPendingReviews, getUsers, getRpgRatings, getAds, getEventPosts, recordVisit } from '../data'

export async function getPageData() {
  const [feedReviews, allReviews, pendingReviews, rpgs, users, rpgRatings, ads, eventPosts] = await Promise.all([
    getRecentReviews(20),
    getReviews(),
    getPendingReviews(),
    getRpgs(),
    getUsers(),
    getRpgRatings(),
    getAds(),
    getEventPosts(50),
  ])
  return {
    rpgs,
    reviews: feedReviews,
    pendingReviews,
    allReviews,
    users,
    rpgRatings,
    topRpgs: rpgRatings.slice(0, 10),
    ads,
    eventPosts,
  }
}

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const data = await getPageData()
  recordVisit('pageview')
  res.render('public', data)
})

export default router
