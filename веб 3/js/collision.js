// Каждый объект — «коробка»: x — центр по ширине, y — низ, z — передняя грань,
// w/h/d — ширина, высота и глубина.
const Collision = {
  overlap(a0, a1, b0, b1) {
    return a0 < b1 && a1 > b0;
  },

  boxes(a, b) {
    return this.overlap(a.x - a.w / 2, a.x + a.w / 2, b.x - b.w / 2, b.x + b.w / 2) &&
           this.overlap(a.y, a.y + a.h, b.y, b.y + b.h) &&
           this.overlap(a.z, a.z + a.d, b.z, b.z + b.d);
  },
};
