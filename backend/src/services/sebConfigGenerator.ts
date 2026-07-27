import crypto from "crypto";

/**
 * Builds the default SEB plist template.
 * quitUrl is injected dynamically so it always points to the correct TalentOS instance.
 */
function buildDefaultSebTemplate(quitUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key>
  <string>https://talentos.com</string>
  <key>sendBrowserExamKey</key>
  <true/>
  <key>sendConfigKey</key>
  <true/>
  <key>allowDevTools</key>
  <false/>
  <key>allowPreferences</key>
  <false/>
  <key>browserWindowAllowRightClick</key>
  <false/>
  <key>clipboardActionBlock</key>
  <true/>
  <key>allowVirtualMachine</key>
  <false/>
  <key>allowScreenSharing</key>
  <false/>
  <key>enableAppSwitcherCheck</key>
  <true/>
  <key>allowSpellCheck</key>
  <false/>
  <key>URLFilterEnable</key>
  <true/>
  <key>URLFilterEnableContentFilter</key>
  <true/>
  <key>blacklistURLFilter</key>
  <string>*chatgpt.com*,*google.com/search*,*stackoverflow.com*,*deepseek.com*,*claude.ai*,*gemini.google.com*,*copilot.microsoft.com*</string>
  <key>quitURL</key>
  <string>${quitUrl}</string>
  <key>quitURLConfirm</key>
  <false/>
  <key>clearSessionOnStart</key>
  <true/>
  <key>clearSessionOnEnd</key>
  <true/>
</dict>
</plist>`;
}


/**
 * Replaces or injects a string value for a given key inside a plist XML string.
 */
function setPlistStringKey(plistXml: string, key: string, value: string): string {
  const regex = new RegExp(`(<key>${key}<\\/key>\\s*<string>)([^]*?)(<\\/string>)`, "i");
  if (regex.test(plistXml)) {
    return plistXml.replace(regex, `$1${value}$3`);
  }
  return plistXml.replace(/(<dict>)/i, `$1\n  <key>${key}</key>\n  <string>${value}</string>`);
}

/**
 * Replaces or injects a boolean value for a given key inside a plist XML string.
 */
function setPlistBooleanKey(plistXml: string, key: string, value: boolean): string {
  const regex = new RegExp(`(<key>${key}<\\/key>\\s*<)(true|false)(\\/>)`, "i");
  if (regex.test(plistXml)) {
    return plistXml.replace(regex, `$1${value}$3`);
  }
  return plistXml.replace(/(<dict>)/i, `$1\n  <key>${key}</key>\n  <${value}/>`);
}

/**
 * Generates a candidate-specific, locked-down SEB configuration plist string.
 * Uses the custom uploaded SEB config if available, otherwise falls back to a secure template.
 * 
 * @param startUrl The candidate-specific contest start URL containing the verification session token.
 * @param baseConfig Optional base SEB config uploaded by the contest manager.
 * @param quitPassword Optional plain-text quit password to hash and embed in config.
 */
export function generateSebConfig(startUrl: string, baseConfig?: string | null, quitPassword?: string | null, quitUrl?: string | null): string {
  // Use provided base config, else build the default template with the quit URL embedded
  const effectiveQuitUrl = quitUrl || startUrl.replace(/\/contests\/[^/]+\/.*/, '/contests');
  let xml = baseConfig && baseConfig.trim().length > 0
    ? baseConfig
    : buildDefaultSebTemplate(effectiveQuitUrl);

  // Enforce critical security settings (cannot be overridden by base config)
  xml = setPlistStringKey(xml, "startURL", startUrl);
  xml = setPlistStringKey(xml, "quitURL", effectiveQuitUrl);
  xml = setPlistBooleanKey(xml, "sendBrowserExamKey", true);
  xml = setPlistBooleanKey(xml, "sendConfigKey", true);
  xml = setPlistBooleanKey(xml, "allowDevTools", false);
  xml = setPlistBooleanKey(xml, "allowPreferences", false);
  xml = setPlistBooleanKey(xml, "browserWindowAllowRightClick", false);
  xml = setPlistBooleanKey(xml, "clipboardActionBlock", true);

  if (quitPassword && quitPassword.trim().length > 0) {
    // SEB expects hashedQuitPassword to be SHA-256 hex string of the password
    const hashed = crypto.createHash("sha256").update(quitPassword).digest("hex");
    xml = setPlistStringKey(xml, "hashedQuitPassword", hashed);
  }

  return xml;
}

/**
 * Calculates a canonical SHA-256 hash of a plist XML configuration to mimic the Config Key.
 * We strip whitespaces, newlines, and strip keys that SEB ignores in hash calculation (like startURL, quitPassword).
 */
export function calculateConfigKey(plistXml: string): string {
  // Strip out keys that are excluded from Config Key hash
  let cleaned = plistXml;
  const excludedKeys = [
    "originatorVersion",
    "startURL",
    "sendBrowserExamKey",
    "sendConfigKey",
    "quitURL",
    "quitURLConfirm",
    "hashedQuitPassword",
    "quitPassword"
  ];

  for (const key of excludedKeys) {
    const regex = new RegExp(`<key>${key}<\\/key>\\s*<[^>]+>[^]*?<\\/[^>]+>`, "ig");
    cleaned = cleaned.replace(regex, "");
    const selfClosingRegex = new RegExp(`<key>${key}<\\/key>\\s*<[^>]+\\/>`, "ig");
    cleaned = cleaned.replace(selfClosingRegex, "");
  }

  // Remove whitespaces, comments and newlines to get a canonical form
  const canonical = cleaned
    .replace(/<!--[^]*?-->/g, "") // remove comments
    .replace(/\s+/g, "");        // remove all whitespace/newlines

  return crypto.createHash("sha256").update(canonical).digest("hex");
}
