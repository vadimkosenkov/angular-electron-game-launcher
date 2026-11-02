/**
 * Ad-hoc signs the packaged macOS bundle.
 *
 * Run by electron-builder's `afterPack` hook, because without a Developer ID
 * there is nothing for it to sign with and it skips the step entirely. What it
 * leaves behind is not an unsigned application but a worse thing: the Electron
 * binary still carries the ad-hoc signature its own linker produced, while the
 * bundle around it has no `_CodeSignature` seal at all. macOS reports exactly
 * that -- "code has no resources but signature indicates they must be present"
 * -- and treats a copy that arrives with a quarantine flag as damaged, with no
 * way for the person to override it.
 *
 * An ad-hoc signature over the whole bundle does not make the application
 * trusted: `-` is not an identity, and Gatekeeper still has no idea who built
 * it. It makes the bundle internally consistent, which turns "this app is
 * damaged" into the ordinary "unidentified developer" prompt that a person can
 * actually get past. That is the honest ceiling without a paid certificate.
 *
 * `--deep` is discouraged for real distribution signing, where each nested
 * binary should be signed on its own terms. For an ad-hoc seal over Electron's
 * helpers and frameworks it is the right tool and the only short one.
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export default async function adHocSign(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  console.log(`  • ad-hoc signing  path=${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });

  // Verified here rather than trusted: a signature that did not take would
  // otherwise only show up on someone else's machine.
  execFileSync('codesign', ['--verify', '--strict', appPath], { stdio: 'inherit' });
}
