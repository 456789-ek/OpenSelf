import { createRoot } from 'react-dom/client';
import ParticleText from '../components/ParticleText.jsx';

const mount = document.getElementById('openself-title');

if (mount) {
  const word = mount.closest('.word');

  createRoot(mount).render(
    <ParticleText
      text="openself"
      particleSize={1.15}
      density={2}
      color="#f7f9ff"
      highlightColor="#9ec9ff"
      scatter={150}
      gatherDuration={3000}
      stagger={360}
      pointerRepel={72}
      repelRadius={160}
      idleDrift={0.35}
      settle={0.04}
      trigger="mount"
      fontSize="clamp(3.4rem, 12vw, 8.4rem)"
      fontWeight={700}
      fontFamily='"Openself Display", Syne, sans-serif'
      glow={false}
    />
  );

  if (word) {
    const fallback = word.querySelector('.word-fallback');
    if (fallback) fallback.setAttribute('aria-hidden', 'true');
    word.classList.add('is-ready');
  }
}
