// くじ箱: 箱を揺らし、紙を1枚引き出して開く
export function createLottery(root) {
  const box = root.querySelector('.box');
  const paper = root.querySelector('.paper');
  const paperText = root.querySelector('.paper-text');
  const count = root.querySelector('.box-count');

  function reset() {
    paper.getAnimations().forEach((a) => a.cancel());
    paper.classList.remove('is-open');
    paper.style.removeProperty('--paper-color');
    paperText.textContent = '';
  }

  function render(items) {
    count.textContent = items.length ? `中に ${items.length} 種類のくじ` : 'くじがありません';
  }

  async function play(winner) {
    reset();

    await box.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-7deg) translateY(-4px)' },
        { transform: 'rotate(6deg)' },
        { transform: 'rotate(-5deg) translateY(-3px)' },
        { transform: 'rotate(4deg)' },
        { transform: 'rotate(-2deg)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 1200, easing: 'ease-in-out' },
    ).finished;

    // 箱の中から紙が上がってくる
    await paper.animate(
      [
        { transform: 'translate(-50%, 90px) rotate(0deg)', opacity: 1 },
        { transform: 'translate(-50%, -120px) rotate(-4deg)', opacity: 1 },
      ],
      { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' },
    ).finished;

    // 紙を開く
    paperText.textContent = winner.name;
    paper.style.setProperty('--paper-color', winner.color);
    paper.classList.add('is-open');
    await paper.animate(
      [
        { transform: 'translate(-50%, -120px) rotate(-4deg) scale(1, 1)' },
        { transform: 'translate(-50%, -120px) rotate(0deg) scale(1.08, 1.08)' },
        { transform: 'translate(-50%, -120px) rotate(0deg) scale(1, 1)' },
      ],
      { duration: 500, easing: 'ease-out', fill: 'forwards' },
    ).finished;
    await new Promise((r) => setTimeout(r, 300));
  }

  return { render, play, reset };
}
