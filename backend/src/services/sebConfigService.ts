import crypto from 'crypto';

interface SebConfigOptions {
  contestId: string;
  contestTitle: string;
  startUrl: string;
  allowQuit?: boolean;
  quitPassword?: string;
  adminPassword?: string;
  enableURLFilter?: boolean;
}

/**
 * Generates an official Safe Exam Browser (.seb) XML configuration file.
 */
export function generateSebConfig(options: SebConfigOptions): string {
  const {
    contestTitle,
    startUrl,
    allowQuit = true,
    quitPassword = '',
    adminPassword = '',
  } = options;

  const hashedQuitPwd = quitPassword
    ? crypto.createHash('sha256').update(quitPassword).digest('hex')
    : '';

  const hashedAdminPwd = adminPassword
    ? crypto.createHash('sha256').update(adminPassword).digest('hex')
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB 3.0</string>

    <!-- Start URL for Kryptavia OS Exam -->
    <key>startURL</key>
    <string>${startUrl}</string>

    <key>startDiagnosticMode</key>
    <false/>

    <!-- User & Exit Controls -->
    <key>allowQuit</key>
    <${allowQuit ? 'true' : 'false'}/>

    <key>ignoreExitKeys</key>
    <true/>

    <key>hashedQuitPassword</key>
    <string>${hashedQuitPwd}</string>

    <key>hashedAdminPassword</key>
    <string>${hashedAdminPwd}</string>

    <!-- Display & Fullscreen Policy -->
    <key>openMainBrowserWindowFullScreen</key>
    <true/>

    <key>allowPreferencesWindow</key>
    <false/>

    <key>enableTouchExit</key>
    <false/>

    <!-- Security & Kiosk Lockdown -->
    <key>allowDeveloperConsole</key>
    <false/>

    <key>allowVirtualMachine</key>
    <false/>

    <key>allowScreenSharing</key>
    <false/>

    <key>enableURLFilter</key>
    <true/>

    <key>urlFilterRules</key>
    <array>
        <dict>
            <key>action</key>
            <integer>1</integer>
            <key>active</key>
            <true/>
            <key>expression</key>
            <string>*</string>
            <key>regex</key>
            <false/>
        </dict>
    </array>

    <!-- SEB Header Hash Enforcement -->
    <key>sendBrowserExamKey</key>
    <true/>

    <key>examTitle</key>
    <string>${escapeXml(contestTitle)}</string>
</dict>
</plist>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Verify whether User-Agent or Request Header satisfies Safe Exam Browser requirements
 */
export function verifySebHeader(userAgent?: string, sebHeader?: string): boolean {
  if (userAgent && userAgent.toLowerCase().includes('seb')) {
    return true;
  }
  if (userAgent && userAgent.toLowerCase().includes('safeexambrowser')) {
    return true;
  }
  if (sebHeader) {
    return true;
  }
  return false;
}
