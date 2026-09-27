// 在打开了 icon-source.html 的浏览器控制台里运行，产出三个尺寸的 PNG base64。
// 画布重画一遍而不是截图，是为了拿到干净、无缩放误差的位图。
await document.fonts.load('600 318px Fraunces');
await document.fonts.ready;
function render(S) {
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  const k = S / 512;                       // 以 512 为基准等比缩放
  x.fillStyle = '#F5F2EA'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#1E5A8A';
  x.font = `600 ${318 * k}px Fraunces, Georgia, serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('O', S / 2, S / 2 - 23 * k);  // 字母 O 光学重心偏高，上提一点
  const w = 133 * k, h = 14.3 * k, r = 7.2 * k;
  x.beginPath();
  x.roundRect((S - w) / 2, S - 97.3 * k - h, w, h, r);
  x.fill();
  return c.toDataURL('image/png').split(',')[1];
}
window.__icons = { s512: render(512), s192: render(192), s180: render(180) };
