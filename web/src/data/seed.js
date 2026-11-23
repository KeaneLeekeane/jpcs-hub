// Sample data for DEMO MODE (matches the prototype screenshots).
import { toEmail } from './common';

export const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'admin', full_name: 'Faculty Adviser' },
  { username: 'officer', password: 'officer123', role: 'officer', full_name: 'JPCS Officer' },
  { username: 'treasurer', password: 'treasurer123', role: 'treasurer', full_name: 'JPCS Treasurer' },
  { username: 'auditor', password: 'auditor123', role: 'auditor', full_name: 'JPCS Auditor' },
  { username: '2026-001', password: 'student123', role: 'student', full_name: 'Juan Dela Cruz' },
];

export function demoSeed() {
  const now = Date.now();
  const today = new Date().setHours(9, 0, 0, 0);
  const db = {
    users: {}, members: {}, announcements: {}, events: {}, documents: {},
    liquidations: {}, expense_items: {}, conversations: {}, calls: {}, presence: {},
  };
  const auth = {};

  const uids = {};
  for (const a of DEMO_ACCOUNTS) {
    const uid = 'demo_' + a.username.replace(/\W/g, '');
    uids[a.username] = uid;
    auth[toEmail(a.username)] = { uid, password: a.password };
    db.users[uid] = {
      full_name: a.full_name, username: a.username, email: '', role: a.role,
      status: 'active', date_created: now, last_active: 0,
    };
  }

  const members = [
    ['m1', '2026-001', 'Dela Cruz', 'Juan', '2nd Year', 'juan@example.com', 'Active', uids['2026-001']],
    ['m2', '2026-002', 'Santos', 'Maria', '1st Year', 'maria@example.com', 'Active', null],
    ['m3', '2026-003', 'Reyes', 'Pedro', '3rd Year', 'pedro@example.com', 'Pending', null],
  ];
  for (const [id, no, last, first, year, email, status, uid] of members) {
    db.members[id] = {
      student_no: no, last_name: last, first_name: first, course: 'BSIT', year_level: year,
      email, contact_no: '', username: uid ? no : '', membership_status: status,
      date_registered: now, updated_by: uids.admin, uid: uid || '',
    };
  }
  db.users[uids['2026-001']].member_id = 'm1';

  db.announcements.a1 = {
    title: 'Welcome to JPCS HUB', posted_by: uids.admin, posted_by_name: 'Faculty Adviser', date_posted: today,
    content: 'Welcome to the official JPCS HUB portal. Stay updated with our announcements and activities.',
  };
  db.announcements.a2 = {
    title: 'JPCS Membership Update', posted_by: uids.admin, posted_by_name: 'Faculty Adviser', date_posted: today - 1000,
    content: 'Members are encouraged to check their membership information and contact the officers for assistance.',
  };

  db.events.e1 = {
    event_title: 'JPCS General Assembly', event_date: '2026-12-10', venue: 'PTC Campus', status: 'Upcoming',
    description: 'A gathering of JPCS members for updates and organizational activities.', created_by: uids.admin,
  };
  db.events.e2 = {
    event_title: 'IT Skills Workshop', event_date: '2026-12-18', venue: 'Computer Laboratory', status: 'Upcoming',
    description: 'An activity that promotes learning and improvement of IT skills.', created_by: uids.admin,
  };

  db.liquidations.e1 = {
    event_id: 'e1', event_title: 'JPCS General Assembly', allocated_budget: 30000, total_amount: 0,
    prepared_by: uids.treasurer, prepared_by_name: 'JPCS Treasurer', verified_by: '', verified_by_name: '',
    date_submitted: 0, date_verified: 0, status: 'Draft', remarks: '',
  };

  const sid = uids['2026-001'];
  db.conversations[sid] = {
    student_uid: sid, member_id: 'm1', student_name: 'Juan Dela Cruz',
    last_message: 'Hello! Thank you for contacting JPCS. How can we help you?',
    last_time: now - 60000, last_sender_type: 'officer', staff_unread: 0, student_unread: 1,
  };
  db[`conversations/${sid}/messages`] = {
    msg1: {
      member_id: 'm1', user_id: '', sender_uid: sid, sender_name: 'Juan Dela Cruz', sender_type: 'student',
      message_text: 'Hello! I would like to ask about the upcoming JPCS event.', date_sent: now - 120000, status: 'read',
    },
    msg2: {
      member_id: 'm1', user_id: uids.officer, sender_uid: uids.officer, sender_name: 'JPCS Officer', sender_type: 'officer',
      message_text: 'Hello! Thank you for contacting JPCS. How can we help you?', date_sent: now - 60000, status: 'sent',
    },
  };

  return { db, auth };
}
