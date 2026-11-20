import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 900;

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test('galerie → porte-clés → prêt à imprimer → STL téléchargé', async ({ page }) => {
  await page.goto('/modeles');
  await page.getByRole('button', { name: /Porte-clés/ }).click();
  await expect(page).toHaveURL(/\/editeur\?modele=porte-cles/);
  await expect(page.getByRole('status').filter({ hasText: /Prêt/ }).first()).toBeVisible();
  const download = page.waitForEvent('download');
  if (isPhone(page)) await page.locator('.m-actionbar__export').click();
  else await page.locator('.export-actions .btn--primary').click();
  expect((await download).suggestedFilename()).toMatch(/\.(stl|zip)$/);
  await noHorizontalScroll(page);
});

test('trophée : 2 pièces, pauses 7,8 / 8,2 / 58,2 mm', async ({ page }) => {
  test.skip(isPhone(page), 'vérifié sur ordinateur');
  await page.goto('/editeur?modele=trophee');
  await expect(page.getByText('Assemblé : 213,9 × 84 × 250 mm')).toBeVisible();
  await expect(page.getByText('Tenon / mortaise : jeu 0,25 mm')).toBeVisible();
  await expect(page.getByText('Pause à 7,8 mm')).toBeVisible();
  await page.getByRole('button', { name: 'Socle', exact: true }).click();
  await expect(page.getByText('Pause à 8,2 mm')).toBeVisible();
  await expect(page.getByText('Pause à 58,2 mm')).toBeVisible();
});

test('atelier : ajouter un cube et un cylindre « trou »', async ({ page }) => {
  await page.goto('/atelier');
  await page.locator('.shape-btn', { hasText: 'Cube' }).click();
  await page.locator('.shape-btn', { hasText: 'Cylindre' }).click();
  await page.getByRole('button', { name: 'Trou', exact: true }).click();
  await expect(page.getByLabel('Diamètre en millimètres')).toBeVisible();
  if (!isPhone(page)) await expect(page.locator('.tree__item', { hasText: 'cylindre · trou' }).first()).toBeVisible();
  await noHorizontalScroll(page);
});

test('croquis : rectangle exact → révolution → ajouté à la scène', async ({ page }) => {
  test.skip(isPhone(page), 'parcours détaillé sur ordinateur');
  await page.goto('/atelier/croquis');
  const left = page.locator('aside[aria-label="Outils de croquis"]');
  await left.getByRole('button', { name: 'Rectangle' }).click();
  for (const [label, v] of [['X en millimètres', 10], ['Y en millimètres', 0]] as const) {
    await left.getByLabel(label, { exact: true }).fill(String(v));
    await left.getByLabel(label, { exact: true }).press('Enter');
  }
  await left.getByRole('button', { name: 'Placer le point' }).click();
  await left.getByLabel('Longueur en millimètres', { exact: true }).fill('20');
  await left.getByLabel('Longueur en millimètres', { exact: true }).press('Enter');
  await left.getByLabel('Angle en °', { exact: true }).fill('45');
  await left.getByLabel('Angle en °', { exact: true }).press('Enter');
  await left.getByRole('button', { name: 'Valider' }).click();
  const right = page.locator('aside[aria-label="Transformer en 3D"]');
  await right.getByRole('button', { name: 'Révolution' }).click();
  await expect(right.getByRole('status')).toContainText('Résultat');
  await right.getByRole('button', { name: 'Ajouter à la scène' }).click();
  await expect(page).toHaveURL(/\/atelier$/);
});

test('IA : message « Mode IA non configuré » sans bloquer l’appli', async ({ page }) => {
  await page.goto('/ia');
  await expect(page.getByText('Mode IA non configuré.', { exact: false }).first()).toBeVisible();
  await noHorizontalScroll(page);
});

test('projets : export .forge3d.json', async ({ page }) => {
  await page.goto('/projets');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter .forge3d.json' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.forge3d\.json$/);
  await noHorizontalScroll(page);
});

for (const path of ['/modeles', '/editeur', '/atelier', '/atelier/croquis', '/ia', '/projets']) {
  test(`accessibilité ${path} : aucune violation grave (axe)`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id} : ${v.nodes.length} élément(s) — ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });
}
