/** Fixed-capacity, unsigned 32-bit chunks. No loss above the 53-bit JS limit. */
export class BitSet {
  constructor(capacity, indices = []) {
    if (!Number.isInteger(capacity) || capacity < 0) throw new RangeError('invalid capacity');
    this.capacity = capacity;
    this.words = new Uint32Array(Math.ceil(capacity / 32));
    this.addAll(indices);
  }
  static fromIndices(capacity, indices) { return new BitSet(capacity, indices); }
  static fromChunks(capacity, chunks) {
    const result = new BitSet(capacity);
    result.words.set(chunks);
    if (capacity % 32) result.words[result.words.length - 1] &= 0xffffffff >>> (32 - capacity % 32);
    return result;
  }
  add(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this.capacity) throw new RangeError(`bit index out of range: ${i}`);
    this.words[i >>> 5] |= 1 << (i & 31); return this;
  }
  has(i) { return Number.isInteger(i) && i >= 0 && i < this.capacity && !!(this.words[i >>> 5] & (1 << (i & 31))); }
  contains(i) { return this.has(i); }
  includes(i) { return this.has(i); }
  remove(i) { if (this.has(i)) this.words[i >>> 5] &= ~(1 << (i & 31)); return this; }
  addAll(indices) { for (const i of indices) this.add(i); return this; }
  removeAll(indices) { for (const i of indices) this.remove(i); return this; }
  compatible(other) { if (this.capacity !== other.capacity) throw new RangeError('bitset capacity mismatch'); }
  merge(other) { this.compatible(other); for (let i=0;i<this.words.length;i++) this.words[i] |= other.words[i]; return this; }
  oppress(other) { this.compatible(other); for (let i=0;i<this.words.length;i++) this.words[i] &= ~other.words[i]; return this; }
  intersection(other) { this.compatible(other); const r=new BitSet(this.capacity); for(let i=0;i<this.words.length;i++) r.words[i]=this.words[i]&other.words[i]; return r; }
  containsAll(other) { this.compatible(other); return this.words.every((w,i) => ((w & other.words[i]) >>> 0) === other.words[i]); }
  get isEmpty() { return this.words.every(w => w === 0); }
  get length() { let n=0; for(const w of this.words) { let v=w; while(v) { v &= v-1; n++; } } return n; }
  *[Symbol.iterator]() { for(let i=0;i<this.capacity;i++) if(this.has(i)) yield i; }
  toJSON() { return [...this]; }
}
