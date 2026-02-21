import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb, ensureIndexes } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'forecastcrm-jwt-secret-2025';

// --- Auth Helpers ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === verify;
}

function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function getUser(request) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7));
  if (!payload) return null;
  const db = await getDb();
  const user = await db.collection('users').findOne({ id: payload.userId });
  return user;
}

function ok(data, status = 200) {
  return NextResponse.json(data, { status });
}
function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeUser(u) {
  if (!u) return null;
  const { passwordHash, _id, ...rest } = u;
  return rest;
}

// --- Mock AI Service ---
function mockCloseProbability(deal, activityCount) {
  const probs = { PROSPECTING: 0.15, QUALIFIED: 0.30, PROPOSAL: 0.50, NEGOTIATION: 0.70, WON: 1.0, LOST: 0.0 };
  let prob = probs[deal.stage] || 0.25;
  if (activityCount > 5) prob = Math.min(prob + 0.05, 0.95);
  if (activityCount > 10) prob = Math.min(prob + 0.05, 0.95);
  if (deal.amount > 200000) prob = Math.max(prob - 0.03, 0.05);
  if (deal.amount > 500000) prob = Math.max(prob - 0.05, 0.05);
  const daysSinceCreated = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86400000);
  if (daysSinceCreated > 90) prob = Math.max(prob - 0.05, 0.05);
  return Math.round(prob * 100) / 100;
}

function mockRiskLevel(prob) {
  if (prob >= 0.65) return 'LOW';
  if (prob >= 0.35) return 'MEDIUM';
  return 'HIGH';
}

function mockInsights(deal, activities) {
  const actionsByStage = {
    PROSPECTING: [
      'Research company recent news and key decision makers',
      'Prepare tailored value proposition for their industry',
      'Schedule introductory discovery call',
      'Send industry-relevant case studies via email'
    ],
    QUALIFIED: [
      'Schedule product demo with key stakeholders',
      'Map the buying committee and identify champion',
      'Prepare competitive differentiation points',
      'Send ROI calculator worksheet'
    ],
    PROPOSAL: [
      'Follow up on proposal within 48 hours',
      'Schedule technical review meeting',
      'Address pricing concerns with flexible options',
      'Provide customer references in same industry'
    ],
    NEGOTIATION: [
      'Involve executive sponsor for final push',
      'Prepare contract red-line response document',
      'Set clear decision timeline with champion',
      'Offer limited-time implementation bonus'
    ],
    WON: [
      'Schedule kickoff meeting with implementation team',
      'Send welcome package and onboarding timeline',
      'Introduce customer success manager'
    ],
    LOST: [
      'Schedule loss review meeting internally',
      'Send graceful close-out email to prospect',
      'Document lessons learned and objections'
    ]
  };

  const lastActivity = activities.length > 0 ? activities[0] : null;
  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.occurredAt).getTime()) / 86400000)
    : 30;

  const riskFactors = [];
  if (daysSinceActivity > 14) riskFactors.push('No contact in over 2 weeks - risk of going cold');
  if (daysSinceActivity > 7 && daysSinceActivity <= 14) riskFactors.push('Communication frequency declining');
  if (deal.amount > 200000) riskFactors.push('Large deal size may require additional approvals');
  if (!activities.some(a => a.type === 'MEETING')) riskFactors.push('No meetings logged - limited stakeholder engagement');
  if (activities.length < 3) riskFactors.push('Low engagement level with fewer than 3 interactions');
  const daysSinceCreated = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86400000);
  if (daysSinceCreated > 60 && ['PROSPECTING', 'QUALIFIED'].includes(deal.stage)) {
    riskFactors.push('Deal stalled - in early stage for over 60 days');
  }

  return {
    riskFactors: riskFactors.slice(0, 5),
    nextBestActions: (actionsByStage[deal.stage] || actionsByStage.PROSPECTING).slice(0, 4)
  };
}

function mockEmailDraft(deal) {
  return {
    subject: `Following up on ${deal.name} - Next Steps`,
    body: `Hi there,

I hope this message finds you well. I wanted to follow up regarding ${deal.name} and our recent conversations.

Based on our discussions, I believe there's a strong fit between our solution and your team's needs. I'd love to schedule a brief call this week to:

1. Address any remaining questions or concerns you may have
2. Discuss the timeline and next steps for moving forward
3. Review the implementation approach and expected outcomes

Would you have 30 minutes available this Thursday or Friday afternoon?

I'm confident we can deliver significant value to your organization, and I look forward to continuing our conversation.

Best regards`
  };
}

function mockSummary(deal, activities) {
  const actTypes = activities.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
  const parts = [`Deal "${deal.name}" is in the ${deal.stage} stage valued at $${(deal.amount || 0).toLocaleString()}.`];
  if (activities.length > 0) {
    parts.push(`${activities.length} activities logged (${Object.entries(actTypes).map(([k, v]) => `${v} ${k.toLowerCase()}(s)`).join(', ')}).`);
  } else {
    parts.push('No activities have been logged yet.');
  }
  const daysOpen = Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / 86400000);
  parts.push(`Open for ${daysOpen} days.`);
  if (deal.expectedCloseDate) {
    const daysToClose = Math.floor((new Date(deal.expectedCloseDate).getTime() - Date.now()) / 86400000);
    parts.push(daysToClose > 0 ? `Expected to close in ${daysToClose} days.` : `Close date passed ${Math.abs(daysToClose)} days ago.`);
  }
  return parts.join(' ');
}

// --- Seed Data ---
async function handleSeed() {
  const db = await getDb();
  await ensureIndexes();

  // Clear existing data
  const collections = ['users', 'teams', 'accounts', 'contacts', 'deals', 'activities', 'forecastSnapshots', 'dealAIInsights', 'auditTrail', 'settings', 'leads'];
  for (const c of collections) {
    await db.collection(c).deleteMany({});
  }

  // Teams
  const teams = [
    { id: 'team-1', name: 'Sales Team Alpha', createdAt: new Date() },
    { id: 'team-2', name: 'Sales Team Beta', createdAt: new Date() }
  ];
  await db.collection('teams').insertMany(teams);

  // Users (password: password123)
  const pw = hashPassword('password123');
  const users = [
    { id: 'user-admin', name: 'Alex Admin', email: 'admin@forecastcrm.com', passwordHash: pw, role: 'ADMIN', teamId: null, createdAt: new Date() },
    { id: 'user-manager', name: 'Morgan Manager', email: 'manager@forecastcrm.com', passwordHash: pw, role: 'MANAGER', teamId: 'team-1', createdAt: new Date() },
    { id: 'user-rep', name: 'Riley Rep', email: 'rep@forecastcrm.com', passwordHash: pw, role: 'REP', teamId: 'team-1', createdAt: new Date() },
    { id: 'user-rep2', name: 'Sam Sales', email: 'sam@forecastcrm.com', passwordHash: pw, role: 'REP', teamId: 'team-2', createdAt: new Date() }
  ];
  await db.collection('users').insertMany(users);

  // Accounts
  const accounts = [
    { id: 'acc-1', name: 'Acme Corporation', domain: 'acme.com', industry: 'Technology', country: 'USA', ownerId: 'user-rep', createdAt: new Date('2024-09-15') },
    { id: 'acc-2', name: 'TechFlow Inc', domain: 'techflow.io', industry: 'SaaS', country: 'USA', ownerId: 'user-rep', createdAt: new Date('2024-10-01') },
    { id: 'acc-3', name: 'GlobalSoft Ltd', domain: 'globalsoft.co.uk', industry: 'Enterprise Software', country: 'UK', ownerId: 'user-rep', createdAt: new Date('2024-08-20') },
    { id: 'acc-4', name: 'DataDrive Analytics', domain: 'datadrive.com', industry: 'Analytics', country: 'USA', ownerId: 'user-rep2', createdAt: new Date('2024-11-05') },
    { id: 'acc-5', name: 'CloudNine Solutions', domain: 'cloudnine.io', industry: 'Cloud Services', country: 'Canada', ownerId: 'user-rep', createdAt: new Date('2024-07-10') },
    { id: 'acc-6', name: 'FinServ Global', domain: 'finserv.com', industry: 'Financial Services', country: 'USA', ownerId: 'user-rep2', createdAt: new Date('2024-06-01') },
    { id: 'acc-7', name: 'MedTech Innovations', domain: 'medtech.io', industry: 'Healthcare', country: 'Germany', ownerId: 'user-rep', createdAt: new Date('2024-12-01') },
    { id: 'acc-8', name: 'RetailMax Group', domain: 'retailmax.com', industry: 'Retail', country: 'USA', ownerId: 'user-rep2', createdAt: new Date('2025-01-10') }
  ];
  await db.collection('accounts').insertMany(accounts);

  // Contacts
  const contacts = [
    { id: 'con-1', accountId: 'acc-1', name: 'John Smith', email: 'john@acme.com', phone: '+1-555-0101', title: 'VP of Engineering' },
    { id: 'con-2', accountId: 'acc-1', name: 'Sarah Johnson', email: 'sarah@acme.com', phone: '+1-555-0102', title: 'CTO' },
    { id: 'con-3', accountId: 'acc-2', name: 'Mike Chen', email: 'mike@techflow.io', phone: '+1-555-0201', title: 'Director of Operations' },
    { id: 'con-4', accountId: 'acc-3', name: 'Emma Wilson', email: 'emma@globalsoft.co.uk', phone: '+44-20-7946-0301', title: 'Head of IT' },
    { id: 'con-5', accountId: 'acc-4', name: 'David Park', email: 'david@datadrive.com', phone: '+1-555-0401', title: 'CEO' },
    { id: 'con-6', accountId: 'acc-5', name: 'Lisa Brown', email: 'lisa@cloudnine.io', phone: '+1-555-0501', title: 'VP of Sales' },
    { id: 'con-7', accountId: 'acc-6', name: 'Robert Taylor', email: 'robert@finserv.com', phone: '+1-555-0601', title: 'CFO' },
    { id: 'con-8', accountId: 'acc-7', name: 'Anna Mueller', email: 'anna@medtech.io', phone: '+49-30-12345601', title: 'Procurement Lead' },
    { id: 'con-9', accountId: 'acc-8', name: 'Tom Harris', email: 'tom@retailmax.com', phone: '+1-555-0801', title: 'COO' }
  ];
  await db.collection('contacts').insertMany(contacts);

  // Helper for past dates
  const daysAgo = (d) => new Date(Date.now() - d * 86400000);
  const daysFromNow = (d) => new Date(Date.now() + d * 86400000);

  // Deals - mix of stages with historical WON/LOST
  const deals = [
    { id: 'deal-1', accountId: 'acc-1', name: 'Acme Enterprise License', stage: 'NEGOTIATION', amount: 125000, currency: 'USD', expectedCloseDate: daysFromNow(15), ownerId: 'user-rep', createdAt: daysAgo(45), updatedAt: daysAgo(2) },
    { id: 'deal-2', accountId: 'acc-2', name: 'TechFlow Platform Upgrade', stage: 'PROPOSAL', amount: 85000, currency: 'USD', expectedCloseDate: daysFromNow(30), ownerId: 'user-rep', createdAt: daysAgo(30), updatedAt: daysAgo(5) },
    { id: 'deal-3', accountId: 'acc-3', name: 'GlobalSoft Cloud Migration', stage: 'QUALIFIED', amount: 250000, currency: 'USD', expectedCloseDate: daysFromNow(60), ownerId: 'user-rep', createdAt: daysAgo(20), updatedAt: daysAgo(3) },
    { id: 'deal-4', accountId: 'acc-4', name: 'DataDrive Analytics Suite', stage: 'PROSPECTING', amount: 45000, currency: 'USD', expectedCloseDate: daysFromNow(90), ownerId: 'user-rep2', createdAt: daysAgo(10), updatedAt: daysAgo(1) },
    { id: 'deal-5', accountId: 'acc-5', name: 'CloudNine Infrastructure', stage: 'NEGOTIATION', amount: 180000, currency: 'USD', expectedCloseDate: daysFromNow(7), ownerId: 'user-rep', createdAt: daysAgo(60), updatedAt: daysAgo(1) },
    { id: 'deal-6', accountId: 'acc-6', name: 'FinServ Compliance Tool', stage: 'PROPOSAL', amount: 95000, currency: 'USD', expectedCloseDate: daysFromNow(45), ownerId: 'user-rep2', createdAt: daysAgo(25), updatedAt: daysAgo(4) },
    { id: 'deal-7', accountId: 'acc-7', name: 'MedTech Patient Portal', stage: 'PROSPECTING', amount: 320000, currency: 'USD', expectedCloseDate: daysFromNow(120), ownerId: 'user-rep', createdAt: daysAgo(7), updatedAt: daysAgo(1) },
    { id: 'deal-8', accountId: 'acc-8', name: 'RetailMax POS System', stage: 'QUALIFIED', amount: 67000, currency: 'USD', expectedCloseDate: daysFromNow(50), ownerId: 'user-rep2', createdAt: daysAgo(15), updatedAt: daysAgo(2) },
    // Historical WON deals
    { id: 'deal-w1', accountId: 'acc-1', name: 'Acme Initial License', stage: 'WON', amount: 50000, currency: 'USD', expectedCloseDate: daysAgo(120), ownerId: 'user-rep', createdAt: daysAgo(180), updatedAt: daysAgo(120) },
    { id: 'deal-w2', accountId: 'acc-5', name: 'CloudNine Starter Pack', stage: 'WON', amount: 35000, currency: 'USD', expectedCloseDate: daysAgo(90), ownerId: 'user-rep', createdAt: daysAgo(150), updatedAt: daysAgo(90) },
    { id: 'deal-w3', accountId: 'acc-2', name: 'TechFlow Basic Setup', stage: 'WON', amount: 28000, currency: 'USD', expectedCloseDate: daysAgo(60), ownerId: 'user-rep', createdAt: daysAgo(120), updatedAt: daysAgo(60) },
    { id: 'deal-w4', accountId: 'acc-6', name: 'FinServ Pilot Program', stage: 'WON', amount: 42000, currency: 'USD', expectedCloseDate: daysAgo(30), ownerId: 'user-rep2', createdAt: daysAgo(90), updatedAt: daysAgo(30) },
    { id: 'deal-w5', accountId: 'acc-4', name: 'DataDrive Quick Start', stage: 'WON', amount: 18000, currency: 'USD', expectedCloseDate: daysAgo(150), ownerId: 'user-rep2', createdAt: daysAgo(210), updatedAt: daysAgo(150) },
    // Historical LOST deals
    { id: 'deal-l1', accountId: 'acc-3', name: 'GlobalSoft Legacy System', stage: 'LOST', amount: 200000, currency: 'USD', expectedCloseDate: daysAgo(45), ownerId: 'user-rep', createdAt: daysAgo(100), updatedAt: daysAgo(45) },
    { id: 'deal-l2', accountId: 'acc-8', name: 'RetailMax Inventory Tool', stage: 'LOST', amount: 55000, currency: 'USD', expectedCloseDate: daysAgo(75), ownerId: 'user-rep2', createdAt: daysAgo(130), updatedAt: daysAgo(75) },
  ];
  await db.collection('deals').insertMany(deals);

  // Activities
  const activities = [
    { id: 'act-1', dealId: 'deal-1', type: 'CALL', content: 'Discovery call with John Smith. Discussed their current infrastructure pain points and scalability needs. Very interested in our enterprise features.', occurredAt: daysAgo(40), createdBy: 'user-rep' },
    { id: 'act-2', dealId: 'deal-1', type: 'EMAIL', content: 'Sent product overview deck and pricing sheet. Included case studies from similar tech companies.', occurredAt: daysAgo(35), createdBy: 'user-rep' },
    { id: 'act-3', dealId: 'deal-1', type: 'MEETING', content: 'Product demo with John and Sarah (CTO). Great engagement, they asked detailed questions about API integration and security.', occurredAt: daysAgo(25), createdBy: 'user-rep' },
    { id: 'act-4', dealId: 'deal-1', type: 'NOTE', content: 'Champion (John) mentioned budget approval is expected next week. CTO wants a security audit report before signing.', occurredAt: daysAgo(10), createdBy: 'user-rep' },
    { id: 'act-5', dealId: 'deal-1', type: 'EMAIL', content: 'Sent security compliance documentation and SOC2 report. Scheduled follow-up for contract review.', occurredAt: daysAgo(5), createdBy: 'user-rep' },
    { id: 'act-6', dealId: 'deal-2', type: 'CALL', content: 'Initial discussion with Mike Chen about upgrading their current platform. Current solution is slow and lacks reporting.', occurredAt: daysAgo(28), createdBy: 'user-rep' },
    { id: 'act-7', dealId: 'deal-2', type: 'MEETING', content: 'Technical assessment meeting. Reviewed their architecture and proposed migration path.', occurredAt: daysAgo(20), createdBy: 'user-rep' },
    { id: 'act-8', dealId: 'deal-2', type: 'EMAIL', content: 'Sent formal proposal with 3 pricing tiers. Recommended the Professional tier based on their needs.', occurredAt: daysAgo(10), createdBy: 'user-rep' },
    { id: 'act-9', dealId: 'deal-3', type: 'CALL', content: 'Qualification call with Emma Wilson. They need cloud migration for 50+ legacy applications.', occurredAt: daysAgo(18), createdBy: 'user-rep' },
    { id: 'act-10', dealId: 'deal-3', type: 'NOTE', content: 'Large opportunity but complex requirements. Need to involve solutions architect for detailed scoping.', occurredAt: daysAgo(15), createdBy: 'user-rep' },
    { id: 'act-11', dealId: 'deal-4', type: 'EMAIL', content: 'Cold outreach to David Park. Highlighted how our analytics suite helped similar companies increase revenue 30%.', occurredAt: daysAgo(8), createdBy: 'user-rep2' },
    { id: 'act-12', dealId: 'deal-5', type: 'CALL', content: 'Negotiation call with Lisa Brown. Discussing payment terms and implementation timeline.', occurredAt: daysAgo(5), createdBy: 'user-rep' },
    { id: 'act-13', dealId: 'deal-5', type: 'MEETING', content: 'Executive alignment meeting. VP and Director both present. Agreed on scope, finalizing contract terms.', occurredAt: daysAgo(3), createdBy: 'user-rep' },
    { id: 'act-14', dealId: 'deal-5', type: 'NOTE', content: 'Lisa confirmed verbal approval from CEO. Legal review in progress, expect signed contract by end of week.', occurredAt: daysAgo(1), createdBy: 'user-rep' },
    { id: 'act-15', dealId: 'deal-6', type: 'CALL', content: 'Discussion with Robert Taylor about compliance requirements. They need SOX compliance features.', occurredAt: daysAgo(22), createdBy: 'user-rep2' },
    { id: 'act-16', dealId: 'deal-6', type: 'EMAIL', content: 'Sent proposal with compliance module pricing and implementation plan.', occurredAt: daysAgo(12), createdBy: 'user-rep2' },
    { id: 'act-17', dealId: 'deal-7', type: 'EMAIL', content: 'Initial outreach to Anna Mueller about patient portal solution for German healthcare market.', occurredAt: daysAgo(5), createdBy: 'user-rep' },
    { id: 'act-18', dealId: 'deal-8', type: 'CALL', content: 'Qualification call with Tom Harris. RetailMax needs modern POS system for 200+ stores.', occurredAt: daysAgo(12), createdBy: 'user-rep2' },
    { id: 'act-19', dealId: 'deal-w1', type: 'NOTE', content: 'Deal closed! Initial license signed for 1-year term.', occurredAt: daysAgo(120), createdBy: 'user-rep' },
    { id: 'act-20', dealId: 'deal-w2', type: 'NOTE', content: 'Contract signed. CloudNine starts with starter pack, expansion planned for Q3.', occurredAt: daysAgo(90), createdBy: 'user-rep' },
    { id: 'act-21', dealId: 'deal-w3', type: 'NOTE', content: 'TechFlow signed! Fast sales cycle. Good reference potential.', occurredAt: daysAgo(60), createdBy: 'user-rep' },
    { id: 'act-22', dealId: 'deal-w4', type: 'NOTE', content: 'FinServ pilot approved and signed. 6-month evaluation period.', occurredAt: daysAgo(30), createdBy: 'user-rep2' },
    { id: 'act-23', dealId: 'deal-l1', type: 'NOTE', content: 'Lost to competitor. Budget constraints and they chose a cheaper option.', occurredAt: daysAgo(45), createdBy: 'user-rep' },
    { id: 'act-24', dealId: 'deal-l2', type: 'NOTE', content: 'Project deprioritized by client. May revisit in Q4.', occurredAt: daysAgo(75), createdBy: 'user-rep2' },
  ];
  await db.collection('activities').insertMany(activities);

  // Leads
  const leads = [
    { id: 'lead-1', accountId: 'acc-1', contactId: 'con-1', source: 'Website', status: 'CONVERTED', score: 85, ownerId: 'user-rep', createdAt: daysAgo(200) },
    { id: 'lead-2', accountId: 'acc-7', contactId: 'con-8', source: 'Conference', status: 'NEW', score: 60, ownerId: 'user-rep', createdAt: daysAgo(7) },
    { id: 'lead-3', accountId: 'acc-4', contactId: 'con-5', source: 'Referral', status: 'CONVERTED', score: 90, ownerId: 'user-rep2', createdAt: daysAgo(220) },
    { id: 'lead-4', accountId: null, contactId: null, source: 'LinkedIn', status: 'NEW', score: 40, ownerId: 'user-rep', createdAt: daysAgo(3) },
  ];
  await db.collection('leads').insertMany(leads);

  // Settings
  await db.collection('settings').insertOne({
    id: 'settings-global',
    aiMode: 'mock',
    modelVersion: '1.0.0',
    lastTrainedAt: null,
    createdAt: new Date()
  });

  return ok({ message: 'Database seeded successfully', users: users.map(u => ({ email: u.email, role: u.role })) });
}

// --- Auth Handlers ---
async function handleLogin(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return fail('Email and password required');
    const db = await getDb();
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user) return fail('Invalid credentials', 401);
    if (!verifyPassword(password, user.passwordHash)) return fail('Invalid credentials', 401);
    const token = createToken({ userId: user.id, role: user.role });
    await db.collection('auditTrail').insertOne({
      id: uuidv4(), entityType: 'USER', entityId: user.id,
      action: 'LOGIN', userId: user.id, details: {}, createdAt: new Date()
    });
    return ok({ token, user: safeUser(user) });
  } catch (e) {
    return fail('Login failed: ' + e.message, 500);
  }
}

async function handleRegister(request) {
  try {
    const { name, email, password, role } = await request.json();
    if (!name || !email || !password) return fail('Name, email, and password required');
    const db = await getDb();
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) return fail('Email already in use');
    const user = {
      id: uuidv4(), name, email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role: role || 'REP', teamId: null, createdAt: new Date()
    };
    await db.collection('users').insertOne(user);
    const token = createToken({ userId: user.id, role: user.role });
    return ok({ token, user: safeUser(user) }, 201);
  } catch (e) {
    return fail('Registration failed: ' + e.message, 500);
  }
}

async function handleMe(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  return ok({ user: safeUser(user) });
}

// --- Dashboard ---
async function handleDashboardStats(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();

  let dealFilter = {};
  if (user.role === 'REP') dealFilter = { ownerId: user.id };
  else if (user.role === 'MANAGER' && user.teamId) {
    const teamUsers = await db.collection('users').find({ teamId: user.teamId }).toArray();
    const teamUserIds = teamUsers.map(u => u.id);
    dealFilter = { ownerId: { $in: teamUserIds } };
  }

  const deals = await db.collection('deals').find(dealFilter).toArray();
  const activeDeals = deals.filter(d => !['WON', 'LOST'].includes(d.stage));
  const wonDeals = deals.filter(d => d.stage === 'WON');
  const lostDeals = deals.filter(d => d.stage === 'LOST');

  const totalPipeline = activeDeals.reduce((s, d) => s + (d.amount || 0), 0);
  const wonRevenue = wonDeals.reduce((s, d) => s + (d.amount || 0), 0);
  const winRate = (wonDeals.length + lostDeals.length) > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0;

  const avgDealSize = activeDeals.length > 0
    ? Math.round(totalPipeline / activeDeals.length) : 0;

  // Pipeline by stage
  const stages = ['PROSPECTING', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];
  const pipelineByStage = stages.map(stage => ({
    stage,
    count: activeDeals.filter(d => d.stage === stage).length,
    value: activeDeals.filter(d => d.stage === stage).reduce((s, d) => s + (d.amount || 0), 0)
  }));

  // Recent activities
  let actFilter = {};
  if (user.role === 'REP') actFilter = { createdBy: user.id };
  const recentActivities = await db.collection('activities')
    .find(actFilter)
    .sort({ occurredAt: -1 })
    .limit(10)
    .toArray();

  // Monthly revenue (WON deals by month)
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const monthWon = wonDeals.filter(deal => {
      const closeDate = new Date(deal.updatedAt || deal.createdAt);
      return closeDate >= monthStart && closeDate <= monthEnd;
    });
    monthlyRevenue.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: monthWon.reduce((s, d) => s + (d.amount || 0), 0)
    });
  }

  return ok({
    totalPipeline, wonRevenue, winRate, avgDealSize,
    activeDealsCount: activeDeals.length,
    wonDealsCount: wonDeals.length,
    lostDealsCount: lostDeals.length,
    pipelineByStage, recentActivities, monthlyRevenue
  });
}

// --- Accounts ---
async function handleGetAccounts(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  let filter = {};
  if (user.role === 'REP') filter = { ownerId: user.id };
  else if (user.role === 'MANAGER' && user.teamId) {
    const teamUsers = await db.collection('users').find({ teamId: user.teamId }).toArray();
    filter = { ownerId: { $in: teamUsers.map(u => u.id) } };
  }
  const accounts = await db.collection('accounts').find(filter).sort({ createdAt: -1 }).toArray();
  // Enrich with deal count
  for (const acc of accounts) {
    acc.dealCount = await db.collection('deals').countDocuments({ accountId: acc.id });
    acc.totalValue = (await db.collection('deals').find({ accountId: acc.id, stage: { $nin: ['LOST'] } }).toArray())
      .reduce((s, d) => s + (d.amount || 0), 0);
  }
  return ok({ accounts: accounts.map(a => { const { _id, ...rest } = a; return rest; }) });
}

async function handleCreateAccount(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  try {
    const body = await request.json();
    const db = await getDb();
    const account = {
      id: uuidv4(), name: body.name, domain: body.domain || '',
      industry: body.industry || '', country: body.country || '',
      ownerId: user.id, createdAt: new Date()
    };
    await db.collection('accounts').insertOne(account);
    await db.collection('auditTrail').insertOne({
      id: uuidv4(), entityType: 'ACCOUNT', entityId: account.id,
      action: 'CREATED', userId: user.id, details: { name: account.name }, createdAt: new Date()
    });
    const { _id, ...rest } = account;
    return ok({ account: rest }, 201);
  } catch (e) {
    return fail('Failed to create account: ' + e.message, 500);
  }
}

async function handleGetAccount(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  const account = await db.collection('accounts').findOne({ id });
  if (!account) return fail('Account not found', 404);
  const contacts = await db.collection('contacts').find({ accountId: id }).toArray();
  const deals = await db.collection('deals').find({ accountId: id }).sort({ createdAt: -1 }).toArray();
  const { _id, ...acc } = account;
  return ok({
    account: acc,
    contacts: contacts.map(c => { const { _id, ...r } = c; return r; }),
    deals: deals.map(d => { const { _id, ...r } = d; return r; })
  });
}

async function handleUpdateAccount(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  try {
    const body = await request.json();
    const db = await getDb();
    const update = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.domain !== undefined) update.domain = body.domain;
    if (body.industry !== undefined) update.industry = body.industry;
    if (body.country !== undefined) update.country = body.country;
    await db.collection('accounts').updateOne({ id }, { $set: update });
    const account = await db.collection('accounts').findOne({ id });
    const { _id, ...rest } = account;
    return ok({ account: rest });
  } catch (e) {
    return fail('Failed to update account: ' + e.message, 500);
  }
}

async function handleDeleteAccount(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  if (user.role === 'REP') return fail('Insufficient permissions', 403);
  const db = await getDb();
  await db.collection('accounts').deleteOne({ id });
  return ok({ message: 'Account deleted' });
}

// --- Contacts ---
async function handleCreateContact(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  try {
    const body = await request.json();
    const db = await getDb();
    const contact = {
      id: uuidv4(), accountId: body.accountId, name: body.name,
      email: body.email || '', phone: body.phone || '', title: body.title || ''
    };
    await db.collection('contacts').insertOne(contact);
    const { _id, ...rest } = contact;
    return ok({ contact: rest }, 201);
  } catch (e) {
    return fail('Failed to create contact: ' + e.message, 500);
  }
}

// --- Deals ---
async function handleGetDeals(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  let filter = {};
  if (user.role === 'REP') filter = { ownerId: user.id };
  else if (user.role === 'MANAGER' && user.teamId) {
    const teamUsers = await db.collection('users').find({ teamId: user.teamId }).toArray();
    filter = { ownerId: { $in: teamUsers.map(u => u.id) } };
  }
  const deals = await db.collection('deals').find(filter).sort({ updatedAt: -1 }).toArray();
  // Enrich with account name and activity count
  const accounts = await db.collection('accounts').find({}).toArray();
  const accMap = {};
  accounts.forEach(a => { accMap[a.id] = a.name; });
  const users = await db.collection('users').find({}).toArray();
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u.name; });

  const enriched = deals.map(d => {
    const { _id, ...rest } = d;
    return { ...rest, accountName: accMap[d.accountId] || 'Unknown', ownerName: userMap[d.ownerId] || 'Unknown' };
  });
  return ok({ deals: enriched });
}

async function handleCreateDeal(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  try {
    const body = await request.json();
    const db = await getDb();
    const deal = {
      id: uuidv4(), accountId: body.accountId, name: body.name,
      stage: body.stage || 'PROSPECTING', amount: Number(body.amount) || 0,
      currency: body.currency || 'USD',
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
      ownerId: user.id, createdAt: new Date(), updatedAt: new Date()
    };
    await db.collection('deals').insertOne(deal);
    await db.collection('auditTrail').insertOne({
      id: uuidv4(), entityType: 'DEAL', entityId: deal.id,
      action: 'CREATED', userId: user.id, details: { name: deal.name, stage: deal.stage }, createdAt: new Date()
    });
    const { _id, ...rest } = deal;
    return ok({ deal: rest }, 201);
  } catch (e) {
    return fail('Failed to create deal: ' + e.message, 500);
  }
}

async function handleGetDeal(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  const deal = await db.collection('deals').findOne({ id });
  if (!deal) return fail('Deal not found', 404);
  const account = await db.collection('accounts').findOne({ id: deal.accountId });
  const activities = await db.collection('activities').find({ dealId: id }).sort({ occurredAt: -1 }).toArray();
  const insight = await db.collection('dealAIInsights').findOne({ dealId: id }, { sort: { createdAt: -1 } });
  const owner = await db.collection('users').findOne({ id: deal.ownerId });
  const { _id, ...dealClean } = deal;
  return ok({
    deal: { ...dealClean, accountName: account?.name || 'Unknown', ownerName: owner?.name || 'Unknown' },
    activities: activities.map(a => { const { _id, ...r } = a; return r; }),
    insight: insight ? (() => { const { _id, ...r } = insight; return r; })() : null
  });
}

async function handleUpdateDeal(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  try {
    const body = await request.json();
    const db = await getDb();
    const update = { updatedAt: new Date() };
    if (body.name !== undefined) update.name = body.name;
    if (body.stage !== undefined) update.stage = body.stage;
    if (body.amount !== undefined) update.amount = Number(body.amount);
    if (body.expectedCloseDate !== undefined) update.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
    if (body.accountId !== undefined) update.accountId = body.accountId;
    await db.collection('deals').updateOne({ id }, { $set: update });
    if (body.stage) {
      await db.collection('auditTrail').insertOne({
        id: uuidv4(), entityType: 'DEAL', entityId: id,
        action: 'STAGE_CHANGED', userId: user.id, details: { newStage: body.stage }, createdAt: new Date()
      });
    }
    const deal = await db.collection('deals').findOne({ id });
    const { _id, ...rest } = deal;
    return ok({ deal: rest });
  } catch (e) {
    return fail('Failed to update deal: ' + e.message, 500);
  }
}

async function handleDeleteDeal(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  if (user.role === 'REP') return fail('Insufficient permissions', 403);
  const db = await getDb();
  await db.collection('deals').deleteOne({ id });
  await db.collection('activities').deleteMany({ dealId: id });
  return ok({ message: 'Deal deleted' });
}

async function handleUpdateDealStage(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  try {
    const { stage } = await request.json();
    const validStages = ['PROSPECTING', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    if (!validStages.includes(stage)) return fail('Invalid stage');
    const db = await getDb();
    const deal = await db.collection('deals').findOne({ id });
    if (!deal) return fail('Deal not found', 404);
    const oldStage = deal.stage;
    await db.collection('deals').updateOne({ id }, { $set: { stage, updatedAt: new Date() } });
    await db.collection('auditTrail').insertOne({
      id: uuidv4(), entityType: 'DEAL', entityId: id,
      action: 'STAGE_CHANGED', userId: user.id,
      details: { oldStage, newStage: stage }, createdAt: new Date()
    });
    const updated = await db.collection('deals').findOne({ id });
    const { _id, ...rest } = updated;
    return ok({ deal: rest });
  } catch (e) {
    return fail('Failed to update stage: ' + e.message, 500);
  }
}

// --- Activities ---
async function handleGetActivities(request, dealId) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  const activities = await db.collection('activities').find({ dealId }).sort({ occurredAt: -1 }).toArray();
  return ok({ activities: activities.map(a => { const { _id, ...r } = a; return r; }) });
}

async function handleCreateActivity(request, dealId) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  try {
    const body = await request.json();
    const db = await getDb();
    const activity = {
      id: uuidv4(), dealId, type: body.type || 'NOTE',
      content: body.content || '', occurredAt: new Date(), createdBy: user.id
    };
    await db.collection('activities').insertOne(activity);
    const { _id, ...rest } = activity;
    return ok({ activity: rest }, 201);
  } catch (e) {
    return fail('Failed to create activity: ' + e.message, 500);
  }
}

// --- AI Insights ---
async function handleGenerateInsights(request, dealId) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  const deal = await db.collection('deals').findOne({ id: dealId });
  if (!deal) return fail('Deal not found', 404);
  const activities = await db.collection('activities').find({ dealId }).sort({ occurredAt: -1 }).toArray();

  const closeProbability = mockCloseProbability(deal, activities.length);
  const riskLevel = mockRiskLevel(closeProbability);
  const { riskFactors, nextBestActions } = mockInsights(deal, activities);
  const emailDraft = mockEmailDraft(deal);
  const summary = mockSummary(deal, activities);

  const insight = {
    id: uuidv4(), dealId, closeProbability, riskLevel,
    nextBestActions, emailDraft, summary, riskFactors,
    modelVersion: 'mock-1.0', createdAt: new Date()
  };

  await db.collection('dealAIInsights').updateOne(
    { dealId },
    { $set: insight },
    { upsert: true }
  );

  // Also update the deal with close probability
  await db.collection('deals').updateOne(
    { id: dealId },
    { $set: { closeProbability, riskLevel } }
  );

  const { _id, ...rest } = insight;
  return ok({ insight: rest });
}

// --- Forecast ---
async function handleGetForecast(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();

  let dealFilter = {};
  if (user.role === 'REP') dealFilter = { ownerId: user.id };
  else if (user.role === 'MANAGER' && user.teamId) {
    const teamUsers = await db.collection('users').find({ teamId: user.teamId }).toArray();
    dealFilter = { ownerId: { $in: teamUsers.map(u => u.id) } };
  }

  const allDeals = await db.collection('deals').find(dealFilter).toArray();
  const activeDeals = allDeals.filter(d => !['WON', 'LOST'].includes(d.stage));
  const wonDeals = allDeals.filter(d => d.stage === 'WON');

  // Historical monthly revenue (past 6 months)
  const historical = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const monthDeals = wonDeals.filter(deal => {
      const closeDate = new Date(deal.updatedAt || deal.createdAt);
      return closeDate >= monthStart && closeDate <= monthEnd;
    });
    historical.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      monthDate: monthStart,
      actual: monthDeals.reduce((s, d) => s + (d.amount || 0), 0)
    });
  }

  // Forecast next 6 months using weighted pipeline
  const forecast = [];
  const avgHistorical = historical.reduce((s, h) => s + h.actual, 0) / Math.max(historical.filter(h => h.actual > 0).length, 1);

  for (let i = 1; i <= 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    // Weighted pipeline for this month
    const monthDeals = activeDeals.filter(deal => {
      if (!deal.expectedCloseDate) return false;
      const closeDate = new Date(deal.expectedCloseDate);
      return closeDate >= monthStart && closeDate <= monthEnd;
    });

    const weighted = monthDeals.reduce((s, d) => {
      const prob = d.closeProbability || (mockCloseProbability(d, 3));
      return s + (d.amount || 0) * prob;
    }, 0);

    // Blend with historical average
    const predicted = Math.round(weighted * 0.7 + avgHistorical * 0.3);
    const confidence = Math.max(0.4, Math.min(0.9, 1 - (i * 0.08)));

    forecast.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      monthDate: monthStart,
      predicted: Math.round(predicted),
      optimistic: Math.round(predicted * (1 + (1 - confidence) * 0.5)),
      pessimistic: Math.round(predicted * confidence),
      confidence: Math.round(confidence * 100)
    });
  }

  // Save forecast snapshots
  for (const f of forecast) {
    await db.collection('forecastSnapshots').updateOne(
      { periodMonth: f.month, ownerId: user.role === 'REP' ? user.id : null, teamId: user.teamId || null },
      { $set: { id: uuidv4(), predictedRevenue: f.predicted, confidence: f.confidence, modelVersion: 'mock-1.0', createdAt: new Date(), ...f } },
      { upsert: true }
    );
  }

  return ok({ historical, forecast, summary: { totalPipeline: activeDeals.reduce((s, d) => s + (d.amount || 0), 0), weightedPipeline: Math.round(activeDeals.reduce((s, d) => s + (d.amount || 0) * (d.closeProbability || 0.3), 0)), totalForecast: forecast.reduce((s, f) => s + f.predicted, 0) } });
}

// --- ML Retrain ---
async function handleRetrain(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  if (user.role === 'REP') return fail('Only managers and admins can retrain', 403);
  const db = await getDb();

  // Get labeled deals
  const labeledDeals = await db.collection('deals').find({ stage: { $in: ['WON', 'LOST'] } }).toArray();

  if (labeledDeals.length < 5) {
    return ok({ message: 'Not enough labeled data for training (need at least 5 WON/LOST deals)', trained: false, dealCount: labeledDeals.length });
  }

  // Update all active deals with new probabilities
  const activeDeals = await db.collection('deals').find({ stage: { $nin: ['WON', 'LOST'] } }).toArray();
  for (const deal of activeDeals) {
    const actCount = await db.collection('activities').countDocuments({ dealId: deal.id });
    const prob = mockCloseProbability(deal, actCount);
    await db.collection('deals').updateOne({ id: deal.id }, { $set: { closeProbability: prob, riskLevel: mockRiskLevel(prob) } });
  }

  await db.collection('settings').updateOne(
    { id: 'settings-global' },
    { $set: { modelVersion: '1.0.' + Date.now(), lastTrainedAt: new Date() } },
    { upsert: true }
  );

  return ok({
    message: 'Model retrained successfully (mock mode)',
    trained: true,
    dealCount: labeledDeals.length,
    updatedDeals: activeDeals.length
  });
}

// --- Admin Users ---
async function handleGetUsers(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') return fail('Insufficient permissions', 403);
  const db = await getDb();
  let filter = {};
  if (user.role === 'MANAGER') filter = { teamId: user.teamId };
  const users = await db.collection('users').find(filter).toArray();
  const teams = await db.collection('teams').find({}).toArray();
  return ok({
    users: users.map(safeUser),
    teams: teams.map(t => { const { _id, ...r } = t; return r; })
  });
}

async function handleUpdateUser(request, id) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  if (user.role !== 'ADMIN') return fail('Only admins can update users', 403);
  try {
    const body = await request.json();
    const db = await getDb();
    const update = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.role !== undefined) update.role = body.role;
    if (body.teamId !== undefined) update.teamId = body.teamId;
    await db.collection('users').updateOne({ id }, { $set: update });
    const updated = await db.collection('users').findOne({ id });
    return ok({ user: safeUser(updated) });
  } catch (e) {
    return fail('Failed to update user: ' + e.message, 500);
  }
}

// --- Settings ---
async function handleGetSettings(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  const settings = await db.collection('settings').findOne({ id: 'settings-global' });
  if (!settings) return ok({ settings: { aiMode: 'mock', modelVersion: '1.0.0', lastTrainedAt: null } });
  const { _id, ...rest } = settings;
  return ok({ settings: rest });
}

async function handleUpdateSettings(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  if (user.role !== 'ADMIN') return fail('Only admins can update settings', 403);
  try {
    const body = await request.json();
    const db = await getDb();
    const update = {};
    if (body.aiMode !== undefined) update.aiMode = body.aiMode;
    await db.collection('settings').updateOne(
      { id: 'settings-global' },
      { $set: update },
      { upsert: true }
    );
    return ok({ message: 'Settings updated' });
  } catch (e) {
    return fail('Failed to update settings: ' + e.message, 500);
  }
}

// --- Audit Trail ---
async function handleGetAuditTrail(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  const url = new URL(request.url);
  const entityId = url.searchParams.get('entityId');
  const filter = entityId ? { entityId } : {};
  const trail = await db.collection('auditTrail').find(filter).sort({ createdAt: -1 }).limit(50).toArray();
  return ok({ trail: trail.map(t => { const { _id, ...r } = t; return r; }) });
}

// --- Teams ---
async function handleGetTeams(request) {
  const user = await getUser(request);
  if (!user) return fail('Unauthorized', 401);
  const db = await getDb();
  const teams = await db.collection('teams').find({}).toArray();
  return ok({ teams: teams.map(t => { const { _id, ...r } = t; return r; }) });
}

// --- Router ---
async function handleRequest(request, context) {
  try {
    const { path } = context.params;
    const p = (path || []).join('/');
    const method = request.method;

    // Public routes
    if (method === 'POST' && p === 'auth/login') return handleLogin(request);
    if (method === 'POST' && p === 'auth/register') return handleRegister(request);
    if (method === 'POST' && p === 'seed') return handleSeed();

    // Auth required routes
    if (method === 'GET' && p === 'auth/me') return handleMe(request);
    if (method === 'GET' && p === 'dashboard/stats') return handleDashboardStats(request);

    // Accounts
    if (method === 'GET' && p === 'accounts') return handleGetAccounts(request);
    if (method === 'POST' && p === 'accounts') return handleCreateAccount(request);

    // Contacts
    if (method === 'POST' && p === 'contacts') return handleCreateContact(request);

    // Deals
    if (method === 'GET' && p === 'deals') return handleGetDeals(request);
    if (method === 'POST' && p === 'deals') return handleCreateDeal(request);

    // Forecast
    if (method === 'GET' && p === 'forecast') return handleGetForecast(request);

    // ML
    if (method === 'POST' && p === 'ml/retrain') return handleRetrain(request);

    // Admin
    if (method === 'GET' && p === 'admin/users') return handleGetUsers(request);

    // Settings
    if (method === 'GET' && p === 'settings') return handleGetSettings(request);
    if (method === 'PUT' && p === 'settings') return handleUpdateSettings(request);

    // Teams
    if (method === 'GET' && p === 'teams') return handleGetTeams(request);

    // Audit trail
    if (method === 'GET' && p === 'audit') return handleGetAuditTrail(request);

    // Dynamic routes
    const parts = (path || []);

    // /accounts/:id
    if (parts.length === 2 && parts[0] === 'accounts') {
      const id = parts[1];
      if (method === 'GET') return handleGetAccount(request, id);
      if (method === 'PUT') return handleUpdateAccount(request, id);
      if (method === 'DELETE') return handleDeleteAccount(request, id);
    }

    // /accounts/:id/contacts
    if (parts.length === 3 && parts[0] === 'accounts' && parts[2] === 'contacts') {
      const db = await getDb();
      const contacts = await db.collection('contacts').find({ accountId: parts[1] }).toArray();
      return ok({ contacts: contacts.map(c => { const { _id, ...r } = c; return r; }) });
    }

    // /deals/:id
    if (parts.length === 2 && parts[0] === 'deals') {
      const id = parts[1];
      if (method === 'GET') return handleGetDeal(request, id);
      if (method === 'PUT') return handleUpdateDeal(request, id);
      if (method === 'DELETE') return handleDeleteDeal(request, id);
    }

    // /deals/:id/stage
    if (parts.length === 3 && parts[0] === 'deals' && parts[2] === 'stage') {
      if (method === 'PUT') return handleUpdateDealStage(request, parts[1]);
    }

    // /deals/:id/activities
    if (parts.length === 3 && parts[0] === 'deals' && parts[2] === 'activities') {
      if (method === 'GET') return handleGetActivities(request, parts[1]);
      if (method === 'POST') return handleCreateActivity(request, parts[1]);
    }

    // /deals/:id/insights
    if (parts.length === 3 && parts[0] === 'deals' && parts[2] === 'insights') {
      if (method === 'POST') return handleGenerateInsights(request, parts[1]);
    }

    // /admin/users/:id
    if (parts.length === 3 && parts[0] === 'admin' && parts[1] === 'users') {
      if (method === 'PUT') return handleUpdateUser(request, parts[2]);
    }

    return fail('Not found', 404);
  } catch (e) {
    console.error('API Error:', e);
    return fail('Internal server error: ' + e.message, 500);
  }
}

export async function GET(request, context) {
  return handleRequest(request, context);
}

export async function POST(request, context) {
  return handleRequest(request, context);
}

export async function PUT(request, context) {
  return handleRequest(request, context);
}

export async function DELETE(request, context) {
  return handleRequest(request, context);
}
