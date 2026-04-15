import { Notification } from '../models/index.js'
import { archiveNotification, markAllRead, markRead, markUnread } from '../services/notificationService.js'
import { param, query } from 'express-validator'

export const markReadValidators = [param('id').isUUID()]
export const markUnreadValidators = [param('id').isUUID()]
export const archiveValidators = [param('id').isUUID()]
export const listValidators = [
  query('status').optional().isIn(['unread', 'read', 'archived']),
  query('type').optional().isString(),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('limit').optional().isInt({ min: 1, max: 100 })
]

export const listNotifications = async (req, res, next) => {
  try {
    const { status, type, priority } = req.query
    const limit = Number(req.query.limit) || 50
    const where = { userId: req.user.id }
    if (status) where.status = status
    if (type) where.type = type
    if (priority) where.priority = priority
    const notifications = await Notification.findAll({ where, order: [['createdAt', 'DESC']], limit })
    res.json(notifications)
  } catch (err) {
    next(err)
  }
}

export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await markRead(req.params.id, req.user.id)
    res.json(notification)
  } catch (err) {
    next(err)
  }
}

export const markNotificationUnread = async (req, res, next) => {
  try {
    const notification = await markUnread(req.params.id, req.user.id)
    res.json(notification)
  } catch (err) {
    next(err)
  }
}

export const archiveNotificationById = async (req, res, next) => {
  try {
    const notification = await archiveNotification(req.params.id, req.user.id)
    res.json(notification)
  } catch (err) {
    next(err)
  }
}

export const markAllUserNotificationsRead = async (req, res, next) => {
  try {
    await markAllRead(req.user.id)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
