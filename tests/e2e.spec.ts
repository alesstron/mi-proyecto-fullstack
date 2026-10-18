import { test, expect } from '@playwright/test';

test.describe('Rumbo Nómada · producción', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('carga el título', async ({ page }) => {
    await expect(page).toHaveTitle(/Rumbo Nómada/);
  });

  test('muestra tarjetas de paquetes con imagen', async ({ page }) => {
    const cards = page.locator('#track .pkg');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(6);
    const img = cards.first().locator('img');
    await expect(img).toHaveAttribute('src', /^https:\/\/images\.unsplash\.com\//);
  });

  test('el enlace de WhatsApp apunta al número de reservas', async ({ page }) => {
    const wa = page.locator('a[href^="https://wa.me/"]').first();
    await expect(wa).toHaveAttribute('href', 'https://wa.me/584245535901');
    // El texto se muestra como "0424 553 5901": se compara sin espacios
    const text = (await wa.textContent())?.replace(/\s/g, '');
    expect(text).toContain('04245535901');
  });

  test('muestra las oficinas de Barquisimeto, Ciudad de México y Madrid', async ({ page }) => {
    const offices = page.locator('.offices');
    await expect(offices).toContainText('Barquisimeto');
    await expect(offices).toContainText('Ciudad de México');
    await expect(offices).toContainText('Madrid');
  });
});
