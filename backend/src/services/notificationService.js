import { Notification } from '../models/index.js'

export const pushNotification = async ({
  userId,
  companyId,
  type = 'system',
  title = '',
  message,
  priority = 'low',
  link,
  roleTarget,
  metadata,
  status = 'unread',
  expiryDate
}) => {
  return Notification.create({
    userId,
    companyId,
    type,
    title,
    message,
    priority,
    link,
    roleTarget,
    metadata,
    status,
    isRead: status === 'read',
    expiryDate
  })
}

const findForUser = async (id, userId) => {
  const notification = await Notification.findOne({ where: { id, userId } })
  if (!notification) throw Object.assign(new Error('Notification not found'), { status: 404 })
  return notification
}

export const markRead = async (id, userId) => {
  const notification = await findForUser(id, userId)
  notification.isRead = true
  notification.status = 'read'
  await notification.save()
  return notification
}

export const markUnread = async (id, userId) => {
  const notification = await findForUser(id, userId)
  notification.isRead = false
  notification.status = 'unread'
  await notification.save()
  return notification
}

export const archiveNotification = async (id, userId) => {
  const notification = await findForUser(id, userId)
  notification.status = 'archived'
  await notification.save()
  return notification
}

export const markAllRead = async (userId) => {
  await Notification.update({ status: 'read', isRead: true }, { where: { userId, status: ['unread', 'read'] } })
}
