import type { CandleSkin } from '../types';
import { classicSkin } from './classic';
import { honeySkin } from './honey';
import { jarSkin } from './jar';
import { lavenderSkin } from './lavender';
import { minimalSkin } from './minimal';
import { starrySkin } from './starry';

export const SKINS: CandleSkin[] = [classicSkin, minimalSkin, jarSkin, honeySkin, lavenderSkin, starrySkin];

export function getSkin(id: string | undefined): CandleSkin {
  return SKINS.find((s) => s.id === id) ?? classicSkin;
}
