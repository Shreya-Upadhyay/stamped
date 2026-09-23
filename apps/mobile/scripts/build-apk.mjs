#!/usr/bin/env node
/**
 * Builds a shareable release APK locally.
 *
 * Exists to hide one trap: Android Studio now bundles JDK 25, and on it the
 * CMake configure step for react-native-worklets fails after about fourteen
 * minutes with "WARNING: A restricted method in java.lang.System has been
 * called" — which says nothing about Java versions. React Native needs 17.
 * So this finds a 17 before starting rather than after.
 *
 * Cloud builds (`npm run build:android`) don't need any of this; this is the
 * fast path for when you're on this machine and want an APK in two minutes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(appRoot, 'android');
const isWindows = process.platform === 'win32';

/** The major version a JDK directory holds, or null if it isn't one. */
function javaMajor(javaHome) {
  try {
    const release = readFileSync(join(javaHome, 'release'), 'utf8');
    const version = /^JAVA_VERSION="?([0-9]+)/m.exec(release);
    return version ? Number(version[1]) : null;
  } catch {
    return null;
  }
}

/**
 * A JDK 17, or null.
 *
 * Checks JAVA_HOME first so an explicit choice wins, then the JDKs Gradle has
 * provisioned for itself — which is where one usually already exists.
 */
function findJdk17() {
  if (process.env.JAVA_HOME && javaMajor(process.env.JAVA_HOME) === 17) {
    return process.env.JAVA_HOME;
  }

  const provisioned = join(homedir(), '.gradle', 'jdks');
  if (!existsSync(provisioned)) return null;

  for (const entry of readdirSync(provisioned)) {
    const candidate = join(provisioned, entry);
    if (statSync(candidate).isDirectory() && javaMajor(candidate) === 17) return candidate;
  }
  return null;
}

if (!existsSync(androidDir)) {
  console.error(
    'No android/ directory. Generate it first:\n\n  npx expo prebuild --platform android --clean\n',
  );
  process.exit(1);
}

const javaHome = findJdk17();
if (!javaHome) {
  console.error(
    [
      'No JDK 17 found, and React Native cannot build without one.',
      '',
      'Install Temurin 17 (https://adoptium.net/temurin/releases/?version=17),',
      'then point JAVA_HOME at it and run this again. Android Studio\'s bundled',
      'JDK is too new — it fails partway through the native build.',
      '',
      `JAVA_HOME is currently: ${process.env.JAVA_HOME ?? '(unset)'}`,
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`Using JDK 17 at ${javaHome}`);
console.log('Building release APK — a few minutes…\n');

try {
  // Absolute and quoted: a shell doesn't reliably resolve a bare script name
  // from the working directory, and a path with spaces would split.
  const gradlew = join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
  execFileSync(isWindows ? `"${gradlew}"` : gradlew, [
    'app:assembleRelease',
    '-x',
    'lint',
    '-x',
    'test',
    '--build-cache',
  ], {
    cwd: androidDir,
    env: { ...process.env, JAVA_HOME: javaHome },
    stdio: 'inherit',
    // Node refuses to spawn a .bat directly on Windows (CVE-2024-27980) and
    // the failure looks like gradle dying silently. No argument above
    // contains a space, so handing this to a shell is safe.
    shell: isWindows,
  });
} catch {
  console.error('\nBuild failed. The gradle output above says why.');
  process.exit(1);
}

const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const megabytes = (statSync(apk).size / 1e6).toFixed(0);
console.log(`\nAPK ready (${megabytes} MB):\n  ${apk}\n`);
console.log('Send that file to testers; they tap it and allow "install unknown apps".');
console.log('It carries the Firebase config from apps/mobile/.env as it was at build time.');
