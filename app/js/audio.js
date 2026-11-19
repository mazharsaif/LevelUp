// Plays the pre-downloaded neural voice clips; falls back to the phone's German speech engine.
import { S } from "./store.js";

const player = new Audio();
player.preload = "auto";
let voice = null;

function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("de"));
  return vs.find(v => /google/i.test(v.name)) || vs[0] || null;
}
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = () => (voice = pickVoice());

function tts(text) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE"; u.rate = 0.9;
  voice = voice || pickVoice();
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

// Every call gets a token; a clip that was interrupted by a newer word is ignored instead of
// falling back to speech (that fallback used to read out the *previous* word – the "one word behind" lag).
let token = 0;
export function play(aid, fallbackText) {
  if (S && S.settings.sound === false) return;
  const my = ++token;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (!aid) return tts(fallbackText);
  player.pause();
  player.onerror = () => { if (my === token) tts(fallbackText); };
  player.src = `audio/${aid}.mp3`;
  const p = player.play();
  if (p && p.catch) p.catch(err => {
    if (my !== token || (err && err.name === "AbortError")) return; // superseded by a newer clip
    if (err && err.name === "NotAllowedError") return;             // browser blocked autoplay – the 🔊 button still works
    tts(fallbackText);
  });
}

// Stop whatever is playing (moving to the next exercise, leaving a lesson). Bumping the token also cancels
// clips scheduled with playSoon() and any late speech fallback from the old clip.
export function stopAudio() {
  token++;
  player.pause();
  player.onerror = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
// play after a short delay, unless the learner has moved on by then
export function playSoon(aid, fallbackText, ms = 250) {
  const my = token;
  setTimeout(() => { if (my === token) play(aid, fallbackText); }, ms);
}

// little UI sounds made with WebAudio (no files needed)
let ctx = null;
export function blip(ok) {
  if (S && S.settings.sound === false) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [660, 880] : [220, 180];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = ok ? "sine" : "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.09); o.stop(ctx.currentTime + i * 0.09 + 0.18);
    });
  } catch { /* no audio context */ }
}
