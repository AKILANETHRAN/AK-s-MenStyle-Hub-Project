import db from '../config/database.js';

const ALLOWED_THEMES = ['gold-silver', 'midnight-silver', 'black-champagne'];
const ALLOWED_LANGUAGES = ['en', 'ta'];

/**
 * Get authenticated user's settings & preferences
 * GET /api/settings
 */
export function getSettings(req, res) {
  try {
    const userId = req.userId;
    const user = db.prepare(`
      SELECT id, username, full_name AS fullName, email, phone, address, city, state, pincode, role,
             COALESCE(email_notifications, 1) AS email_notifications,
             COALESCE(sms_notifications, 1) AS sms_notifications,
             COALESCE(whatsapp_notifications, 1) AS whatsapp_notifications,
             COALESCE(theme_preference, 'gold-silver') AS theme_preference,
             COALESCE(language_preference, 'en') AS language_preference
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    return res.status(200).json({
      status: 'success',
      settings: {
        theme: user.theme_preference,
        language: user.language_preference,
        communication: {
          email: Boolean(user.email_notifications),
          sms: Boolean(user.sms_notifications),
          whatsapp: Boolean(user.whatsapp_notifications)
        },
        account: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          address: user.address,
          city: user.city,
          state: user.state,
          pincode: user.pincode,
          role: user.role
        }
      }
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve settings.' });
  }
}

/**
 * Update authenticated user's settings & preferences
 * PUT /api/settings
 */
export function updateSettings(req, res) {
  try {
    const userId = req.userId;
    const { theme, language, communication } = req.body || {};

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    let updatedTheme = user.theme_preference || 'gold-silver';
    if (theme && ALLOWED_THEMES.includes(theme)) {
      updatedTheme = theme;
    }

    let updatedLanguage = user.language_preference || 'en';
    if (language && ALLOWED_LANGUAGES.includes(language)) {
      updatedLanguage = language;
    }

    let emailNotif = user.email_notifications !== undefined ? user.email_notifications : 1;
    let smsNotif = user.sms_notifications !== undefined ? user.sms_notifications : 1;
    let whatsappNotif = user.whatsapp_notifications !== undefined ? user.whatsapp_notifications : 1;

    if (communication) {
      if (typeof communication.email === 'boolean') {
        emailNotif = communication.email ? 1 : 0;
      }
      if (typeof communication.sms === 'boolean') {
        smsNotif = communication.sms ? 1 : 0;
      }
      if (typeof communication.whatsapp === 'boolean') {
        whatsappNotif = communication.whatsapp ? 1 : 0;
      }
    }

    db.prepare(`
      UPDATE users
      SET theme_preference = ?,
          language_preference = ?,
          email_notifications = ?,
          sms_notifications = ?,
          whatsapp_notifications = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedTheme, updatedLanguage, emailNotif, smsNotif, whatsappNotif, userId);

    return res.status(200).json({
      status: 'success',
      message: 'Settings updated successfully.',
      settings: {
        theme: updatedTheme,
        language: updatedLanguage,
        communication: {
          email: Boolean(emailNotif),
          sms: Boolean(smsNotif),
          whatsapp: Boolean(whatsappNotif)
        }
      }
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to update settings.' });
  }
}

/**
 * Get notification delivery history for the authenticated user
 * GET /api/settings/notifications/history
 */
export function getNotificationHistory(req, res) {
  try {
    const userId = req.userId;
    const history = db.prepare(`
      SELECT nd.id, nd.purchase_id, nd.channel, nd.status, nd.recipient, nd.created_at,
             p.total_amount, p.purchase_type
      FROM notification_deliveries nd
      LEFT JOIN purchases p ON nd.purchase_id = p.id
      WHERE nd.user_id = ?
      ORDER BY nd.id DESC
      LIMIT 20
    `).all(userId);

    return res.status(200).json({
      status: 'success',
      deliveries: history
    });
  } catch (err) {
    console.error('Error fetching notification history:', err);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve notification history.' });
  }
}
