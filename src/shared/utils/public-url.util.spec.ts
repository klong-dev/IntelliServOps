import {
  buildPublicFileUrl,
  resolvePublicBaseUrl,
} from './public-url.util';

describe('public-url.util', () => {
  it('should prefer configured public base url', () => {
    const result = resolvePublicBaseUrl({
      configuredBaseUrl: 'https://api.example.com/',
      request: {
        protocol: 'http',
        headers: {
          host: 'localhost:3006',
        },
      },
      fallbackPort: 3006,
    });

    expect(result).toBe('https://api.example.com');
  });

  it('should derive public base url from forwarded headers when env is empty', () => {
    const result = resolvePublicBaseUrl({
      configuredBaseUrl: '',
      request: {
        protocol: 'http',
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'api.klong.dev',
          host: 'localhost:3006',
        },
      },
      fallbackPort: 3006,
    });

    expect(result).toBe('https://api.klong.dev');
  });

  it('should build a public file url without duplicated slashes', () => {
    const result = buildPublicFileUrl(
      'https://api.example.com/',
      '/uploads/',
      'apartment-videos/apt-1/video/test.mp4',
    );

    expect(result).toBe(
      'https://api.example.com/uploads/apartment-videos/apt-1/video/test.mp4',
    );
  });
});
