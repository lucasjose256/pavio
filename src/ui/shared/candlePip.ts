import type { Session } from '../../core/models';
import { formatRemaining } from '../../core/session';

const W = 360;
const H = 480;

/** O Chrome deste computador deixa abrir Picture-in-Picture de vídeo? */
export const videoPipAvailable = (): boolean => typeof document !== 'undefined' && !!document.pictureInPictureEnabled;

/** Lê as cores do tema da página (a janela da vela já está com o tema certo). */
function themeColors() {
  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  return {
    bg: body.backgroundColor && body.backgroundColor !== 'rgba(0, 0, 0, 0)' ? body.backgroundColor : '#fbf3e4',
    text: root.getPropertyValue('--text').trim() || '#4a3426',
    muted: root.getPropertyValue('--muted').trim() || '#8a7460',
    accent: root.getPropertyValue('--accent-text').trim() || '#a8531c',
    vars: root,
  };
}

/** Transforma o SVG da vela da tela numa imagem (troca as variáveis CSS pelos valores do tema; a chama fica parada). */
async function candleImage(vars: CSSStyleDeclaration): Promise<HTMLImageElement | undefined> {
  const svg = document.querySelector<SVGElement>('.popup-candle svg');
  if (!svg) return undefined;
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '240');
  clone.setAttribute('height', '320');
  const text = new XMLSerializer().serializeToString(clone).replace(/var\((--[\w-]+)\)/g, (_, name: string) => vars.getPropertyValue(name).trim() || '#4a3426');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  await img.decode();
  return img;
}

/** Desenha um quadro: vela, tempo restante, ambiente e a fase do Pomodoro. */
/** Devolve `true` se a vela ainda está acesa neste quadro. */
export async function drawCandleFrame(ctx: CanvasRenderingContext2D, now = Date.now()): Promise<boolean> {
  const colors = themeColors();
  const stored = (await chrome.storage.local.get('activeSession')).activeSession as Session | undefined;
  const lit = stored?.status === 'active' && stored.endsAt > now ? stored : undefined;

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  const img = await candleImage(colors.vars).catch(() => undefined);
  if (img) ctx.drawImage(img, (W - 200) / 2, 16, 200, 267);

  ctx.textAlign = 'center';
  ctx.fillStyle = colors.text;
  ctx.font = '600 72px "Iowan Old Style", Palatino, Georgia, serif';
  ctx.fillText(lit ? formatRemaining(Math.min(lit.endsAt - now, lit.plannedMs)) : '—', W / 2, 360);
  ctx.fillStyle = colors.muted;
  ctx.font = '24px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  ctx.fillText(lit ? lit.environmentSnapshot.name : 'Vela apagada', W / 2, 400);
  const phase = lit?.pomodoro;
  if (phase) {
    ctx.fillStyle = colors.accent;
    ctx.font = '600 20px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
    ctx.fillText(phase.phase === 'break' ? 'Pausa' : `Foco ${phase.cycle}`, W / 2, 440);
  }
  return !!lit;
}

/**
 * Janelinha "sempre por cima" por Picture-in-Picture de VÍDEO: a vela e o tempo são desenhados num canvas e vistos
 * como um vídeo, que o Chrome mantém sobre as outras janelas. Funciona onde o PiP de documento é recusado.
 * Precisa ser chamado direto de um clique (gesto do usuário). `onClose` roda quando a janelinha fecha.
 */
export async function openVideoPip(onClose: () => void): Promise<void> {
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  await drawCandleFrame(ctx);

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
  video.srcObject = canvas.captureStream(5);
  document.body.append(video);

  // A janelinha fecha sozinha uns segundos depois que a vela se apaga.
  let dark = 0;
  const timer = setInterval(() => {
    void drawCandleFrame(ctx).then((lit) => {
      dark = lit ? 0 : dark + 1;
      if (dark >= 4 && document.pictureInPictureElement === video) void document.exitPictureInPicture();
    });
  }, 1000);
  const cleanup = () => {
    clearInterval(timer);
    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    video.remove();
    onClose();
  };
  try {
    await video.play();
    await video.requestPictureInPicture();
  } catch (error) {
    cleanup();
    throw error;
  }
  video.addEventListener('leavepictureinpicture', cleanup, { once: true });
}
