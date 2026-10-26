// Görsel: müziğe tepki veren WebGL arka plan. Her parça kendi sahnesini ve renklerini alır;
// kick nabız gibi atar, bas akışı büker, melodi notaları halka halka yayılır, akor değişimi rengi kaydırır.

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uKick, uBass, uHigh, uEnergy, uSceneA, uSceneB, uMix, uChord, uBright;
uniform vec3 uC1, uC2, uC3, uD1, uD2, uD3;
uniform vec4 uRip[10];
uniform vec3 uRipC[10];

float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*noise(p);p=m*p;a*=.5;}return s;}

vec3 pal(float x, vec3 a, vec3 b, vec3 c){
  x=fract(x);
  return x<.5? mix(a,b,smoothstep(0.,.5,x)) : mix(b,c,smoothstep(.5,1.,x));
}

// 0 ipek akış
vec3 silk(vec2 p,float t,vec3 a,vec3 b,vec3 c){
  vec2 q=vec2(fbm(p*1.3+vec2(0.,t*.06)),fbm(p*1.3+vec2(5.2,1.3)-t*.05));
  vec2 r=vec2(fbm(p*1.3+(3.+uBass*1.5)*q+vec2(1.7,9.2)+t*.04),fbm(p*1.3+3.*q+vec2(8.3,2.8)-t*.03));
  float f=fbm(p*1.3+3.5*r);
  vec3 col=mix(a*.35,b,clamp(f*f*2.2,0.,1.));
  col=mix(col,c,clamp(length(q)*.55-.15,0.,1.)*.8);
  col+=c*pow(abs(sin(f*18.+t*.2)),40.)*.18;
  return col*(.55+f*.7);
}
// 1 kuzey ışıkları
vec3 aurora(vec2 p,float t,vec3 a,vec3 b,vec3 c){
  vec3 col=mix(a*.5,a*.15,smoothstep(-.6,.8,p.y));
  for(int i=0;i<3;i++){
    float fi=float(i);
    float x=p.x*(1.1+fi*.35)+fi*3.1;
    float y0=.05+fi*.18+.28*(fbm(vec2(x*.8,t*.05+fi))-.5)+.05*sin(x*2.+t*.3);
    float d=p.y-y0;
    float curtain=exp(-max(d,0.)*(1.8+fi*.6))*smoothstep(-.06,.03,d);
    float rays=.35+.65*pow(noise(vec2(x*7.,t*.2+fi*7.)),1.5);
    vec3 cc=fi<.5?b:(fi<1.5?c:mix(b,c,.5));
    col+=cc*curtain*rays*(1.3-fi*.25)*(1.+uBass*.6);
  }
  float st=h21(floor(p*vec2(180.)));
  col+=vec3(1.)*step(.9975,st)*(.4+.6*sin(t*2.+st*90.))*.5*smoothstep(0.,.6,p.y);
  return col;
}
// 2 lav lambası
vec3 lava(vec2 p,float t,vec3 a,vec3 b,vec3 c){
  float f=0.;float g=0.;
  for(int i=0;i<7;i++){
    float fi=float(i);
    vec2 cpos=vec2(sin(t*(.07+fi*.013)+fi*1.7)*.85,sin(t*(.05+fi*.011)+fi*2.9)*.55);
    float r=.2+.07*sin(fi*3.);
    float k=r*r/dot(p-cpos,p-cpos);
    f+=k; if(mod(fi,2.)<1.) g+=k;
  }
  f*=1.+uKick*.12;
  float edge=smoothstep(.97,1.06,f);
  vec3 blob=mix(b,c,clamp(g/f,0.,1.));
  vec3 col=mix(a*.35,blob*(.75+.5*smoothstep(1.1,4.,f)),edge);
  col+=blob*.35*smoothstep(.45,.97,f)*(1.-edge);
  col+=c*.25*exp(-abs(f-1.)*25.);
  return col;
}
// 3 katmanlı tepeler / dalgalar
vec3 hills(vec2 p,float t,vec3 a,vec3 b,vec3 c){
  vec3 col=mix(c*.55,a*.25,smoothstep(-.2,.9,p.y));
  vec2 sp=vec2(.35,.42);
  float sd=length(p-sp);
  col+=c*exp(-sd*6.)*.5+b*exp(-sd*2.5)*.15;
  for(int i=0;i<6;i++){
    float fi=float(i);
    float spd=.02+fi*.012;
    float y=.25-fi*.14+.09*(fbm(vec2(p.x*(.9+fi*.3)+t*spd+fi*4.,fi))-.5)*(2.+fi*.3)
      +.012*sin(p.x*8.+t*.6+fi)*(1.+uKick*1.5);
    float m=smoothstep(y+.004,y-.004,p.y);
    vec3 lc=mix(b,a*.3,fi/5.)*(1.-fi*.08);
    lc+=c*.25*exp(-abs(p.y-y)*60.)*(1.-fi/6.);
    col=mix(col,lc,m);
  }
  return col;
}
// 4 halkalar
vec3 rings(vec2 p,float t,vec3 a,vec3 b,vec3 c){
  float r=length(p);
  float w=(fbm(p*1.4+vec2(t*.03,-t*.02))-.5)*.45;
  float z=r+w-t*.04-uKick*.015;
  float ring=pow(.5+.5*sin(z*22.),8.);
  float ring2=pow(.5+.5*sin(z*9.+1.),3.);
  vec3 col=mix(a*.2,b*.7,ring2*.6);
  col+=c*ring*.5*exp(-r*.9);
  col*=.6+.6*exp(-r*1.5);
  return col;
}

vec3 scene(float id,vec2 p,float t,vec3 a,vec3 b,vec3 c){
  if(id<.5) return silk(p,t,a,b,c);
  if(id<1.5) return aurora(p,t,a,b,c);
  if(id<2.5) return lava(p,t,a,b,c);
  if(id<3.5) return hills(p,t,a,b,c);
  return rings(p,t,a,b,c);
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  p*=1.-uKick*.012;
  float t=uTime;
  // akor değişiminde renkler yavaşça yer değiştirir
  float ch=uChord;
  vec3 a=mix(uC1,uC2,.5+.5*sin(ch*1.3)), b=mix(uC2,uC3,.5+.5*sin(ch*1.3+2.)), c=mix(uC3,uC1,.25+.25*sin(ch*1.3+4.));
  vec3 col=scene(uSceneA,p,t,a,b,c);
  if(uMix>0.001){
    vec3 a2=mix(uD1,uD2,.5+.5*sin(ch*1.3)), b2=mix(uD2,uD3,.5+.5*sin(ch*1.3+2.)), c2=mix(uD3,uD1,.25+.25*sin(ch*1.3+4.));
    col=mix(col,scene(uSceneB,p,t,a2,b2,c2),uMix);
  }
  // nota halkaları
  for(int i=0;i<10;i++){
    vec4 R=uRip[i];
    if(R.w<=0.) continue;
    float d=length(p-R.xy);
    float age=R.z;
    float rad=age*.32;
    float ring=exp(-pow((d-rad)*(26.-age*6.),2.))*exp(-age*1.4)*R.w;
    float core=exp(-d*d*120.)*exp(-age*5.)*R.w;
    col+=uRipC[i]*(ring*.55+core*.6);
  }
  col*=uBright*(1.+uKick*.1);
  // ortada yazı okunsun diye hafif karartma, kenarlarda vinyet
  float v=smoothstep(1.25,.25,length(p*vec2(.85,1.)));
  col*=mix(.45,1.,v);
  col*=1.-.25*exp(-dot(p*vec2(1.4,2.4),p*vec2(1.4,2.4))*2.);
  col+=(h21(gl_FragCoord.xy+fract(t*7.)*100.)-.5)*(.03+uHigh*.02);
  col=pow(max(col,0.),vec3(.95));
  gl_FragColor=vec4(col,1.);
}`;

const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};
const MODE_WARM = { phrygian: 0.1, aeolian: 0.3, dorian: 0.5, mixolydian: 0.65, ionian: 0.8, lydian: 0.95 };

// Parçanın tonu, modu ve türünden üç renk
export function trackColors(d) {
  const warm = MODE_WARM[d.mode] ?? 0.5;
  const base = (d.tonic * 30 + 15 + (d.seed % 40)) % 360;
  const spread = 35 + (d.seed % 7) * 12;
  const sat = d.style === 'minimal' ? 0.35 : d.style === 'ambient' ? 0.45 : 0.55 + warm * 0.2;
  return [hsl(base, sat * 0.8, 0.16), hsl(base + spread, sat, 0.34 + warm * 0.08), hsl(base + spread * 2.2, sat, 0.5 + warm * 0.08)];
}

export class Gorsel {
  constructor(canvas, motor) {
    this.cv = canvas;
    this.m = motor;
    this.ok = false;
    this.events = [];
    this.rips = [];
    this.kick = 0;
    this.bass = 0;
    this.high = 0;
    this.chord = 0;
    this.chordT = 0;
    this.sceneA = Math.floor(Math.random() * 5);
    this.sceneB = this.sceneA;
    this.mix = 0;
    this.colA = [[0.08, 0.06, 0.05], [0.3, 0.18, 0.14], [0.5, 0.32, 0.22]];
    this.colB = this.colA;
    this.bright = 0;
    this.leadSeed = null;
    this.energy = 0.5;
    this.buf = new Uint8Array(256);
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) return;
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      this.pr = pr;
    } catch (e) {
      console.error(e);
      return;
    }
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uRes', 'uTime', 'uKick', 'uBass', 'uHigh', 'uEnergy', 'uSceneA', 'uSceneB', 'uMix', 'uChord', 'uBright', 'uC1', 'uC2', 'uC3', 'uD1', 'uD2', 'uD3', 'uRip', 'uRipC']) this.u[n] = gl.getUniformLocation(this.pr, n);
    this.ok = true;
    this.scale = 0.5;
    addEventListener('resize', () => this.resize());
    this.resize();
    this.t0 = performance.now();
    this.last = 0;
    this.fpsAvg = 30;
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.cv.width = Math.max(2, Math.round(innerWidth * dpr * this.scale));
    this.cv.height = Math.max(2, Math.round(innerHeight * dpr * this.scale));
    this.gl.viewport(0, 0, this.cv.width, this.cv.height);
  }

  // Besteciden gelen olaylar: çalınacakları zaman sırasıyla tutulur
  push(type, e) {
    this.events.push({ type, ...e });
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
  }

  setTrack(d) {
    const cols = trackColors(d);
    let next = Math.abs(d.seed) % 5;
    if (d.style === 'ambient') next = [1, 2, 3][d.seed % 3];
    if (next === this.sceneA) next = (next + 1 + (d.seed % 4)) % 5;
    if (this.mix > 0) {
      // önceki geçiş bitmeden yenisi gelirse oradan devam
      this.sceneA = this.sceneB;
      this.colA = this.colB;
    }
    this.sceneB = next;
    this.colB = cols;
    this.mix = 0.0001;
    this.leadSeed = d.seed;
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    if (document.hidden) return;
    const dt = now - this.last;
    // Mac pilini ve işlemcisini yormamak için ~30 kare/sn
    if (dt < 31) return;
    this.last = now;
    const sec = Math.min(dt, 100) / 1000;
    this.fpsAvg += (1000 / dt - this.fpsAvg) * 0.05;
    const c = this.m.ctx;
    const playing = c && c.state === 'running';
    if (playing) {
      const ct = c.currentTime - (c.outputLatency || c.baseLatency || 0);
      const keep = [];
      for (const e of this.events) {
        if (e.t > ct) {
          keep.push(e);
          continue;
        }
        if (ct - e.t > 0.5) continue; // gecikmiş olay: atla
        if (e.type === 'kick') this.kick = Math.max(this.kick, e.v * (e.seed === this.leadSeed ? 1 : 0.6));
        else if (e.type === 'chord' && e.seed === this.leadSeed) this.chordT += 1;
        else if (e.type === 'note') this.addRipple(e);
      }
      this.events = keep;
      if (this.m.an) {
        const an = this.m.an;
        const n = Math.min(this.buf.length, an.frequencyBinCount);
        an.getByteFrequencyData(this.buf.subarray(0, n));
        const binHz = c.sampleRate / an.fftSize;
        let lo = 0;
        let hi = 0;
        const loEnd = Math.max(2, Math.round(160 / binHz));
        for (let i = 1; i < loEnd; i++) lo += this.buf[i];
        lo /= (loEnd - 1) * 255;
        for (let i = Math.round(4000 / binHz); i < n; i++) hi += this.buf[i];
        hi /= (n - Math.round(4000 / binHz)) * 255;
        this.bass += (lo - this.bass) * 0.15;
        this.high += (hi * 3 - this.high) * 0.15;
      }
    }
    this.kick *= Math.exp(-sec * 7);
    this.chord += (this.chordT - this.chord) * Math.min(1, sec * 0.6);
    this.bright += ((playing ? 1 : 0.55) - this.bright) * Math.min(1, sec * 0.8);
    if (this.mix > 0) {
      this.mix += sec / 14; // 14 sn'de yeni sahneye geçiş
      if (this.mix >= 1) {
        this.mix = 0;
        this.sceneA = this.sceneB;
        this.colA = this.colB;
      }
    }
    for (const r of this.rips) r.age += sec;
    this.rips = this.rips.filter((r) => r.age < 3.2);

    // çok yavaş makinede çözünürlüğü düşür
    if (this.fpsAvg < 20 && this.scale > 0.3 && now - this.t0 > 15000) {
      this.scale = 0.3;
      this.resize();
    }

    const gl = this.gl;
    const u = this.u;
    gl.uniform2f(u.uRes, this.cv.width, this.cv.height);
    gl.uniform1f(u.uTime, (now - this.t0) / 1000);
    gl.uniform1f(u.uKick, this.kick);
    gl.uniform1f(u.uBass, this.bass);
    gl.uniform1f(u.uHigh, this.high);
    gl.uniform1f(u.uEnergy, this.energy);
    gl.uniform1f(u.uSceneA, this.sceneA);
    gl.uniform1f(u.uSceneB, this.sceneB);
    const mx = this.mix > 0 ? this.mix * this.mix * (3 - 2 * this.mix) : 0;
    gl.uniform1f(u.uMix, mx);
    gl.uniform1f(u.uChord, this.chord);
    gl.uniform1f(u.uBright, this.bright);
    gl.uniform3fv(u.uC1, this.colA[0]);
    gl.uniform3fv(u.uC2, this.colA[1]);
    gl.uniform3fv(u.uC3, this.colA[2]);
    gl.uniform3fv(u.uD1, this.colB[0]);
    gl.uniform3fv(u.uD2, this.colB[1]);
    gl.uniform3fv(u.uD3, this.colB[2]);
    const R = new Float32Array(40);
    const RC = new Float32Array(30);
    this.rips.slice(-10).forEach((r, i) => {
      R.set([r.x, r.y, r.age, r.w], i * 4);
      RC.set(r.col, i * 3);
    });
    gl.uniform4fv(u.uRip, R);
    gl.uniform3fv(u.uRipC, RC);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  addRipple(e) {
    const asp = innerWidth / innerHeight;
    const x = ((e.m - 55) / 34 - 0.5) * asp * 1.5 + (Math.random() - 0.5) * 0.25;
    const y = (Math.random() - 0.5) * 0.75 + (e.who === 'lead2' ? 0.12 : e.who === 'vox' ? -0.15 : 0);
    const pc = ((e.m % 12) + 12) % 12;
    const cols = this.mix > 0.5 ? this.colB : this.colA;
    const base = cols[2];
    const tint = hsl(pc * 30, 0.45, 0.6);
    const col = base.map((v, i) => v * 0.55 + tint[i] * 0.45);
    this.rips.push({ x: Math.max(-asp * 0.48, Math.min(asp * 0.48, x)), y, age: 0, w: (e.seed === this.leadSeed ? 1 : 0.5) * (0.6 + 0.5 * e.v), col });
  }
}
