import { Router } from 'express'
import auth from '../middleware/auth.js'
import validate from '../middleware/validate.js'
import {
	archiveNotificationById,
	archiveValidators,
	listNotifications,
	listValidators,
	markAllUserNotificationsRead,
	markNotificationRead,
	markNotificationUnread,
	markReadValidators,
	markUnreadValidators
} from '../controllers/notificationController.js'

const router = Router()

router.use(auth)
router.get('/', listValidators, validate, listNotifications)
router.post('/mark-all-read', markAllUserNotificationsRead)
router.post('/:id/read', markReadValidators, validate, markNotificationRead)
router.post('/:id/unread', markUnreadValidators, validate, markNotificationUnread)
router.post('/:id/archive', archiveValidators, validate, archiveNotificationById)

export default router
