// CASTRO: Empire — живе місто: дороги до бізнесів, машини й люди, що заходять у бізнеси.
import * as THREE from "three";
import * as Models from "/cabinet/game/models.js?v=20261117d";

// Маршрути всередині ділянки (локальні координати будівлі: фасад дивиться на +z, дорога приходить у (0, 6.2)).
// enter → точка зупинки → exit. heading: куди дивиться авто на зупинці (кут у локальних координатах).
const SPOTS = {
  wash:   { enter: [[0, 6.0], [-3.2, 4.4], [-5.6, 1.6], [-5.4, 0]], stop: [0, 0], exit: [[5.4, 0], [5.6, 1.6], [3.2, 4.4], [0, 6.0]], stay: [2.5, 4], door: [2.4, 2.6] },
  garage: { enter: [[0, 6.0], [-0.4, 4.6]], stop: [-1.3, 2.9], exit: [[0.2, 4.6], [0, 6.0]], stay: [4, 7], door: [3.0, 2.2] },
  club:   { enter: [[0, 6.0], [1.0, 4.9]], stop: [2.2, 4.4], exit: [[0.6, 5.2], [0, 6.0]], stay: [2, 3.5], door: [0, 2.9], dropOff: true },
  dealer: { enter: [[0, 6.0], [-1.2, 4.9]], stop: [-2.8, 3.7], exit: [[-1.0, 5.0], [0, 6.0]], stay: [4, 6], door: [0.4, 2.7] },
  port:   { enter: [[0, 6.0], [1.6, 5.0]], stop: [3.4, 3.4], exit: [[1.6, 5.0], [0, 6.0]], stay: [4, 7], door: [-4.4, 3.0] },
  hangar: { enter: [[0, 6.0], [-1.8, 4.8]], stop: [-3.6, 2.2], exit: [[-1.8, 4.8], [0, 6.0]], stay: [3, 5], door: [1.6, 1.8] },
};
const CAR_COLORS = [0xe0182d, 0xf2f2f2, 0x111111, 0x2f6bff, 0xf2c14e, 0x1f8a4c, 0x8a4bff, 0xff7a1a, 0x8a8f99];
const CAR_TYPES = ["sedan", "suv", "super", "sedan", "suv", "sedan"];
const SKIN = [0xf1c7a5, 0xd9a07a, 0xa86b45, 0x6e4126, 0xe8b996];
const CLOTHES = [0xe0182d, 0x1b1b22, 0xf2f2f2, 0x2f6bff, 0x22c55e, 0xf2c14e, 0x8a4bff, 0x555a66];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const makePerson = () => {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: pick(CLOTHES), roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: pick([0x1b1b22, 0x2a3550, 0x3a3a40]), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: pick(SKIN), roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 10), cloth);
  body.position.y = 0.78; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin);
  head.position.y = 1.18; head.castShadow = true;
  const legs = [-0.08, 0.08].map((x) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.46, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.1), pants); leg.position.y = -0.22;
    pivot.add(leg); g.add(pivot); return pivot;
  });
  g.add(body, head);
  g.userData.legs = legs;
  g.userData.phase = Math.random() * Math.PI * 2;
  return g;
};

export function createCity({ scene, ROAD_R, PLOT_R, LOW_END, asphalt, onArrive }) {
  const plots = new Map();
  const cars = [];
  const people = [];
  const dust = [];
  const visitors = [];
  const INNER = ROAD_R + 2.4, OUTER = PLOT_R - 6.2;
  const LANE = 1.15;
  const SIDEWALK = ROAD_R + 3.5;
  const ringPoint = (a, r) => new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  const side = (a) => new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));

  // ---------- Дороги ----------
  const makeRoad = (angle, color) => {
    const L = OUTER - INNER;
    const road = new THREE.Group();
    road.position.copy(ringPoint(angle, INNER)).setY(0.072);
    road.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle)); // локальна +z — від кільця до бізнесу
    const strip = new THREE.Group();
    const geo = new THREE.PlaneGeometry(3.4, L); geo.translate(0, -L / 2, 0);
    const asph = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.9 }));
    asph.rotation.x = -Math.PI / 2; asph.receiveShadow = true;
    strip.add(asph);
    [-1, 1].forEach((s) => {
      const curbGeo = new THREE.BoxGeometry(0.18, 0.08, L); curbGeo.translate(0, 0, L / 2);
      const curb = new THREE.Mesh(curbGeo, new THREE.MeshStandardMaterial({ color: 0x5b5e66, roughness: 0.8 }));
      curb.position.set(s * 1.78, 0.02, 0); strip.add(curb);
      const walkGeo = new THREE.PlaneGeometry(0.9, L); walkGeo.translate(0, -L / 2, 0);
      const walk = new THREE.Mesh(walkGeo, new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.85 }));
      walk.rotation.x = -Math.PI / 2; walk.position.set(s * 2.3, 0.005, 0); walk.receiveShadow = true; strip.add(walk);
    });
    for (let z = 0.6; z < L - 0.3; z += 1.2) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffd27a, emissiveIntensity: 0.35 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.01, z); strip.add(dash);
    }
    road.add(strip);
    // голограма майбутньої дороги
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.7, 0.02, 0), new THREE.Vector3(-1.7, 0.02, L), new THREE.Vector3(1.7, 0.02, L), new THREE.Vector3(1.7, 0.02, 0)]);
    const holo = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color, dashSize: 0.4, gapSize: 0.3, transparent: true, opacity: 0.7 }));
    holo.computeLineDistances();
    road.add(holo);
    scene.add(road);
    return { road, strip, holo, L };
  };

  const addPlot = (id, angle, group, color) => {
    const r = makeRoad(angle, color);
    plots.set(id, { id, angle, group, open: false, down: false, busy: null, forceVisit: false, build: null, ...r, queue: [] });
    r.strip.visible = false;
  };

  const localToWorld = (plot, [x, z]) => { plot.group.updateMatrixWorld(); return plot.group.localToWorld(new THREE.Vector3(x, 0, z)); };

  // Черга біля клубу
  const syncQueue = (plot) => {
    const want = plot.id === "club" && plot.open && !plot.down ? (LOW_END ? 3 : 6) : 0;
    while (plot.queue.length < want) {
      const p = makePerson();
      const i = plot.queue.length;
      p.position.copy(localToWorld(plot, [-1.1 - i * 0.55, 3.7 + (i % 2) * 0.25]));
      p.lookAt(localToWorld(plot, [0, 2.9]));
      scene.add(p); plot.queue.push(p);
    }
    while (plot.queue.length > want) scene.remove(plot.queue.pop());
  };

  const setPlot = (id, { open, down, animate }) => {
    const plot = plots.get(id);
    if (!plot) return;
    const wasOpen = plot.open;
    plot.open = open; plot.down = down;
    plot.holo.visible = !open;
    if (open && !wasOpen) {
      plot.strip.visible = true;
      if (animate) { plot.build = 0; plot.strip.scale.z = 0.001; plot.forceVisit = true; }
      else plot.strip.scale.z = 1;
    }
    if (!open) plot.strip.visible = false;
    syncQueue(plot);
  };

  // ---------- Машини ----------
  const newCar = (i) => {
    const car = Models.makeCar(CAR_TYPES[i % CAR_TYPES.length], CAR_COLORS[i % CAR_COLORS.length]);
    car.scale.setScalar(0.5);
    car.traverse((o) => { if (o.isMesh) o.castShadow = !LOW_END; });
    const dir = i % 2 ? 1 : -1;
    car.userData.sim = { mode: "ring", a: Math.random() * Math.PI * 2, dir, r: ROAD_R + (dir > 0 ? LANE : -LANE), speed: rand(0.1, 0.16), cool: rand(2, 6) };
    scene.add(car);
    return car;
  };

  const drive = (obj, points, speed, then) => {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    obj.userData.sim = { ...obj.userData.sim, mode: "path", curve, len: curve.getLength(), s: 0, speed, then };
  };

  const enterPlot = (car, plot) => {
    const sim = car.userData.sim;
    const spot = SPOTS[plot.id];
    plot.busy = car;
    plot.forceVisit = false;
    const pts = [
      car.position.clone(),
      ringPoint(plot.angle + sim.dir * 0.03, ROAD_R + LANE),
      ringPoint(plot.angle, INNER + 0.6),
      ringPoint(plot.angle, OUTER + 0.3),
      ...spot.enter.map((p) => localToWorld(plot, p)),
      localToWorld(plot, spot.stop),
    ];
    drive(car, pts, 3.4, () => {
      onArrive?.(plot.id, car.position.clone());
      if (spot.dropOff && !LOW_END) spawnVisitor(plot, car.position.clone());
      car.userData.sim = { ...car.userData.sim, mode: "stay", t: rand(...spot.stay), plot };
    });
  };

  const leavePlot = (car, plot) => {
    const spot = SPOTS[plot.id];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const pts = [
      car.position.clone(),
      ...spot.exit.map((p) => localToWorld(plot, p)),
      ringPoint(plot.angle, OUTER + 0.3),
      ringPoint(plot.angle, INNER + 0.6),
      ringPoint(plot.angle + dir * 0.09, ROAD_R + (dir > 0 ? LANE : -LANE)),
    ];
    drive(car, pts, 3.4, () => {
      if (plot.busy === car) plot.busy = null;
      car.userData.sim = { mode: "ring", a: plot.angle + dir * 0.09, dir, r: ROAD_R + (dir > 0 ? LANE : -LANE), speed: rand(0.1, 0.16), cool: rand(6, 14) };
    });
  };

  // ---------- Люди ----------
  const newPerson = () => {
    const p = makePerson();
    const dir = Math.random() < 0.5 ? 1 : -1;
    p.userData.sim = { mode: "walk", a: Math.random() * Math.PI * 2, dir, r: SIDEWALK + rand(-0.35, 0.35), speed: rand(0.75, 1.05), cool: rand(2, 10) };
    scene.add(p);
    return p;
  };

  const walkTo = (p, points, then) => {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    p.userData.sim = { ...p.userData.sim, mode: "path", curve, len: curve.getLength(), s: 0, speed: p.userData.sim.speed || 0.9, then };
  };

  const visit = (p, plot) => {
    const spot = SPOTS[plot.id];
    const s = Math.random() < 0.5 ? 1 : -1;
    const off = side(plot.angle).multiplyScalar(2.3 * s);
    // спершу тротуаром по дузі до потрібного бізнесу
    const sim = p.userData.sim;
    const arc = [];
    const delta = wrap(plot.angle - sim.a);
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.12));
    for (let k = 1; k < steps; k += 1) arc.push(ringPoint(sim.a + (delta * k) / steps, sim.r));
    const pts = [p.position.clone(), ...arc, ringPoint(plot.angle, SIDEWALK).add(off.clone().multiplyScalar(0.6)), ringPoint(plot.angle, INNER + 0.4).add(off), ringPoint(plot.angle, OUTER + 0.2).add(off), localToWorld(plot, spot.door)];
    walkTo(p, pts, () => {
      p.visible = false;
      onArrive?.(plot.id, p.position.clone(), true);
      p.userData.sim = { ...p.userData.sim, mode: "inside", t: rand(4, 9), plot, side: s };
    });
  };

  const leaveVisit = (p, plot) => {
    const off = side(plot.angle).multiplyScalar(2.3 * p.userData.sim.side);
    const dir = Math.random() < 0.5 ? 1 : -1;
    p.visible = true;
    const pts = [p.position.clone(), ringPoint(plot.angle, OUTER + 0.2).add(off), ringPoint(plot.angle, INNER + 0.4).add(off), ringPoint(plot.angle + dir * 0.05, SIDEWALK)];
    walkTo(p, pts, () => { p.userData.sim = { ...p.userData.sim, mode: "walk", a: plot.angle + dir * 0.05, dir, r: SIDEWALK + rand(-0.35, 0.35), cool: rand(8, 18) }; });
  };

  // пасажир, що виходить з авто біля клубу
  const spawnVisitor = (plot, at) => {
    const p = makePerson();
    p.position.copy(at);
    p.userData.sim = { mode: "path", speed: 0.9 };
    scene.add(p);
    visitors.push(p);
    walkTo(p, [at.clone(), localToWorld(plot, [1.2, 3.6]), localToWorld(plot, SPOTS[plot.id].door)], () => { p.userData.done = true; });
  };

  const setDensity = (nCars, nPeople) => {
    while (cars.length < nCars) cars.push(newCar(cars.length));
    while (people.length < nPeople) people.push(newPerson());
  };

  // ---------- Пил під час будівництва дороги ----------
  const puff = (pos) => {
    if (LOW_END) return;
    const m = new THREE.Mesh(new THREE.SphereGeometry(rand(0.25, 0.5), 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false }));
    m.position.copy(pos).add(new THREE.Vector3(rand(-1.4, 1.4), 0.3, rand(-0.4, 0.4)));
    scene.add(m); dust.push({ m, life: 1.2 });
  };

  // ---------- Кадр ----------
  const tmp = new THREE.Vector3();
  const followPath = (obj, dt, isCar) => {
    const sim = obj.userData.sim;
    const remaining = sim.len - sim.s;
    const v = isCar ? sim.speed * Math.min(1, 0.35 + remaining / 3) : sim.speed;
    sim.s = Math.min(sim.len, sim.s + v * dt);
    const u = sim.len > 0 ? sim.s / sim.len : 1;
    obj.position.copy(sim.curve.getPointAt(u));
    const tan = sim.curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)), tmp);
    if (isCar) obj.rotation.y = Math.atan2(-tan.z, tan.x);
    else obj.rotation.y = Math.atan2(tan.x, tan.z);
    if (sim.s >= sim.len) sim.then?.();
    return v;
  };
  const animateLegs = (p, v, t) => {
    const swing = v > 0.05 ? Math.sin(t * 9 + p.userData.phase) * 0.6 : 0;
    p.userData.legs[0].rotation.x = swing; p.userData.legs[1].rotation.x = -swing;
    p.position.y = v > 0.05 ? Math.abs(Math.sin(t * 9 + p.userData.phase)) * 0.04 : 0;
  };

  const update = (dt, t) => {
    // будівництво доріг
    plots.forEach((plot) => {
      if (plot.build == null) return;
      plot.build = Math.min(1, plot.build + dt / 1.4);
      plot.strip.scale.z = Math.max(0.001, 1 - Math.pow(1 - plot.build, 3));
      if (Math.random() < 0.6) puff(plot.road.localToWorld(new THREE.Vector3(0, 0, plot.L * plot.strip.scale.z)));
      if (plot.build >= 1) plot.build = null;
    });
    for (let i = dust.length - 1; i >= 0; i -= 1) {
      const d = dust[i]; d.life -= dt; d.m.position.y += dt * 0.8; d.m.scale.multiplyScalar(1 + dt * 0.9); d.m.material.opacity = Math.max(0, d.life / 1.2) * 0.55;
      if (d.life <= 0) { scene.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); dust.splice(i, 1); }
    }
    // машини
    cars.forEach((car) => {
      const sim = car.userData.sim;
      if (sim.mode === "ring") {
        sim.a += sim.dir * sim.speed * dt;
        sim.cool -= dt;
        car.position.set(Math.cos(sim.a) * sim.r, 0, Math.sin(sim.a) * sim.r);
        car.rotation.y = -sim.a + (sim.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        if (sim.cool <= 0) {
          for (const plot of plots.values()) {
            if (!plot.open || plot.down || plot.busy || plot.build != null) continue;
            const ahead = wrap(plot.angle - sim.a) * sim.dir;
            if (ahead > 0 && ahead < 0.06) {
              if (plot.forceVisit || Math.random() < 0.45) enterPlot(car, plot);
              else sim.cool = rand(3, 8);
              break;
            }
          }
        }
      } else if (sim.mode === "path") followPath(car, dt, true);
      else if (sim.mode === "stay") {
        sim.t -= dt;
        if (sim.t <= 0) leavePlot(car, sim.plot);
      }
    });
    // люди
    people.forEach((p) => {
      const sim = p.userData.sim;
      if (sim.mode === "walk") {
        sim.a += sim.dir * (sim.speed / sim.r) * dt;
        sim.cool -= dt;
        p.position.set(Math.cos(sim.a) * sim.r, 0, Math.sin(sim.a) * sim.r);
        p.rotation.y = -sim.a + (sim.dir > 0 ? 0 : Math.PI);
        animateLegs(p, sim.speed, t);
        if (sim.cool <= 0) {
          for (const plot of plots.values()) {
            if (!plot.open || plot.down || plot.build != null) continue;
            const ahead = wrap(plot.angle - sim.a) * sim.dir;
            if (ahead > 0 && ahead < 0.5) {
              if (Math.random() < 0.55) visit(p, plot); else sim.cool = rand(4, 10);
              break;
            }
          }
        }
      } else if (sim.mode === "path") animateLegs(p, followPath(p, dt, false), t);
      else if (sim.mode === "inside") {
        sim.t -= dt;
        if (sim.t <= 0) leaveVisit(p, sim.plot);
      }
    });
    // пасажири клубу (окремі, не в масиві people)
    for (let i = visitors.length - 1; i >= 0; i -= 1) {
      const v = visitors[i];
      animateLegs(v, followPath(v, dt, false), t);
      if (v.userData.done) { scene.remove(v); visitors.splice(i, 1); }
    }
    // черга біля клубу — переминаються з ноги на ногу
    plots.forEach((plot) => plot.queue.forEach((p, i) => { p.rotation.z = Math.sin(t * 1.5 + i) * 0.03; }));
  };

  return { addPlot, setPlot, setDensity, update };
}
