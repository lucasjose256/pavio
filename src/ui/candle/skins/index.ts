import type { CandleSkin } from '../types';
import { classicSkin } from './classic';
import { minimalSkin } from './minimal';

export const SKINS: CandleSkin[] = [classicSkin, minimalSkin];

export function getSkin(id: string | undefined): CandleSkin {
  return SKINS.find((s) => s.id === id) ?? classicSkin;
}
