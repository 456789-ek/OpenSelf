import { createRoot } from 'react-dom/client';
import ParticleText from '../components/ParticleText.jsx';

const mount = document.getElementById('openself-title');

if (mount) {
  const word = mount.closest('.word');

  createRoot(mount).render(
    <ParticleText
      text="openself"
      particleSize={2.2}
      density={4}
      color="#f8fafc"
      highlightColor="#8b5cf6"
      scatter={190}
      gatherDuration={1600}
      stagger={420}
      pointerRepel={42}
      repelRadius={120}
      idleDrift={0.8}
      trigger="mount"
      fontSize="clamp(3.5rem, 13vw, 9rem)"
      fontWeight={800}
      fontFamily="inherit"
      glow
    />
  );

  if (word) {
    const fallback = word.querySelector('.word-fallback');
    if (fallback) fallback.setAttribute('aria-hidden', 'true');
    word.classList.add('is-ready');
  }
}
