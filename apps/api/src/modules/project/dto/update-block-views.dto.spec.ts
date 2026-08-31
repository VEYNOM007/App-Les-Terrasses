import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BlockViewDto, UpdateBlockViewsDto } from './update-block-views.dto';

const baseView = {
  id: 'view-1',
  title: 'Plan de Masse',
  subtitle: 'Vue d\'ensemble',
  category: 'masterplan',
  description: 'Description',
  hotspots: [],
};

// La ValidationPipe produit `views.0.imageUrl …`. On cherche récursivement
// une erreur nested posée sur `imageUrl` avec une contrainte, quel que soit
// le chemin (items de tableau vus comme children par @ValidateNested each).
function findImageUrlError(errors: import('class-validator').ValidationError[]): boolean {
  return errors.some((e) => {
    if (e.property === 'imageUrl' && e.constraints && Object.keys(e.constraints).length > 0) {
      return true;
    }
    return e.children ? findImageUrlError(e.children) : false;
  });
}

describe('UpdateBlockViewsDto / BlockViewDto — imageUrl', () => {
  // Ce que le bug signalé a produit : une vue ajoutée côté admin avec un
  // chemin relatif /masterplan-les-terrasses.jpg, rejetée par @IsUrl() en 400
  // (`views.0.imageUrl must be a URL address`). Le chemin relatif doit être
  // accepté CÔTÉ SERVEUR : c'est une ressource interne légitime du catalogue.
  it.each([
    ['chemin relatif masterplan', '/masterplan-les-terrasses.jpg'],
    ['chemin relatif simple', '/views/a.png'],
    ['URL absolue https', 'https://immo-les-terrasse.com/x.jpg'],
    ['URL absolue http', 'http://localhost:3000/a.jpg'],
  ])('accepte %s', async (_label, imageUrl) => {
    const dto = plainToInstance(UpdateBlockViewsDto, {
      views: [{ ...baseView, imageUrl }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each([
    ['chaîne vide', ''],
    ['espaces uniquement', '   '],
    ['texte brut sans protocole', 'notaurl'],
    ['chemin relatif avec espace', '/ma sterplan.jpg'],
    ['chemin protocol-relative', '//host.com/x.jpg'],
  ])('rejette %s', async (_label, imageUrl) => {
    const dto = plainToInstance(UpdateBlockViewsDto, {
      views: [{ ...baseView, imageUrl }],
    });
    const errors = await validate(dto);
    expect(findImageUrlError(errors)).toBe(true);
  });

  it('propage l\'erreur nested avec le bon chemin pour l\'index 0 (views.0.imageUrl)', async () => {
    const dto = plainToInstance(UpdateBlockViewsDto, {
      views: [{ ...baseView, imageUrl: 'notaurl' }],
    });
    const errors = await validate(dto);
    const viewsErr = errors.find((e) => e.property === 'views');
    expect(viewsErr).toBeDefined();
    expect(viewsErr!.children?.[0]?.children?.[0]?.property).toBe('imageUrl');
  });

  it('BlockViewDto est réutilisé par le projet (PATCH /admin/projects/:id)', async () => {
    // PATCH passe par UpdateProjectDto (PartialType de CreateProjectDto) qui
    // réutilise le même BlockViewDto : le fix serveur couvre donc aussi les
    // vues du projet, pas seulement celles des blocs.
    const dto = plainToInstance(BlockViewDto, {
      ...baseView,
      imageUrl: '/masterplan-les-terrasses.jpg',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
