import { StorageService } from './storage.service';

/**
 * Tests unitaires — StorageService (accès B2, R6 documents légaux).
 *
 * Le client S3 est mocké : on vérifie que le service envoie les bonnes
 * commandes (PutObject / GetObject / DeleteObject) avec la clé interne et
 * le ContentType forcés côté serveur, et que l'URL signée est générée avec
 * le TTL configuré. Aucun appel réseau réel.
 */

const ORIGINAL_ENV: Record<string, string | undefined> = {
  B2_KEY_ID: process.env.B2_KEY_ID,
  B2_APPLICATION_KEY: process.env.B2_APPLICATION_KEY,
  B2_BUCKET: process.env.B2_BUCKET,
  B2_ENDPOINT: process.env.B2_ENDPOINT,
  B2_REGION: process.env.B2_REGION,
  B2_SIGNED_URL_TTL_SECONDS: process.env.B2_SIGNED_URL_TTL_SECONDS,
  B2_PUBLIC_BUCKET: process.env.B2_PUBLIC_BUCKET,
  B2_PUBLIC_ENDPOINT: process.env.B2_PUBLIC_ENDPOINT,
  B2_PUBLIC_KEY_ID: process.env.B2_PUBLIC_KEY_ID,
  B2_PUBLIC_APPLICATION_KEY: process.env.B2_PUBLIC_APPLICATION_KEY,
};

function setB2Env(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string> = {
    B2_KEY_ID: 'test-key-id',
    B2_APPLICATION_KEY: 'test-app-key',
    B2_BUCKET: 'test-bucket',
    B2_ENDPOINT: 'https://s3.test.backblazeb2.com',
    B2_REGION: 'us-test-1',
    B2_PUBLIC_BUCKET: 'test-public-bucket',
    B2_PUBLIC_ENDPOINT: 'https://s3.public.backblazeb2.com',
    B2_PUBLIC_KEY_ID: 'test-public-key-id',
    B2_PUBLIC_APPLICATION_KEY: 'test-public-app-key',
  };
  for (const name of Object.keys(ORIGINAL_ENV)) {
    delete process.env[name];
  }
  for (const [name, value] of Object.entries({ ...defaults, ...overrides })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

function restoreEnv() {
  for (const name of Object.keys(ORIGINAL_ENV)) {
    if (ORIGINAL_ENV[name] === undefined) delete process.env[name];
    else process.env[name] = ORIGINAL_ENV[name];
  }
}

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const MockS3Client = jest.fn(() => ({ send: mockSend }));
  return {
    S3Client: MockS3Client,
    PutObjectCommand: jest.fn((input) => ({ input, name: 'PutObjectCommand' })),
    GetObjectCommand: jest.fn((input) => ({ input, name: 'GetObjectCommand' })),
    DeleteObjectCommand: jest.fn((input) => ({ input, name: 'DeleteObjectCommand' })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed-url.example.com/file'),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('StorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setB2Env();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('dépose un objet avec la clé interne et le ContentType serveur', async () => {
    mockSend.mockResolvedValue({});
    const service = new StorageService();
    const body = Buffer.from('pdf-content');

    await service.putObject('contracts/abc-123.pdf', body, 'application/pdf');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.name).toBe('PutObjectCommand');
    expect(command.input).toEqual({
      Bucket: 'test-bucket',
      Key: 'contracts/abc-123.pdf',
      Body: body,
      ContentType: 'application/pdf',
    });
  });

  it('lit un objet en mémoire (Buffer + ContentType B2)', async () => {
    mockSend.mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3, 4]) },
      ContentType: 'image/png',
    });
    const service = new StorageService();

    const result = await service.getObject('signatures/xyz.png');

    expect(result).toEqual({ body: Buffer.from([1, 2, 3, 4]), contentType: 'image/png' });
    const command = mockSend.mock.calls[0][0];
    expect(command.name).toBe('GetObjectCommand');
    expect(command.input.Key).toBe('signatures/xyz.png');
  });

  it('génère une URL signée avec le TTL par défaut (900 s)', async () => {
    const service = new StorageService();

    const url = await service.getSignedUrl('kyc/abc.pdf');

    expect(url).toBe('https://signed-url.example.com/file');
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ name: 'GetObjectCommand', input: { Bucket: 'test-bucket', Key: 'kyc/abc.pdf' } }),
      { expiresIn: 900 },
    );
  });

  it('respecte un TTL d\'URL signée personnalisé', async () => {
    setB2Env({ B2_SIGNED_URL_TTL_SECONDS: '300' });
    const service = new StorageService();

    await service.getSignedUrl('kyc/abc.pdf');

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.anything(),
      { expiresIn: 300 },
    );
  });

  it('supprime un objet (nettoyage)', async () => {
    mockSend.mockResolvedValue({});
    const service = new StorageService();

    await service.deleteObject('kyc/abc.pdf');

    const command = mockSend.mock.calls[0][0];
    expect(command.name).toBe('DeleteObjectCommand');
    expect(command.input).toEqual({ Bucket: 'test-bucket', Key: 'kyc/abc.pdf' });
  });

  it('échoue avec une erreur explicite si la config B2 est absente (pas de boot planté)', async () => {
    setB2Env({ B2_BUCKET: undefined });
    const service = new StorageService();

    await expect(service.putObject('kyc/a.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow(
      'Stockage B2 non configuré',
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  // ── Bucket PUBLIC (médias catalogue) ───────────────────────────────

  it('dépose un objet sur le bucket public avec la clé interne et le ContentType serveur', async () => {
    mockSend.mockResolvedValue({});
    const service = new StorageService();
    const body = Buffer.from('render-png');

    await service.putObjectPublic('unit-media/abc-123.png', body, 'image/png');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.name).toBe('PutObjectCommand');
    expect(command.input).toEqual({
      Bucket: 'test-public-bucket',
      Key: 'unit-media/abc-123.png',
      Body: body,
      ContentType: 'image/png',
    });
  });

  it('génère une URL publique stable sans signature (endpoint + bucket + clé)', () => {
    const service = new StorageService();

    const url = service.getPublicUrl('unit-media/abc-123.png');

    expect(url).toBe('https://s3.public.backblazeb2.com/test-public-bucket/unit-media/abc-123.png');
  });

  it('extrait la clé interne depuis une URL de notre bucket public', () => {
    const service = new StorageService();

    const key = service.extractKeyFromPublicUrl(
      'https://s3.public.backblazeb2.com/test-public-bucket/unit-media/abc-123.png',
    );

    expect(key).toBe('unit-media/abc-123.png');
  });

  it('renvoie null pour une URL externe (collée par l’admin) : rien à supprimer côté B2', () => {
    const service = new StorageService();

    const key = service.extractKeyFromPublicUrl('https://cdn.example.com/photo.jpg');

    expect(key).toBeNull();
  });

  it('renvoie null pour une URL de notre bucket sans clé (suffixe vide)', () => {
    const service = new StorageService();

    const key = service.extractKeyFromPublicUrl(
      'https://s3.public.backblazeb2.com/test-public-bucket/',
    );

    expect(key).toBeNull();
  });

  it('supprime un objet du bucket public (nettoyage à la suppression d’un média)', async () => {
    mockSend.mockResolvedValue({});
    const service = new StorageService();

    await service.deleteObjectPublic('unit-media/abc-123.png');

    const command = mockSend.mock.calls[0][0];
    expect(command.name).toBe('DeleteObjectCommand');
    expect(command.input).toEqual({ Bucket: 'test-public-bucket', Key: 'unit-media/abc-123.png' });
  });

  it('échoue si le bucket public est absent de la config (pas de boot planté)', async () => {
    setB2Env({ B2_PUBLIC_ENDPOINT: undefined });
    const service = new StorageService();

    await expect(
      service.putObjectPublic('unit-media/a.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow('Bucket public B2 non configuré');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
