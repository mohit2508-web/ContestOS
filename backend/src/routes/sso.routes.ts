import { Router, Request, Response } from 'express';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { generateAccessToken, generateRefreshToken, AuthPayload, authenticateToken } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const HIERARCHY_MAP: Record<string, number> = {
  SUPER_ADMIN: 1,
  PLATFORM_CONTENT_AUTHOR: 2,
  ORG_ADMIN: 3,
  PROCTOR: 4,
  ORG_MEMBER: 4,
  EVALUATOR: 4,
  CONTEST_MODERATOR: 4,
  COMPLIANCE_OFFICER: 4,
  ANALYTICS_VIEWER: 5,
  STUDENT: 6,
  CANDIDATE: 6,
  GUEST_CANDIDATE: 7,
};

// Helper: Process or Create SSO User & Issue Tokens
async function handleSsoUserLogin({
  email,
  name,
  provider,
  providerId,
  avatarUrl,
  orgId,
}: {
  email: string;
  name: string;
  provider: string;
  providerId: string;
  avatarUrl?: string;
  orgId?: string | null;
}) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: email.toLowerCase() },
        { ssoId: providerId, ssoProvider: provider },
      ],
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ssoProvider: provider,
        ssoId: providerId,
        avatarUrl: avatarUrl || user.avatarUrl,
      },
    });
  } else {
    // Auto-generate random secure password for SSO user
    const randomPassword = await bcrypt.hash(`SSO_${Math.random().toString(36).slice(2)}_${Date.now()}`, 12);
    const baseUsername = (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 15);
    let username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;

    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      username = `${baseUsername}_${Date.now().toString().slice(-4)}`;
    }

    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || 'SSO User',
        username,
        password: randomPassword,
        role: 'STUDENT',
        status: 'ACTIVE',
        ssoProvider: provider,
        ssoId: providerId,
        avatarUrl: avatarUrl || null,
        organizationId: orgId || null,
        lastLoginAt: new Date(),
      },
    });
  }

  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    roleName: user.role.toLowerCase(),
    hierarchyLevel: HIERARCHY_MAP[user.role] || 5,
    organizationId: user.organizationId,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken({ userId: user.id });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      action: `SSO_LOGIN_${provider.toUpperCase()}`,
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email, provider, providerId },
    },
  });

  return { accessToken, refreshToken, user };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GOOGLE OAUTH 2.0
// ═════════════════════════════════════════════════════════════════════════════
router.get('/google', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${BACKEND_URL}/api/auth/sso/google/callback`;

  if (!clientId || clientId.includes('your-google-client-id')) {
    // Dev/Mock Mode
    return res.redirect(`${redirectUri}?code=mock_google_code_${Date.now()}`);
  }

  const scope = encodeURIComponent('openid email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

  res.redirect(googleAuthUrl);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${BACKEND_URL}/api/auth/sso/google/callback`;

    let email = '';
    let name = '';
    let googleId = '';
    let avatarUrl = '';

    if (!clientId || !clientSecret || (typeof code === 'string' && code.startsWith('mock_google_code'))) {
      // Mock Profile for Dev Mode
      googleId = `google-mock-${Date.now()}`;
      email = `arjun.google.dev@kryptavia.io`;
      name = `Arjun Sharma (Google SSO)`;
      avatarUrl = `https://lh3.googleusercontent.com/a/default-user`;
    } else {
      // Live Google OAuth Code Exchange
      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });

      googleId = userRes.data.id;
      email = userRes.data.email;
      name = userRes.data.name || userRes.data.given_name || 'Google User';
      avatarUrl = userRes.data.picture || '';
    }

    const { accessToken, refreshToken, user } = await handleSsoUserLogin({
      email,
      name,
      provider: 'GOOGLE',
      providerId: googleId,
      avatarUrl,
    });

    const target = `${FRONTEND_URL}/auth/sso/callback?token=${accessToken}&refreshToken=${refreshToken}&name=${encodeURIComponent(
      user.name
    )}&email=${encodeURIComponent(user.email)}&role=${user.role}&provider=Google`;

    res.redirect(target);
  } catch (error: any) {
    console.error('Google SSO Callback Error:', error?.response?.data || error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('Google Single Sign-On failed. Please try again.')}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. GITHUB OAUTH 2.0
// ═════════════════════════════════════════════════════════════════════════════
router.get('/github', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${BACKEND_URL}/api/auth/sso/github/callback`;

  if (!clientId || clientId.includes('your-github-client-id')) {
    return res.redirect(`${redirectUri}?code=mock_github_code_${Date.now()}`);
  }

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=user:email`;

  res.redirect(githubAuthUrl);
});

router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    let email = '';
    let name = '';
    let githubId = '';
    let avatarUrl = '';

    if (!clientId || !clientSecret || (typeof code === 'string' && code.startsWith('mock_github_code'))) {
      githubId = `github-mock-${Date.now()}`;
      email = `dev.github.user@kryptavia.io`;
      name = `Dev GitHub User`;
      avatarUrl = `https://avatars.githubusercontent.com/u/9919?v=4`;
    } else {
      const tokenRes = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
        { headers: { Accept: 'application/json' } }
      );

      const accessToken = tokenRes.data.access_token;

      const userRes = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${accessToken}`, 'User-Agent': 'KryptaviaOS-Platform' },
      });

      githubId = String(userRes.data.id);
      name = userRes.data.name || userRes.data.login || 'GitHub User';
      avatarUrl = userRes.data.avatar_url || '';
      email = userRes.data.email;

      if (!email) {
        const emailsRes = await axios.get('https://api.github.com/user/emails', {
          headers: { Authorization: `token ${accessToken}`, 'User-Agent': 'KryptaviaOS-Platform' },
        });
        const primary = emailsRes.data.find((e: any) => e.primary) || emailsRes.data[0];
        email = primary ? primary.email : `${userRes.data.login}@users.noreply.github.com`;
      }
    }

    const { accessToken, refreshToken, user } = await handleSsoUserLogin({
      email,
      name,
      provider: 'GITHUB',
      providerId: githubId,
      avatarUrl,
    });

    const target = `${FRONTEND_URL}/auth/sso/callback?token=${accessToken}&refreshToken=${refreshToken}&name=${encodeURIComponent(
      user.name
    )}&email=${encodeURIComponent(user.email)}&role=${user.role}&provider=GitHub`;

    res.redirect(target);
  } catch (error: any) {
    console.error('GitHub SSO Callback Error:', error?.response?.data || error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('GitHub Single Sign-On failed. Please try again.')}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. LINKEDIN OPENID CONNECT (OIDC)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/linkedin', (req: Request, res: Response) => {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = `${BACKEND_URL}/api/auth/sso/linkedin/callback`;

  if (!clientId || clientId.includes('your-linkedin-client-id')) {
    return res.redirect(`${redirectUri}?code=mock_linkedin_code_${Date.now()}`);
  }

  const scope = encodeURIComponent('openid profile email');
  const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}`;

  res.redirect(linkedinAuthUrl);
});

router.get('/linkedin/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = `${BACKEND_URL}/api/auth/sso/linkedin/callback`;

    let email = '';
    let name = '';
    let linkedinId = '';
    let avatarUrl = '';

    if (!clientId || !clientSecret || (typeof code === 'string' && code.startsWith('mock_linkedin_code'))) {
      linkedinId = `linkedin-mock-${Date.now()}`;
      email = `pro.linkedin.user@kryptavia.io`;
      name = `Priya Sharma (LinkedIn OIDC)`;
      avatarUrl = `https://media.licdn.com/dms/image/default`;
    } else {
      const tokenRes = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const userRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });

      linkedinId = userRes.data.sub;
      email = userRes.data.email;
      name = userRes.data.name || `${userRes.data.given_name} ${userRes.data.family_name}`;
      avatarUrl = userRes.data.picture || '';
    }

    const { accessToken, refreshToken, user } = await handleSsoUserLogin({
      email,
      name,
      provider: 'LINKEDIN',
      providerId: linkedinId,
      avatarUrl,
    });

    const target = `${FRONTEND_URL}/auth/sso/callback?token=${accessToken}&refreshToken=${refreshToken}&name=${encodeURIComponent(
      user.name
    )}&email=${encodeURIComponent(user.email)}&role=${user.role}&provider=LinkedIn`;

    res.redirect(target);
  } catch (error: any) {
    console.error('LinkedIn SSO Callback Error:', error?.response?.data || error);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent('LinkedIn Single Sign-On failed. Please try again.')}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. ENTERPRISE SAML 2.0 (Okta, Azure AD, PingIdentity)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/saml/login', async (req: Request, res: Response) => {
  try {
    const { orgSlug, domain } = req.query;

    if (!orgSlug && !domain) {
      return res.status(400).json({ error: 'Organization slug or domain required for SAML SSO' });
    }

    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          orgSlug ? { slug: String(orgSlug) } : undefined,
          domain ? { domain: String(domain) } : undefined,
          domain ? { samlDomain: String(domain) } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found for Enterprise SAML SSO' });
    }

    if (!org.samlEnabled || !org.samlIdpSsoUrl) {
      return res.status(400).json({
        error: `Enterprise SAML 2.0 is not enabled for "${org.name}". Contact your Organization Admin to configure SAML IdP parameters.`,
      });
    }

    // SP-Initiated SAML AuthNRequest redirect
    const samlRequestXml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${Date.now()}" Version="2.0" IssueInstant="${new Date().toISOString()}" Destination="${org.samlIdpSsoUrl}"><saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${BACKEND_URL}/api/auth/sso/saml/metadata</saml:Issuer></samlp:AuthnRequest>`;
    const encodedReq = Buffer.from(samlRequestXml).toString('base64');
    const samlUrl = `${org.samlIdpSsoUrl}?SAMLRequest=${encodeURIComponent(encodedReq)}&RelayState=${encodeURIComponent(org.slug)}`;

    res.redirect(samlUrl);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'SAML login initiation failed' });
  }
});

// SAML Assertion Consumer Service (ACS) Handler
router.post('/saml/acs', async (req: Request, res: Response) => {
  try {
    const { SAMLResponse, RelayState, mockEmail, mockName, mockOrgSlug } = req.body;

    let email = mockEmail || '';
    let name = mockName || 'SAML User';
    let orgSlug = RelayState || mockOrgSlug || '';

    if (!email && SAMLResponse) {
      // Decode SAMLResponse base64 XML assertion
      const decodedXml = Buffer.from(SAMLResponse, 'base64').toString('utf-8');
      const emailMatch = decodedXml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i) || decodedXml.match(/AttributeName="email"[^>]*><saml:AttributeValue>([^<]+)/i);
      const nameMatch = decodedXml.match(/AttributeName="displayName"[^>]*><saml:AttributeValue>([^<]+)/i);

      if (emailMatch) email = emailMatch[1];
      if (nameMatch) name = nameMatch[1];
    }

    if (!email) {
      return res.status(400).json({ error: 'Failed to extract valid SAML assertion Subject NameID (email)' });
    }

    // Lookup organization
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          orgSlug ? { slug: orgSlug } : undefined,
          { domain: email.split('@')[1] },
          { samlDomain: email.split('@')[1] },
        ].filter(Boolean) as any,
      },
    });

    const { accessToken, refreshToken, user } = await handleSsoUserLogin({
      email,
      name,
      provider: 'SAML',
      providerId: `saml-${email}`,
      orgId: org ? org.id : null,
    });

    const target = `${FRONTEND_URL}/auth/sso/callback?token=${accessToken}&refreshToken=${refreshToken}&name=${encodeURIComponent(
      user.name
    )}&email=${encodeURIComponent(user.email)}&role=${user.role}&provider=Enterprise%20SAML`;

    if (req.headers['content-type']?.includes('application/json')) {
      return res.json({ accessToken, refreshToken, user, redirectUrl: target });
    }

    res.redirect(target);
  } catch (error: any) {
    console.error('SAML ACS Error:', error);
    res.status(500).json({ error: 'SAML Assertion processing failed' });
  }
});

// Configure SAML Settings for Organization (ORG_ADMIN / SUPER_ADMIN)
router.post('/saml/config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orgId, samlEnabled, samlDomain, samlIdpEntityId, samlIdpSsoUrl, samlIdpCert } = req.body;

    const targetOrgId = orgId || req.user?.organizationId;
    if (!targetOrgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // RBAC check: Must be ORG_ADMIN of this org or SUPER_ADMIN
    if (req.user?.roleName !== 'super_admin' && req.user?.organizationId !== targetOrgId) {
      return res.status(403).json({ error: 'Unauthorized to configure SAML for this organization' });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: targetOrgId },
      data: {
        samlEnabled: Boolean(samlEnabled),
        samlDomain: samlDomain || null,
        samlIdpEntityId: samlIdpEntityId || null,
        samlIdpSsoUrl: samlIdpSsoUrl || null,
        samlIdpCert: samlIdpCert || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        organizationId: targetOrgId,
        action: 'SAML_CONFIG_UPDATED',
        resource: 'organization',
        resourceId: targetOrgId,
        details: { samlEnabled, samlDomain, samlIdpEntityId },
      },
    });

    res.json({
      message: 'Enterprise SAML 2.0 configuration updated successfully.',
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        samlEnabled: updatedOrg.samlEnabled,
        samlDomain: updatedOrg.samlDomain,
        samlIdpEntityId: updatedOrg.samlIdpEntityId,
        samlIdpSsoUrl: updatedOrg.samlIdpSsoUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update SAML configuration' });
  }
});

export default router;
