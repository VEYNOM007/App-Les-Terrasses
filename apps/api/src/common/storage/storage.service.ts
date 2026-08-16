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
 * Point d'accès UNIQUE aux fichiers. Deux buckets distincts :
 *   - bucket PRIVÉ (B2_*) : KYC, contrats PDF et signatures PNG — clés
 *     internes (`kyc/<uuid>.<ext>`, `contracts/<uuid>.pdf`, `signatures/<uuid>.png`),
 *     jamais d'URL exposée ; servis via des URL signées à durée limitée.
 *   - bucket PUBLIC (B2_PUBLIC_*) : médias marketing catalogue (rendus 3D,
 *     photos, plans) — clés internes `unit-media/<uuid>.<ext>`, servis via une
 *     URL stable SANS signature, lisible par n'importe quel visiteur.
 *
 * Deux clés applicatives SÉPARÉES (une par bucket, moindre privilège) : la clé
 * publique ne peut rien sur les documents légaux, et inversement.
 *
 * Les clients S3 sont créés paresseusement : sans variables B2_*, l'API démarre
 * normalement (utile en test/e2e) et toute opération de stockage échoue avec
 * une erreur explicite — on ne plante jamais le boot à cause du stockage,
 * comme le fallback démo des clients de paiement.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private privateClient: S3Client | null = null;
  private publicClient: S3Client | null = null;

  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly keyId: string;
  private readonly applicationKey: string;
  private readonly signedUrlTtlSeconds: number;

  private readonly publicBucket: string;
  private readonly publicEndpoint: string;
  private readonly publicKeyId: string;
  private readonly publicApplicationKey: string;

  constructor() {
    this.bucket = process.env.B2_BUCKET ?? '';
    this.endpoint = process.env.B2_ENDPOINT ?? '';
    this.region = process.env.B2_REGION ?? '';
    this.keyId = process.env.B2_KEY_ID ?? '';
    this.applicationKey = process.env.B2_APPLICATION_KEY ?? '';

    this.publicBucket = process.env.B2_PUBLIC_BUCKET ?? '';
    this.publicEndpoint = process.env.B2_PUBLIC_ENDPOINT ?? '';
    this.publicKeyId = process.env.B2_PUBLIC_KEY_ID ?? '';
    this.publicApplicationKey = process.env.B2_PUBLIC_APPLICATION_KEY ?? '';

    const ttl = Number(process.env.B2_SIGNED_URL_TTL_SECONDS ?? DEFAULT_SIGNED_URL_TTL_SECONDS);
    this.signedUrlTtlSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_SIGNED_URL_TTL_SECONDS;
  }

  private getS3Client(): S3Client {
    if (this.privateClient) return this.privateClient;

    if (!this.bucket || !this.endpoint || !this.region || !this.keyId || !this.applicationKey) {
      throw new Error(
        'Stockage B2 non configuré : B2_BUCKET, B2_ENDPOINT, B2_REGION, B2_KEY_ID et ' +
          'B2_APPLICATION_KEY doivent être définis.',
      );
    }

    this.privateClient = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      // B2 ne supporte pas le addressing virtuel des buckets (path-style requis).
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.keyId,
        secretAccessKey: this.applicationKey,
      },
    });
    return this.privateClient;
  }

  private getPublicClient(): S3Client {
    if (this.publicClient) return this.publicClient;

    if (
      !this.publicBucket ||
      !this.publicEndpoint ||
      !this.region ||
      !this.publicKeyId ||
      !this.publicApplicationKey
    ) {
      throw new Error(
        'Bucket public B2 non configuré : B2_PUBLIC_BUCKET, B2_PUBLIC_ENDPOINT, B2_PUBLIC_KEY_ID et ' +
          'B2_PUBLIC_APPLICATION_KEY doivent être définis.',
      );
    }

    this.publicClient = new S3Client({
      region: this.region,
      endpoint: this.publicEndpoint,
      // B2 ne supporte pas le addressing virtuel des buckets (path-style requis).
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.publicKeyId,
        secretAccessKey: this.publicApplicationKey,
      },
    });
    return this.publicClient;
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

  // ---------- Bucket PUBLIC (médias catalogue) ----------

  /**
   * Dépose un objet sur le bucket public. L'upload reste authentifié : un
   * bucket B2 "public" n'est jamais publiquement writable, seule la lecture
   * est ouverte.
   */
  async putObjectPublic(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.getPublicClient().send(
      new PutObjectCommand({
        Bucket: this.publicBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /**
   * URL publique STABLE (sans signature, sans TTL) : `https://<endpoint>/<bucket>/<key>`.
   * Lisible par n'importe quel visiteur, cacheable par le navigateur — c'est
   * cette URL qui est stockée en base (`UnitMedia.url`).
   */
  getPublicUrl(key: string): string {
    if (!this.publicEndpoint || !this.publicBucket) {
      throw new Error(
        'Bucket public B2 non configuré : B2_PUBLIC_ENDPOINT et B2_PUBLIC_BUCKET doivent être définis.',
      );
    }
    return `${this.publicEndpoint}/${this.publicBucket}/${key}`;
  }

  /** Supprime un objet du bucket public (nettoyage à la suppression d'un média). */
  async deleteObjectPublic(key: string): Promise<void> {
    await this.getPublicClient().send(
      new DeleteObjectCommand({ Bucket: this.publicBucket, Key: key }),
    );
  }

  /**
   * Reconstruit la clé interne depuis une URL publique stockée en base.
   * Renvoie `null` si l'URL ne vient pas de notre bucket public (URL externe
   * type Unsplash collée par l'admin) — dans ce cas il n'y a rien à supprimer.
   */
  extractKeyFromPublicUrl(url: string): string | null {
    const prefix = `${this.publicEndpoint}/${this.publicBucket}/`;
    if (!url.startsWith(prefix)) return null;
    const key = url.slice(prefix.length);
    return key.length > 0 ? key : null;
  }
}
