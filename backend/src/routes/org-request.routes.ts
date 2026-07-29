import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { rateLimit } from '../middlewares/rateLimit';

const router = Router();

router.post('/', rateLimit(3, 60 * 60 * 1000), async (req, res) => {
  try {
    const { orgName, orgType, contactName, contactEmail, contactPhone, websiteUrl, domain, reason } = req.body;

    if (!orgName || !orgType || !contactName || !contactEmail) {
      return res.status(400).json({ error: 'Organization name, type, contact name, and contact email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return res.status(400).json({ error: 'Invalid contact email format' });
    }

    const existing = await prisma.organizationRequest.findFirst({
      where: { contactEmail, status: 'PENDING' },
    });
    if (existing) {
      return res.status(409).json({ error: 'A pending request already exists for this email' });
    }

    const request = await prisma.organizationRequest.create({
      data: {
        orgName,
        orgType,
        contactName,
        contactEmail,
        contactPhone: contactPhone || null,
        websiteUrl: websiteUrl || null,
        domain: domain || null,
        reason: reason || null,
      },
    });

    res.status(201).json({
      message: 'Organization request submitted. Our team will review it and get back to you within 24-48 hours.',
      requestId: request.id,
    });
  } catch (error) {
    console.error('Org request error:', error);
    res.status(500).json({ error: 'Failed to submit organization request' });
  }
});

router.get('/', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.organizationRequest.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organizationRequest.count({ where }),
    ]);

    res.json({
      requests,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization requests' });
  }
});

router.post('/:id/approve', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const request = await prisma.organizationRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Request already processed' });

    const slug = request.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const org = await prisma.organization.create({
      data: {
        name: request.orgName,
        slug: slug + '-' + Date.now().toString(36),
        domain: request.domain || request.contactEmail.split('@')[1],
      },
    });

    await prisma.organizationRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedById: req.user!.userId,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        organizationId: org.id,
        action: 'ORG_REQUEST_APPROVE',
        resource: 'organization_request',
        resourceId: request.id,
        details: { orgName: request.orgName, orgId: org.id },
      },
    });

    res.json({
      message: 'Organization approved and created',
      organization: org,
      inviteLink: `/accept-invite?orgId=${org.id}&email=${encodeURIComponent(request.contactEmail)}&role=ORG_ADMIN`,
    });
  } catch (error) {
    console.error('Approve org request error:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

router.post('/:id/reject', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    const request = await prisma.organizationRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Request already processed' });

    await prisma.organizationRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedById: req.user!.userId,
        reviewNotes: reviewNotes || null,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ORG_REQUEST_REJECT',
        resource: 'organization_request',
        resourceId: request.id,
        details: { orgName: request.orgName, reason: reviewNotes },
      },
    });

    res.json({ message: 'Request rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

export default router;
