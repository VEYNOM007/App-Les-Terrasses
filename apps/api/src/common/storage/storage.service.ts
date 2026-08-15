import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

/**
 * Service central de stockage objet (Backblaze B2 via l'API S3).
 *
 * Point d'accès UNIQUE aux fichiers : KYC, contrats PDF et signatures PNG
 * passent tous par ici — jamais d'écriture directe sur le disque du
 * container (volume Docker conservé monté mais plus jamais écrit).
 *
 * Les clés stockées sont internes (`kyc/<uuid>.<ext>`, `contracts/<uuid>.pdf`,
 * `signatures/<uuid>.png`) : la base ne référence jamais une URL B2, et le
 * client n'obtient que des URL signées à durée limitée.
 *
 * Le client S3 est créé paresseusement : sans variables B2_*, l'API démarre
 * normalement (utile en test/e2e) et toute opération de stockage échoue
 * avec une erreur explicite — on ne plante jamais le boot à cause du
 * stockage, comme le fallback démo des clients de paiement.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly keyId: string;
  private readonly applicationKey: string;
  private readonly signedUrlTtlSeconds: number;

  constructor() {
    this.bucket = process.env.B2_BUCKET ?? '';
    this.endpoint = process.env.B2_ENDPOINT ?? '';
    this.region = process.env.B2_REGION ?? '';
    this.keyId = process.env.B2_KEY_ID ?? '';
    this.applicationKey = process.env.B2_APPLICATION_KEY ?? '';

    const ttl = Number(process.env.B2_SIGNED_URL_TTL_SECONDS ?? DEFAULT_SIGNED_URL_TTL_SECONDS);
    this.signedUrlTtlSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  private getS3Client(): S3Client {
    if (this.client) return this.client;

    if (!this.bucket || !this.endpoint || !this.region || !this.keyId || !this.applicationKey) {
      throw new Error(
        'Stockage B2 non configuré : B2_BUCKET, B2_ENDPOINT, B2_REGION, B2_KEY_ID et ' +
          'B2_APPLICATION_KEY doivent être définis.',
      );
    }

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      // B2 ne supporte pas le addressing virtuel des buckets (path-style requis).
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.keyId,
        secretAccessKey: this.applicationKey,
      },
    });
    return this.client;
  }

  /**
   * Dépose un objet. `key` est une clé interne (jamais un chemin utilisateur,
   * jamais une URL) ; le ContentType est forcé côté serveur depuis le type
   * détecté en amont, jamais depuis l'extension client.
   */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /**
   * Récupère un objet en mémoire (Buffer). Utilisé par la contre-signature
   * des PDF : on relit l'original + les PNG de signature depuis B2.
   */
  async getObject(key: string): Promise<StoredObject> {
    const response = await this.getS3Client().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (response.Body === undefined) {
      throw new Error(`Objet ${key} sans contenu restitué par B2.`);
    }
    const body = Buffer.from(await response.Body.transformToByteArray());
    return {
      body,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  /**
   * URL signée à durée limitée (TTL configurable, 15 min par défaut).
   * Le navigateur télécharge directement depuis B2 — jamais de proxy serveur.
   */
  async getSignedUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.getS3Client(),
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.signedUrlTtlSeconds },
    );
  }

  /** Supprime un objet (nettoyage/test). */
  async deleteObject(key: string): Promise<void> {
    await this.getS3Client().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
