import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { rateLimit } from '../middlewares/rateLimit';
import { notificationEmitter } from './notification.routes';

const router = Router();

router.post('/', rateLimit(10, 60 * 60 * 1000), async (req, res) => {
  try {
    const {
      // Original fields
      orgName, orgType, contactName, contactEmail, contactPhone,
      websiteUrl, domain, reason, preferredPassword,
      // Step 1
      industry, orgSize, linkedinOrgUrl,
      // Step 2 — Legal & Location
      address, city, state, country, pincode,
      gstNumber, panNumber, cinNumber, regNumber, taxId,
      aisheCode, nirfRanking, affiliatedTo,
      // Step 3 — Contact Officer
      contactDesignation, contactAlternateEmail, domainMismatchReason,
      // Step 4 — Platform Requirements
      useCases, expectedCandidates, preferredFormat, hearAboutUs, referralCode,
      // Step 5 — Legal Agreements
      dpaAgreed, certifiedRepresentative,
    } = req.body;

    if (!orgName || !orgType || !contactName || !contactEmail) {
      return res.status(400).json({ error: 'Organization name, type, contact name, and contact email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return res.status(400).json({ error: 'Invalid contact email format' });
    }

    // Enforce legal agreements
    if (!dpaAgreed) {
      return res.status(400).json({ error: 'Data Processing Agreement (DPA) consent is required.' });
    }
    if (!certifiedRepresentative) {
      return res.status(400).json({ error: 'You must certify that you are an authorized representative of the organization.' });
    }

    // Validate GST format (India) if provided
    if (gstNumber) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
      if (!gstRegex.test(gstNumber.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid GST number format. Expected: 15-character alphanumeric (e.g., 22AAAAA0000A1Z5)' });
      }
    }

    // Validate PAN format (India) if provided
    if (panNumber) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
      if (!panRegex.test(panNumber.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid PAN number format. Expected: 10-character (e.g., ABCDE1234F)' });
      }
    }

    const existing = await prisma.organizationRequest.findFirst({
      where: { contactEmail, status: 'PENDING' },
    });
    if (existing) {
      return res.status(409).json({ error: 'A pending verification request already exists for this contact email address.' });
    }

    // Extract domain automatically if not explicitly provided
    const extractedDomain = domain || contactEmail.split('@')[1];

    // Domain match check
    let domainMatch = false;
    if (websiteUrl && extractedDomain) {
      try {
        const webDomain = new URL(websiteUrl).hostname.replace(/^www\./, '');
        domainMatch = webDomain.toLowerCase() === extractedDomain.toLowerCase();
      } catch (_) {
        domainMatch = false;
      }
    }

    let passwordHash = null;
    if (preferredPassword) {
      passwordHash = await bcrypt.hash(preferredPassword, 12);
    }

    // Embed metadata in reason field safely
    const payloadMetadata = JSON.stringify({
      userReason: reason || 'Standard Organization Registration',
      passwordHash,
      submittedIp: req.ip || '127.0.0.1',
      domainMatch,
    });

    // Compute risk score: more complete = lower risk
    const riskFactors = [
      !domainMatch ? 30 : 0,
      !gstNumber && !panNumber && !cinNumber && !regNumber ? 20 : 0,
      !address ? 10 : 0,
      !contactDesignation ? 10 : 0,
      !websiteUrl ? 15 : 0,
    ];
    const computedRiskScore = riskFactors.reduce((a, b) => a + b, 0);

    const request = await prisma.organizationRequest.create({
      data: {
        orgName, orgType, contactName, contactEmail,
        contactPhone: contactPhone || null,
        websiteUrl: websiteUrl || null,
        domain: extractedDomain,
        reason: payloadMetadata,
        // Step 1
        industry: industry || null,
        orgSize: orgSize || null,
        linkedinOrgUrl: linkedinOrgUrl || null,
        // Step 2
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        pincode: pincode || null,
        gstNumber: gstNumber ? gstNumber.toUpperCase() : null,
        panNumber: panNumber ? panNumber.toUpperCase() : null,
        cinNumber: cinNumber || null,
        regNumber: regNumber || null,
        taxId: taxId || null,
        aisheCode: aisheCode || null,
        nirfRanking: nirfRanking || null,
        affiliatedTo: affiliatedTo || null,
        // Step 3
        contactDesignation: contactDesignation || null,
        contactAlternateEmail: contactAlternateEmail || null,
        domainMismatchReason: domainMismatchReason || null,
        // Step 4
        useCases: useCases || [],
        expectedCandidates: expectedCandidates || null,
        preferredFormat: preferredFormat || [],
        hearAboutUs: hearAboutUs || null,
        referralCode: referralCode || null,
        // Step 5
        dpaAgreed: !!dpaAgreed,
        certifiedRepresentative: !!certifiedRepresentative,
      },
    });

    // Send instant push notification to all Super Admin accounts
    try {
      const superAdmins = await prisma.user.findMany({
        where: { OR: [{ role: 'SUPER_ADMIN' }, { id: 'admin-id' }] },
        select: { id: true },
      });

      for (const admin of superAdmins) {
        const notification = await prisma.notification.create({
          data: {
            userId: admin.id,
            title: `🏢 New Tenant Verification Request — ${orgName}`,
            message: `${contactName} (${contactDesignation || 'Representative'}, ${contactEmail}) submitted a verification request for "${orgName}" (${orgType} · ${industry || 'N/A'}). Domain: ${extractedDomain}. Risk Score: ${computedRiskScore}/85. GST: ${gstNumber ? '✓' : '—'} | Address: ${address ? '✓' : '—'}`,
            type: 'SYSTEM_ALERT',
            data: {
              requestId: request.id, orgName, contactEmail, domain: extractedDomain,
              industry, orgSize, city, country, riskScore: computedRiskScore,
              gstProvided: !!gstNumber, panProvided: !!panNumber, domainMatch,
              useCases: useCases || [],
            },
          },
        });
        notificationEmitter.emit('push', { targetUserId: admin.id, notification });
      }
    } catch (_notifyErr) {
      console.warn('Super admin notification error:', _notifyErr);
    }

    res.status(201).json({
      message: 'Organization request submitted successfully. Official verification dossier generated.',
      requestId: request.id,
      domain: extractedDomain,
    });
  } catch (error) {
    console.error('Org request error:', error);
    res.status(500).json({ error: 'Failed to submit organization request' });
  }
});

router.get('/', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { page = '1', limit = '50', status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const [requests, total, pendingCount] = await Promise.all([
      prisma.organizationRequest.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.organizationRequest.count({ where }),
      prisma.organizationRequest.count({ where: { status: 'PENDING' } }),
    ]);

    // Parse embedded payload metadata safely
    const formatted = requests.map((r: any) => {
      let meta: any = {};
      try {
        if (r.reason && r.reason.startsWith('{')) {
          meta = JSON.parse(r.reason);
        }
      } catch (_e) {}

      const contactDomain = r.contactEmail.split('@')[1];
      const reqDomain = r.domain || contactDomain;
      const domainMatch = meta.domainMatch ?? (contactDomain.toLowerCase() === reqDomain.toLowerCase());

      // Recompute risk score from actual stored fields
      const riskFactors = [
        !domainMatch ? 30 : 0,
        !r.gstNumber && !r.panNumber && !r.cinNumber && !r.regNumber ? 20 : 0,
        !r.address ? 10 : 0,
        !r.contactDesignation ? 10 : 0,
        !r.websiteUrl ? 15 : 0,
      ];
      const riskScore = riskFactors.reduce((a: number, b: number) => a + b, 0);

      return {
        ...r,
        parsedReason: meta.userReason || r.reason || 'N/A',
        hasPasswordSet: !!meta.passwordHash,
        domainMatch,
        riskScore,
      };
    });

    res.json({
      requests: formatted,
      total,
      pendingCount,
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
    if (request.status !== 'PENDING') return res.status(400).json({ error: `Request already ${request.status.toLowerCase()}` });

    const slug = request.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const targetDomain = request.domain || request.contactEmail.split('@')[1];

    let finalDomain: string | null = targetDomain;
    if (targetDomain) {
      const existingDomain = await prisma.organization.findFirst({ where: { domain: targetDomain } });
      if (existingDomain) {
        const subPrefix = slug.replace(/-+/g, '');
        finalDomain = `${subPrefix.slice(0, 15)}.${targetDomain}`;
        const subExists = await prisma.organization.findFirst({ where: { domain: finalDomain } });
        if (subExists) {
          finalDomain = `${subPrefix.slice(0, 10)}-${Date.now().toString(36)}.${targetDomain}`;
        }
      }
    }

    let finalSlug = slug;
    const existingSlug = await prisma.organization.findFirst({ where: { slug: finalSlug } });
    if (existingSlug) {
      finalSlug = `${slug}-${Date.now().toString(36)}`;
    }

    // 1. Create Organization safely
    const org = await prisma.organization.create({
      data: {
        name: request.orgName,
        slug: finalSlug,
        domain: finalDomain,
        status: 'ACTIVE',
        subscriptionTier: 'FREE',
      },
    });

    // Parse password hash if user set one during request
    let passwordHash = await bcrypt.hash('OrgAdmin@123456', 12);
    try {
      if (request.reason && request.reason.startsWith('{')) {
        const meta = JSON.parse(request.reason);
        if (meta.passwordHash) {
          passwordHash = meta.passwordHash;
        }
      }
    } catch (_e) {}

    // 2. Create or Update ORG_ADMIN user account
    const existingUser = await prisma.user.findUnique({ where: { email: request.contactEmail } });
    let adminUser: any = null;

    if (existingUser) {
      adminUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'ORG_ADMIN',
          organizationId: org.id,
          status: 'ACTIVE',
        },
      });
    } else {
      adminUser = await prisma.user.create({
        data: {
          name: request.contactName,
          email: request.contactEmail,
          password: passwordHash,
          role: 'ORG_ADMIN',
          organizationId: org.id,
          status: 'ACTIVE',
        },
      });
    }

    // 3. Mark Request Approved
    await prisma.organizationRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedById: req.user!.userId,
        reviewedAt: new Date(),
      },
    });

    // 4. Create Audit Log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        organizationId: org.id,
        action: 'ORG_REQUEST_APPROVED',
        resource: 'organization_request',
        resourceId: request.id,
        details: { orgName: request.orgName, contactEmail: request.contactEmail, orgId: org.id, adminUserId: adminUser.id },
      },
    });

    // 5. Send Welcome Notification to newly created Org Admin
    const welcomeNotification = await prisma.notification.create({
      data: {
        userId: adminUser.id,
        title: `🏛️ Organization Verified & Provisioned — ${org.name}`,
        message: `Congratulations! Your organization request for "${org.name}" has been officially verified and approved by Platform Super Admin. You are now designated as Chief ORG_ADMIN.`,
        type: 'SYSTEM_ALERT',
        data: { organizationId: org.id, orgName: org.name },
      },
    });
    notificationEmitter.emit('push', { targetUserId: adminUser.id, notification: welcomeNotification });

    res.json({
      message: `Organization "${org.name}" approved & provisioned successfully! Admin account created for ${adminUser.email}.`,
      organization: org,
      adminUser: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
    });
  } catch (error: any) {
    console.error('Approve org request error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve organization request' });
  }
});

router.post('/:id/reject', authenticateToken, requireRole('super_admin'), async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    const request = await prisma.organizationRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: `Request already ${request.status.toLowerCase()}` });

    await prisma.organizationRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedById: req.user!.userId,
        reviewNotes: reviewNotes || 'Verification criteria not satisfied.',
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ORG_REQUEST_REJECTED',
        resource: 'organization_request',
        resourceId: request.id,
        details: { orgName: request.orgName, contactEmail: request.contactEmail, reason: reviewNotes },
      },
    });

    res.json({ message: `Request for "${request.orgName}" flagged and rejected.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject organization request' });
  }
});

export default router;
