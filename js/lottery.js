// くじ箱: 箱を揺らし、短冊を1枚引き出して開き、朱印を押す
import * as sound from './sound.js';

const UP = 'translate(-50%, -128px)';

export function createLottery(root) {
  const box = root.querySelector('.box');
  const paper = root.querySelector('.paper');
  const paperText = root.querySelector('.paper-text');
  const hanko = root.querySelector('.hanko');
  const count = root.querySelector('.box-count');

  function reset() {
    paper.getAnimations().forEach((a) => a.cancel());
    hanko.getAnimations().forEach((a) => a.cancel());
    paper.classList.remove('is-open');
    paper.style.removeProperty('--paper-color');
    paperText.textContent = '';
  }

  function render(items) {
    count.textContent = items.length ? `中に ${items.length} 種類のくじ` : 'くじがありません';
  }

  async function play(winner) {
    reset();

    // 箱をガサガサ揺らす
    const stop = sound.rattle({ low: 2500, high: 5000, gap: [25, 60], peak: 0.18 });
    await box.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-8deg) translateY(-6px)' },
        { transform: 'rotate(7deg)' },
        { transform: 'rotate(-6deg) translateY(-5px)' },
        { transform: 'rotate(6deg)' },
        { transform: 'rotate(-4deg) translateY(-3px)' },
        { transform: 'rotate(3deg)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 1500, easing: 'ease-in-out' },
    ).finished;
    stop();

    // 箱の中から短冊がせり上がる
    await paper.animate(
      [
        { transform: 'translate(-50%, 90px) rotate(0deg)' },
        { transform: 'translate(-50%, 40px) rotate(2deg)', offset: 0.4 },
        { transform: `${UP} rotate(-3deg)` },
      ],
      { duration: 1100, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' },
    ).finished;
    await new Promise((r) => setTimeout(r, 250));

    // くるっと回して開く
    await paper.animate(
      [{ transform: `${UP} rotate(-3deg) rotateY(0deg)` }, { transform: `${UP} rotate(0deg) rotateY(90deg)` }],
      { duration: 260, easing: 'ease-in', fill: 'forwards' },
    ).finished;
    paperText.textContent = winner.name;
    paper.style.setProperty('--paper-color', winner.color);
    paper.classList.add('is-open');
    sound.paper();
    await paper.animate(
      [
        { transform: `${UP} rotateY(90deg) scale(1)` },
        { transform: `${UP} rotateY(0deg) scale(1.08)`, offset: 0.7 },
        { transform: `${UP} rotateY(0deg) scale(1)` },
      ],
      { duration: 420, easing: 'ease-out', fill: 'forwards' },
    ).finished;

    // 朱印をポンと押す
    await new Promise((r) => setTimeout(r, 200));
    sound.stamp();
    await hanko.animate(
      [
        { opacity: 0, transform: 'rotate(-12deg) scale(2.4)' },
        { opacity: 1, transform: 'rotate(-12deg) scale(0.92)', offset: 0.7 },
        { opacity: 1, transform: 'rotate(-12deg) scale(1)' },
      ],
      { duration: 320, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'forwards' },
    ).finished;
    await new Promise((r) => setTimeout(r, 450));
  }

  return { render, play, reset };
}
