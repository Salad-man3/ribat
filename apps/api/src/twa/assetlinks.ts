/** Digital Asset Links statement for Android Trusted Web Activity (fullscreen, no URL bar). */
export function buildAssetLinksJson(
  packageName: string,
  sha256CertFingerprints: string[],
): string {
  const fingerprints = sha256CertFingerprints.map((f) => f.trim()).filter(Boolean);
  return JSON.stringify([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
