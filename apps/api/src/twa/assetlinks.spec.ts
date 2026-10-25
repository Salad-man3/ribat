import { buildAssetLinksJson } from './assetlinks';

describe('buildAssetLinksJson', () => {
  it('lists package name and trimmed fingerprints for the TWA', () => {
    const body = buildAssetLinksJson('app.ribat.android', [
      ' AA:BB:CC ',
      '',
      '11:22:33',
    ]);
    expect(JSON.parse(body)).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'app.ribat.android',
          sha256_cert_fingerprints: ['AA:BB:CC', '11:22:33'],
        },
      },
    ]);
  });
});
